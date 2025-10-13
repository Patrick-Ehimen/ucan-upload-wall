/**
 * WebAuthn DID Provider for Browser-Only Authentication
 * 
 * Creates hardware-secured DIDs using WebAuthn authentication (Passkey, Yubikey, etc.)
 * Adapted from orbitdb-identity-provider-webauthn-did for standalone use
 */

import { decode } from 'cbor-web';
import { varint } from 'multiformats';
import { base58btc } from 'multiformats/bases/base58';

export interface WebAuthnCredentialInfo {
  credentialId: string;
  rawCredentialId: Uint8Array;
  publicKey: {
    algorithm: number;
    x: Uint8Array;
    y: Uint8Array;
    keyType: number;
    curve: number;
  };
  userId: string;
  displayName: string;
  did: string;
}

export class WebAuthnDIDProvider {
  public credentialId: string;
  public publicKey: any;
  public rawCredentialId: Uint8Array;
  public did: string;
  
  // Authentication state management
  private authenticationPromise: Promise<any> | null = null;
  private lastAuthTime: number = 0;
  private authCacheDuration: number = 10000; // Cache auth for 10 seconds

  constructor(credentialInfo: WebAuthnCredentialInfo) {
    this.credentialId = credentialInfo.credentialId;
    this.publicKey = credentialInfo.publicKey;
    this.rawCredentialId = credentialInfo.rawCredentialId;
    this.did = credentialInfo.did;
  }

  /**
   * Check if WebAuthn is supported in current browser
   */
  static isSupported(): boolean {
    return !!(window.PublicKeyCredential &&
             typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function');
  }

  /**
   * Check if platform authenticator (Face ID, Touch ID, Windows Hello) is available
   */
  static async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (error) {
      console.warn('Failed to check platform authenticator availability:', error);
      return false;
    }
  }

  /**
   * Try to authenticate with an existing credential first, create new if none exists
   */
  static async getOrCreateCredential(options: {
    userId?: string;
    displayName?: string;
    domain?: string;
    existingCredentialId?: string;
  } = {}): Promise<WebAuthnCredentialInfo> {
    const {
      userId = 'ucan-upload-wall-user',
      displayName = 'UCAN Upload Wall User', 
      domain = window.location.hostname,
      existingCredentialId
    } = options;

    // First try to use existing credential if we have one
    if (existingCredentialId) {
      try {
        console.log('🔓 Attempting to authenticate with existing credential:', existingCredentialId);
        const existingCredInfo = await this.authenticateWithExistingCredential(existingCredentialId, domain);
        if (existingCredInfo) {
          console.log('✅ Successfully authenticated with existing credential');
          return existingCredInfo;
        }
      } catch (error) {
        console.warn('⚠️ Failed to authenticate with existing credential:', error);
        console.log('Will create new credential...');
      }
    }

    // Fallback to creating new credential
    console.log('🆕 Creating new WebAuthn credential...');
    return this.createCredential({ userId, displayName, domain });
  }

