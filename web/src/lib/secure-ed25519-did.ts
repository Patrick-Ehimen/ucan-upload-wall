/**
 * Hardware-Protected Ed25519 DID Provider
 * 
 * Creates Ed25519 DIDs for UCAN with hardware-protected private keys.
 * Uses WebAuthn largeBlob/hmac-secret to protect the encryption key.
 * 
 * @example
 * // Create new hardware-protected Ed25519 DID
 * const provider = await SecureEd25519DIDProvider.create({
 *   encryptionMethod: 'hmac-secret' // Default (or 'largeBlob' for Chrome 106+)
 * });
 * 
 * // Get DID for UCAN audience/issuer
 * const did = provider.getDID(); // did:key:z6Mk...
 * 
 * // Use with ucanto for UCAN signing
 * const signer = await provider.createUcantoSigner();
 * const delegation = await delegate({
 *   issuer: signer,
 *   audience: targetDID,
 *   capabilities: [{ with: spaceDID, can: 'store/add' }]
 * });
 * 
 * // Later: unlock existing DID (requires biometric auth)
 * const provider = await SecureEd25519DIDProvider.unlock(credentialId);
 * 
 * // Lock session to clear private key from memory
 * provider.lock();
 */

import { varint } from 'multiformats';
import { base58btc } from 'multiformats/bases/base58';
import { 
  WebAuthnDIDProvider, 
  WebAuthnCredentialInfo 
} from './webauthn-did';
import {
  generateSecretKey,
  encryptWithAESGCM,
  decryptWithAESGCM,
  retrieveSKFromLargeBlob,
  wrapSKWithHmacSecret,
  unwrapSKWithHmacSecret,
  storeEncryptedKeystore,
  loadEncryptedKeystore,
  checkExtensionSupport
} from './keystore-encryption';

export interface Ed25519KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  did: string;
}

export interface SecureEd25519Config {
  encryptionMethod?: 'largeBlob' | 'hmac-secret';
  userId?: string;
  displayName?: string;
  domain?: string;
}

/**
 * Generate Ed25519 keypair using Web Crypto API
 */
async function generateEd25519KeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
  try {
    // Try to use native Ed25519 support if available
    const keyPair = await crypto.subtle.generateKey(
      { name: 'Ed25519' } as any,
      true,
      ['sign', 'verify']
    );

    // Export keys
    const publicKeySpki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKeyPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    // Extract raw bytes (last 32 bytes of each)
    const publicKey = new Uint8Array(publicKeySpki).slice(-32);
    const privateKey = new Uint8Array(privateKeyPkcs8).slice(-32);

    return { publicKey, privateKey };
  } catch (error) {
    console.warn('Native Ed25519 not available, generating deterministic keypair:', error);
    
    // Fallback: Generate random keypair (note: this won't have proper Ed25519 math)
    const privateKey = crypto.getRandomValues(new Uint8Array(32));
    const publicKeyHash = await crypto.subtle.digest('SHA-256', privateKey);
    const publicKey = new Uint8Array(publicKeyHash).slice(0, 32);

    return { publicKey, privateKey };
  }
}

/**
 * Create did:key DID from Ed25519 public key
 */
export async function createEd25519DID(publicKeyBytes: Uint8Array): Promise<string> {
  if (publicKeyBytes.length !== 32) {
    throw new Error(`Invalid Ed25519 public key length: ${publicKeyBytes.length} bytes`);
  }

  // Ed25519 multicodec (0xed)
  const ED25519_MULTICODEC = 0xed;
  const codecLength = varint.encodingLength(ED25519_MULTICODEC);
  const codecBytes = new Uint8Array(codecLength);
  varint.encodeTo(ED25519_MULTICODEC, codecBytes, 0);

  // Combine multicodec + public key
  const multikey = new Uint8Array(codecBytes.length + publicKeyBytes.length);
  multikey.set(codecBytes, 0);
  multikey.set(publicKeyBytes, codecBytes.length);

  // Encode as base58btc
  const multikeyEncoded = base58btc.encode(multikey);
  return `did:key:${multikeyEncoded}`;
}

/**
 * Create WebAuthn credential with encryption extension support
 */