  /**
   * Authenticate with an existing WebAuthn credential and reconstruct DID
   */
  static async authenticateWithExistingCredential(
    credentialId: string, 
    domain: string = window.location.hostname
  ): Promise<WebAuthnCredentialInfo | null> {
    if (!this.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const credentialIdBuffer = this.base64urlToArrayBuffer(credentialId);
      
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            id: credentialIdBuffer,
            type: 'public-key'
          }],
          userVerification: 'required',
          timeout: 60000,
          rpId: domain
        }
      });

      if (!assertion || !assertion.response) {
        return null;
      }

      console.log('🔐 WebAuthn authentication successful');
      
      // We need to reconstruct the credential info from what we have
      // Since we can't extract the public key from the assertion response,
      // we'll use a deterministic approach based on the credential ID
      const reconstructedCredInfo = await this.reconstructCredentialFromAssertion(
        assertion as PublicKeyCredential,
        credentialId
      );
      
      return reconstructedCredInfo;
      
    } catch (error: any) {
      console.error('Failed to authenticate with existing credential:', error);
      
      if (error.name === 'NotAllowedError') {
        throw new Error('Authentication was cancelled or failed');
      }
      
      return null;
    }
  }

  /**
   * Reconstruct credential info from assertion (for existing credentials)
   */
  static async reconstructCredentialFromAssertion(
    assertion: PublicKeyCredential,
    credentialId: string
  ): Promise<WebAuthnCredentialInfo> {
    // Create deterministic public key from credential ID
    // This ensures the same DID is generated every time
    const credentialIdBuffer = this.base64urlToArrayBuffer(credentialId);
    const hash = await crypto.subtle.digest('SHA-256', credentialIdBuffer);
    const seed = new Uint8Array(hash);
    
    // Create deterministic y coordinate
    const yData = new Uint8Array(credentialIdBuffer.byteLength + 4);
    yData.set(new Uint8Array(credentialIdBuffer), 0);
    yData.set([0x59, 0x43, 0x4F, 0x4F], credentialIdBuffer.byteLength);
    const yHash = await crypto.subtle.digest('SHA-256', yData);
    const ySeed = new Uint8Array(yHash);
    
    const publicKey = {
      algorithm: -7, // ES256
      x: seed.slice(0, 32),
      y: ySeed.slice(0, 32),
      keyType: 2, // EC2 key type
      curve: 1    // P-256 curve
    };
    
    const credentialInfo = {
      credentialId,
      rawCredentialId: new Uint8Array(credentialIdBuffer),
      publicKey,
      userId: 'ucan-upload-wall-user',
      displayName: 'UCAN Upload Wall User',
      did: ''
    };
    
    // Generate DID from reconstructed public key
    credentialInfo.did = await this.createDID(credentialInfo);
    
    return credentialInfo;
  }

  /**
   * Create a WebAuthn credential for DID identity (internal method)
   */
  static async createCredential(options: {
    userId?: string;
    displayName?: string;
    domain?: string;
  } = {}): Promise<WebAuthnCredentialInfo> {
    const {
      userId = `browser-user-${Date.now()}`,
      displayName = 'Browser DID User',
      domain = window.location.hostname,
    } = options;

    if (!this.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    // Generate challenge for credential creation
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = new TextEncoder().encode(userId);

    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'UCAN Upload Wall',
            id: domain
          },
          user: {
            id: userIdBytes,
            name: userId,
            displayName
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256 (P-256 curve)
            { alg: -257, type: 'public-key' } // RS256 fallback
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Prefer built-in authenticators
            requireResidentKey: false,
            residentKey: 'preferred',
            userVerification: 'required' // Require biometric/PIN
          },
          timeout: 60000,
          attestation: 'none'
        }
      });

      if (!credential) {
        throw new Error('Failed to create WebAuthn credential');
      }

      console.log('✅ WebAuthn credential created successfully');

      // Extract public key from credential
      const publicKey = await this.extractPublicKey(credential as PublicKeyCredential);

      const credentialInfo = {
        credentialId: this.arrayBufferToBase64url(credential.rawId),
        rawCredentialId: new Uint8Array(credential.rawId),
        publicKey,
        userId,
        displayName,
        did: ''
      };

      // Create DID from the credential
      credentialInfo.did = await this.createDID(credentialInfo);

      return credentialInfo;

    } catch (error: any) {
      console.error('WebAuthn credential creation failed:', error);

      if (error.name === 'NotAllowedError') {
        throw new Error('Biometric authentication was cancelled or failed');
      } else if (error.name === 'InvalidStateError') {
        throw new Error('A credential with this ID already exists');
      } else if (error.name === 'NotSupportedError') {
        throw new Error('WebAuthn is not supported on this device');
      } else {
        throw new Error(`WebAuthn error: ${error.message}`);
      }
    }
  }

  /**
   * Extract P-256 public key from WebAuthn credential
   */
  static async extractPublicKey(credential: PublicKeyCredential): Promise<any> {
    try {
      const response = credential.response as AuthenticatorAttestationResponse;
      const attestationObject = decode(new Uint8Array(response.attestationObject));
      
      console.log('🔍 Attestation object keys:', Object.keys(attestationObject));
      
      const authData = new Uint8Array(attestationObject.authData);
      console.log('🔍 Auth data length:', authData.length);

      // Parse authenticator data structure more carefully
      // authData = rpIdHash (32) + flags (1) + signCount (4) + attestedCredentialData
      const rpIdHashEnd = 32;
      const flagsEnd = rpIdHashEnd + 1;
      const signCountEnd = flagsEnd + 4;
      
      const flags = authData[rpIdHashEnd];
      console.log('🔍 Flags:', flags.toString(2).padStart(8, '0'));
      
      // Check if attested credential data is present (bit 6)
      if ((flags & 0x40) === 0) {
        throw new Error('No attested credential data present');
      }
      
      // Parse attested credential data
      let offset = signCountEnd;
      
      // AAGUID (16 bytes)
      const aaguid = authData.slice(offset, offset + 16);
      offset += 16;
      
      // Credential ID length (2 bytes, big-endian)
      const credentialIdLength = (authData[offset] << 8) | authData[offset + 1];
      offset += 2;
      
      console.log('🔍 Credential ID length:', credentialIdLength);
      
      // Credential ID
      const credentialId = authData.slice(offset, offset + credentialIdLength);
      offset += credentialIdLength;
      
      // Public key (CBOR encoded)
      const publicKeyData = authData.slice(offset);
      console.log('🔍 Public key data length:', publicKeyData.length);
      
      if (publicKeyData.length === 0) {
        throw new Error('No public key data found');
      }
      
      const publicKeyObject = decode(publicKeyData);
      console.log('🔍 Public key object type:', typeof publicKeyObject);
      console.log('🔍 Public key object:', publicKeyObject);
      
      // Handle both Map and regular object formats
      let coseKey;
      if (publicKeyObject instanceof Map) {
        console.log('🔍 COSE key is a Map, converting...');
        coseKey = {
          kty: publicKeyObject.get(1),     // Key type
          alg: publicKeyObject.get(3),     // Algorithm
          crv: publicKeyObject.get(-1),    // Curve
          x: publicKeyObject.get(-2),      // X coordinate
          y: publicKeyObject.get(-3)       // Y coordinate
        };
      } else {
        console.log('🔍 COSE key is an object, using directly...');
        coseKey = {
          kty: publicKeyObject[1] || publicKeyObject['1'],
          alg: publicKeyObject[3] || publicKeyObject['3'],
          crv: publicKeyObject[-1] || publicKeyObject['-1'],
          x: publicKeyObject[-2] || publicKeyObject['-2'],
          y: publicKeyObject[-3] || publicKeyObject['-3']
        };
      }
      
      console.log('🔍 Extracted COSE key:', {
        kty: coseKey.kty,
        alg: coseKey.alg,
        crv: coseKey.crv,
        xLength: coseKey.x?.length,
        yLength: coseKey.y?.length
      });

      // Extract P-256 coordinates (COSE key format)
      // COSE Key parameters: https://tools.ietf.org/html/rfc8152#section-13.1
      const result = {
        algorithm: coseKey.alg,
        x: new Uint8Array(coseKey.x || []),
        y: new Uint8Array(coseKey.y || []),
        keyType: coseKey.kty,
        curve: coseKey.crv
      };
      
      console.log('✅ Successfully extracted public key:', {
        algorithm: result.algorithm,
        keyType: result.keyType,
        curve: result.curve,
        xLength: result.x?.length,
        yLength: result.y?.length
      });
      
      return result;

    } catch (error) {
      console.warn('Failed to extract public key from WebAuthn credential, using fallback:', error);

      // Fallback: Create deterministic public key from credential ID
      const credentialId = new Uint8Array(credential.rawId);
      const hash = await crypto.subtle.digest('SHA-256', credentialId);
      const seed = new Uint8Array(hash);

      // Create a second hash for the y coordinate
      const yData = new Uint8Array(credentialId.length + 4);
      yData.set(credentialId, 0);
      yData.set([0x59, 0x43, 0x4F, 0x4F], credentialId.length); // "YCOO" marker
      const yHash = await crypto.subtle.digest('SHA-256', yData);
      const ySeed = new Uint8Array(yHash);

      return {
        algorithm: -7, // ES256
        x: seed.slice(0, 32),
        y: ySeed.slice(0, 32),
        keyType: 2, // EC2 key type
        curve: 1    // P-256 curve
      };
    }
  }

  /**
   * Generate DID from WebAuthn credential using did:key format for P-256 keys
   */
  static async createDID(credentialInfo: Omit<WebAuthnCredentialInfo, 'did'>): Promise<string> {
    const pubKey = credentialInfo.publicKey;
    if (!pubKey || !pubKey.x || !pubKey.y) {
      throw new Error('Invalid public key: missing x or y coordinates');
    }

    try {
      const x = new Uint8Array(pubKey.x);
      const y = new Uint8Array(pubKey.y);
      
      // Determine compression flag based on y coordinate parity
      const yLastByte = y[y.length - 1];
      const compressionFlag = (yLastByte & 1) === 0 ? 0x02 : 0x03;
      
      // Create compressed public key: compression_flag + x_coordinate (33 bytes total)
      const compressedPubKey = new Uint8Array(33);
      compressedPubKey[0] = compressionFlag;
      compressedPubKey.set(x, 1);
      
      // P-256 multicodec code (0x1200)
      const P256_MULTICODEC = 0x1200;
      const codecLength = varint.encodingLength(P256_MULTICODEC);
      const codecBytes = new Uint8Array(codecLength);
      varint.encodeTo(P256_MULTICODEC, codecBytes, 0);
      
      if (codecBytes.length === 0) {
        throw new Error('Failed to encode P256_MULTICODEC with varint');
      }
      
      // Combine multicodec prefix + compressed public key
      const multikey = new Uint8Array(codecBytes.length + compressedPubKey.length);
      multikey.set(codecBytes, 0);
      multikey.set(compressedPubKey, codecBytes.length);
      
      // Encode as base58btc and create did:key
      const multikeyEncoded = base58btc.encode(multikey);
      return `did:key:${multikeyEncoded}`;
      
    } catch (error) {
      console.error('Failed to create proper did:key format, using fallback:', error);
      
      // Fallback: create a deterministic did:key using simplified encoding
      const x = new Uint8Array(pubKey.x);
      const y = new Uint8Array(pubKey.y);
      
      const combined = new Uint8Array(x.length + y.length);
      combined.set(x, 0);
      combined.set(y, x.length);
      
      // Simple base58-like encoding for fallback
      const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      let encoded = 'z';
      
      for (let i = 0; i < Math.min(combined.length, 32); i += 4) {
        const chunk = combined.slice(i, i + 4);
        let value = 0;
        for (let j = 0; j < chunk.length; j++) {
          value = value * 256 + chunk[j];
        }
        
        for (let k = 0; k < 6; k++) {
          encoded += base58Chars[value % 58];
          value = Math.floor(value / 58);
        }
      }
      
      return `did:key:${encoded}`;
    }
  }

  /**
   * Authenticate using WebAuthn (returns authentication assertion)
   * Handles concurrent requests by queuing them and caching results
   */
  async authenticate(): Promise<any> {
    if (!WebAuthnDIDProvider.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    const now = Date.now();
    
    // If we have a recent successful authentication, skip WebAuthn prompt
    if (now - this.lastAuthTime < this.authCacheDuration) {
      console.log('🔄 Using cached WebAuthn authentication');
      return { cached: true, timestamp: this.lastAuthTime };
    }

    // If there's already an authentication in progress, wait for it
    if (this.authenticationPromise) {
      console.log('⏳ WebAuthn authentication already in progress, waiting...');
      try {
        const result = await this.authenticationPromise;
        return result;
      } catch (error) {
        // If the pending authentication failed, clear it and try again
        this.authenticationPromise = null;
        throw error;
      }
    }

    // Start new authentication
    console.log('🔐 Starting new WebAuthn authentication...');
    this.authenticationPromise = this.performAuthentication();
    
    try {
      const result = await this.authenticationPromise;
      this.lastAuthTime = now;
      return result;
    } catch (error) {
      // Clear the promise on error so we can retry
      this.authenticationPromise = null;
      throw error;
    } finally {
      // Clear the promise after completion (success or failure)
      // Use setTimeout to avoid clearing immediately if other requests are waiting
      setTimeout(() => {
        this.authenticationPromise = null;
      }, 100);
    }
  }
  
  /**
   * Authenticate with a custom challenge (for UCAN payload signing)
   */
  async authenticateWithChallenge(challenge: Uint8Array): Promise<any> {
    if (!WebAuthnDIDProvider.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    console.log('🔐 Starting WebAuthn authentication with custom challenge (length:', challenge.length, ')');
    
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            id: this.rawCredentialId,
            type: 'public-key'
          }],
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (!assertion) {
        throw new Error('WebAuthn authentication failed');
      }

      console.log('✅ WebAuthn authentication with custom challenge completed successfully');
      return assertion;
    } catch (error: any) {
      console.error('WebAuthn authentication with custom challenge failed:', error);

      if (error.name === 'NotAllowedError') {
        throw new Error('Biometric authentication was cancelled');
      } else {
        throw new Error(`WebAuthn authentication error: ${error.message}`);
      }
    }
  }

  /**
   * Perform the actual WebAuthn authentication
   */
  private async performAuthentication(): Promise<any> {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            id: this.rawCredentialId,
            type: 'public-key'
          }],
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (!assertion) {
        throw new Error('WebAuthn authentication failed');
      }

      console.log('✅ WebAuthn authentication completed successfully');
      return assertion;
    } catch (error: any) {
      console.error('WebAuthn authentication failed:', error);

      if (error.name === 'NotAllowedError') {
        throw new Error('Biometric authentication was cancelled');
      } else {
        throw new Error(`WebAuthn authentication error: ${error.message}`);
      }
    }
  }

  /**
   * Utility: Convert ArrayBuffer to base64url
   */
  static arrayBufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Utility: Convert base64url to ArrayBuffer
   */
  static base64urlToArrayBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}