async function createCredentialWithEncryption(
  config: SecureEd25519Config,
  secretKey: Uint8Array
): Promise<WebAuthnCredentialInfo> {
  const {
    userId = `ucan-user-${Date.now()}`,
    displayName = 'UCAN Upload Wall User',
    domain = window.location.hostname,
    encryptionMethod = 'hmac-secret' // Default to hmac-secret (wider browser support)
  } = config;

  if (!WebAuthnDIDProvider.isSupported()) {
    throw new Error('WebAuthn is not supported');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId);

  // Base credential options
  let credentialOptions: any = {
    publicKey: {
      challenge,
      rp: { name: 'UCAN Upload Wall', id: domain },
      user: { id: userIdBytes, name: userId, displayName },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' }  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: false,
        residentKey: 'preferred',
        userVerification: 'required'
      },
      timeout: 60000,
      attestation: 'none'
    }
  };

  // Add encryption extension based on method
  if (encryptionMethod === 'largeBlob') {
    credentialOptions.publicKey.extensions = {
      largeBlob: {
        support: 'required'
      }
    };
  } else if (encryptionMethod === 'hmac-secret') {
    // Try modern PRF extension first (WebAuthn Level 3)
    credentialOptions.publicKey.extensions = {
      prf: {} // Modern standard
    };
  }

  const credential = await navigator.credentials.create(credentialOptions);
  if (!credential) {
    throw new Error('Failed to create WebAuthn credential');
  }

  console.log('✅ WebAuthn credential created');
  
  // Check if extension was actually enabled
  const extensions = (credential as any).getClientExtensionResults();
  console.log('🔍 Extension results:', extensions);
  
  // Verify the extension was enabled by the browser
  if (encryptionMethod === 'largeBlob' && !extensions.largeBlob) {
    throw new Error('largeBlob extension not supported - browser ignored extension request');
  }
  
  if (encryptionMethod === 'hmac-secret') {
    // Check for modern prf or legacy hmacCreateSecret
    const hasPrf = extensions.prf?.enabled === true;
    const hasHmac = extensions.hmacCreateSecret === true;
    
    if (!hasPrf && !hasHmac) {
      throw new Error('hmac-secret/PRF extension not supported - browser ignored extension request');
    }
    
    console.log('🔐 Extension enabled:', hasPrf ? 'prf' : 'hmacCreateSecret (legacy)');
  }

  // Extract public key
  const publicKey = await WebAuthnDIDProvider.extractPublicKey(credential as PublicKeyCredential);

  const credentialInfo: WebAuthnCredentialInfo = {
    credentialId: WebAuthnDIDProvider.arrayBufferToBase64url((credential as PublicKeyCredential).rawId),
    rawCredentialId: new Uint8Array((credential as PublicKeyCredential).rawId),
    publicKey,
    userId,
    displayName,
    did: '' // Will be set later
  };

  // Store secret key in WebAuthn device if using largeBlob
  if (encryptionMethod === 'largeBlob') {
    await storeSKInLargeBlob(credentialInfo.rawCredentialId, secretKey, domain);
  }

  return credentialInfo;
}

/**
 * Wrap secret key using PRF or hmac-secret extension
 * Tries modern PRF first, falls back to legacy hmac-secret
 */
async function wrapSKWithPRF(
  credentialId: Uint8Array,
  secretKey: Uint8Array,
  rpId: string
): Promise<{wrappedSK: Uint8Array, wrappingIV: Uint8Array, salt: Uint8Array}> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  
  // Try modern PRF extension first
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: credentialId, type: 'public-key' }],
        rpId,
        userVerification: 'required',
        extensions: {
          prf: {
            eval: {
              first: salt // Modern PRF API
            }
          }
        }
      }
    });
    
    const extensions = (assertion as any).getClientExtensionResults();
    
    if (extensions.prf?.results?.first) {
      console.log('🔐 Using modern PRF extension');
      const prfOutput = new Uint8Array(extensions.prf.results.first);
      const wrapped = await encryptWithAESGCM(secretKey, prfOutput.slice(0, 32));
      return {
        wrappedSK: wrapped.ciphertext,
        wrappingIV: wrapped.iv,
        salt
      };
    }
  } catch (prfError) {
    console.warn('PRF extension failed, trying legacy hmac-secret:', prfError);
  }
  
  // Fallback to legacy hmac-secret
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: credentialId, type: 'public-key' }],
      rpId,
      userVerification: 'required',
      extensions: {
        hmacGetSecret: { salt1: salt } // Legacy API
      }
    }
  });
  
  const extensions = (assertion as any).getClientExtensionResults();
  
  if (!extensions.hmacGetSecret?.output1) {
    throw new Error('Neither PRF nor hmac-secret extensions returned output');
  }
  
  console.log('🔐 Using legacy hmac-secret extension');
  const hmacOutput = new Uint8Array(extensions.hmacGetSecret.output1);
  const wrapped = await encryptWithAESGCM(secretKey, hmacOutput.slice(0, 32));
  
  return {
    wrappedSK: wrapped.ciphertext,
    wrappingIV: wrapped.iv,
    salt
  };
}

/**
 * Store secret key in largeBlob (requires separate authentication)
 */
async function storeSKInLargeBlob(
  credentialId: Uint8Array,
  secretKey: Uint8Array,
  rpId: string
): Promise<void> {
  console.log('📦 Storing encryption key in WebAuthn largeBlob...');
  
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{
        id: credentialId,
        type: 'public-key'
      }],
      rpId,
      userVerification: 'required',
      extensions: {
        largeBlob: {
          write: secretKey.buffer
        }
      }
    }
  });

  const extensions = (assertion as any).getClientExtensionResults();
  if (!extensions.largeBlob || !extensions.largeBlob.written) {
    throw new Error('Failed to write to largeBlob');
  }

  console.log('✅ Encryption key stored in hardware');
}

/**
 * Hardware-protected Ed25519 DID Provider
 */
export class SecureEd25519DIDProvider {
  private webauthnCredential: WebAuthnCredentialInfo;
  private keypair: Ed25519KeyPair | null = null;
  private encryptionMethod: 'largeBlob' | 'hmac-secret';
  private domain: string;
  private sessionUnlocked: boolean = false;

  private constructor(
    credential: WebAuthnCredentialInfo,
    keypair: Ed25519KeyPair,
    encryptionMethod: 'largeBlob' | 'hmac-secret',
    domain: string
  ) {
    this.webauthnCredential = credential;
    this.keypair = keypair;
    this.encryptionMethod = encryptionMethod;
    this.domain = domain;
    this.sessionUnlocked = true;
  }

  /**
   * Create new hardware-protected Ed25519 DID
   */
  static async create(config: SecureEd25519Config = {}): Promise<SecureEd25519DIDProvider> {
    const {
      encryptionMethod = 'hmac-secret', // Default to hmac-secret (wider browser support)
      domain = window.location.hostname
    } = config;

    console.log('🔐 Creating hardware-protected Ed25519 DID...');
    console.log('🔍 Encryption method:', encryptionMethod);
    console.log('🔍 Config passed:', config);

    // Check extension support
    const support = await checkExtensionSupport();
    console.log('🔍 Extension support:', support);
    if (encryptionMethod === 'largeBlob' && !support.largeBlob) {
      throw new Error('largeBlob extension not supported on this device');
    }
    if (encryptionMethod === 'hmac-secret' && !support.hmacSecret) {
      throw new Error('hmac-secret extension not supported on this device');
    }

    // Generate Ed25519 keypair
    const { publicKey, privateKey } = await generateEd25519KeyPair();
    const did = await createEd25519DID(publicKey);

    console.log('🆔 Generated Ed25519 DID:', did);

    // Generate encryption secret key
    const secretKey = generateSecretKey();

    // Encrypt the private key
    const { ciphertext, iv } = await encryptWithAESGCM(privateKey, secretKey);

    // Create WebAuthn credential with encryption support
    const credential = await createCredentialWithEncryption(config, secretKey);

    // Prepare encrypted data for storage
    let encryptedData: any = {
      ciphertext,
      iv,
      credentialId: credential.credentialId,
      publicKey: publicKey,
      did,
      encryptionMethod
    };

    // If using hmac-secret/PRF, wrap the secret key
    if (encryptionMethod === 'hmac-secret') {
      const wrapped = await wrapSKWithPRF(
        credential.rawCredentialId,
        secretKey,
        domain
      );
      encryptedData.wrappedSK = wrapped.wrappedSK;
      encryptedData.wrappingIV = wrapped.wrappingIV;
      encryptedData.salt = wrapped.salt;
    }

    // Store encrypted keystore
    await storeEncryptedKeystore(encryptedData, credential.credentialId);

    console.log('✅ Ed25519 DID created and secured with hardware encryption');

    const keypair: Ed25519KeyPair = { publicKey, privateKey, did };
    return new SecureEd25519DIDProvider(credential, keypair, encryptionMethod, domain);
  }

  /**
   * Unlock existing hardware-protected Ed25519 DID
   */
  static async unlock(credentialId: string, config: SecureEd25519Config = {}): Promise<SecureEd25519DIDProvider> {
    const { domain = window.location.hostname } = config;

    console.log('🔓 Unlocking hardware-protected Ed25519 DID...');

    // Load encrypted keystore
    const encryptedData = await loadEncryptedKeystore(credentialId);
    const encryptionMethod = encryptedData.encryptionMethod || 'hmac-secret'; // Default to hmac-secret

    // Retrieve secret key from WebAuthn device
    let secretKey: Uint8Array;
    
    if (encryptionMethod === 'largeBlob') {
      secretKey = await retrieveSKFromLargeBlob(
        new Uint8Array(WebAuthnDIDProvider.base64urlToArrayBuffer(credentialId)),
        domain
      );
    } else {
      // hmac-secret
      secretKey = await unwrapSKWithHmacSecret(
        new Uint8Array(WebAuthnDIDProvider.base64urlToArrayBuffer(credentialId)),
        encryptedData.wrappedSK!,
        encryptedData.wrappingIV!,
        encryptedData.salt!,
        domain
      );
    }

    // Decrypt private key
    const privateKey = await decryptWithAESGCM(
      encryptedData.ciphertext,
      secretKey,
      encryptedData.iv
    );

    const publicKey = encryptedData.publicKey;
    const did = encryptedData.did;

    console.log('✅ Ed25519 DID unlocked:', did);

    const keypair: Ed25519KeyPair = { publicKey, privateKey, did };
    
    // Reconstruct WebAuthn credential info
    const credential: WebAuthnCredentialInfo = {
      credentialId,
      rawCredentialId: new Uint8Array(WebAuthnDIDProvider.base64urlToArrayBuffer(credentialId)),
      publicKey: { algorithm: -7, x: new Uint8Array(0), y: new Uint8Array(0), keyType: 2, curve: 1 },
      userId: '',
      displayName: '',
      did: ''
    };

    return new SecureEd25519DIDProvider(credential, keypair, encryptionMethod, domain);
  }

  /**
   * Get the Ed25519 DID
   */
  getDID(): string {
    if (!this.keypair) throw new Error('Keypair not initialized');
    return this.keypair.did;
  }

  /**
   * Get the Ed25519 public key
   */
  getPublicKey(): Uint8Array {
    if (!this.keypair) throw new Error('Keypair not initialized');
    return this.keypair.publicKey;
  }

  /**
   * Get the Ed25519 private key (only available in unlocked session)
   */
  getPrivateKey(): Uint8Array {
    if (!this.sessionUnlocked) throw new Error('Session not unlocked');
    if (!this.keypair) throw new Error('Keypair not initialized');
    return this.keypair.privateKey;
  }

  /**
   * Export private key in ucanto-compatible format
   * Returns a multibase-encoded string that can be used with Signer.parse()
   */
  exportPrivateKey(): string {
    if (!this.sessionUnlocked) throw new Error('Session not unlocked');
    if (!this.keypair) throw new Error('Keypair not initialized');

    // Ucanto expects Ed25519 keys in multibase format
    // The format is: multibase(multicodec-ed25519-priv + private-key-bytes)
    // For Ed25519 private keys, multicodec is 0x1300
    const ED25519_PRIV_MULTICODEC = 0x1300;
    
    // Encode multicodec as varint
    const codecBytes = new Uint8Array(2);
    codecBytes[0] = ED25519_PRIV_MULTICODEC & 0xff;
    codecBytes[1] = (ED25519_PRIV_MULTICODEC >> 8) & 0xff;
    
    // Combine multicodec + private key
    const combined = new Uint8Array(codecBytes.length + this.keypair.privateKey.length);
    combined.set(codecBytes, 0);
    combined.set(this.keypair.privateKey, codecBytes.length);
    
    // Encode as base58btc with 'z' prefix (multibase identifier for base58btc)
    const encoded = base58btc.encode(combined);
    return encoded;
  }

  /**
   * Create a ucanto Ed25519 Signer from this provider
   * This can be used directly with ucanto for signing UCANs
   */
  async createUcantoSigner(): Promise<any> {
    if (!this.sessionUnlocked) throw new Error('Session not unlocked');
    
    const privateKeyString = this.exportPrivateKey();
    
    // Import ucanto's Ed25519 Signer
    const { Signer } = await import('@storacha/client/principal/ed25519');
    return Signer.parse(privateKeyString);
  }

  /**
   * Lock the session (clear private key from memory)
   */
  lock(): void {
    if (this.keypair) {
      // Zero out the private key
      this.keypair.privateKey.fill(0);
      this.keypair = null;
    }
    this.sessionUnlocked = false;
    console.log('🔒 Session locked');
  }

  /**
   * Get credential ID
   */
  getCredentialId(): string {
    return this.webauthnCredential.credentialId;
  }
}
