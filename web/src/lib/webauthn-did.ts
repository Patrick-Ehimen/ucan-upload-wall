/**
 * WebAuthn DID Provider
 * 
 * Re-exports from @le-space/orbitdb-identity-provider-webauthn-did
 * Using the battle-tested OrbitDB implementation for better reliability
 */

import {
  WebAuthnDIDProvider as OrbitDBWebAuthnDIDProvider,
  checkWebAuthnSupport,
  storeWebAuthnCredential,
  loadWebAuthnCredential as orbitdbLoadWebAuthnCredential,
  clearWebAuthnCredential
} from '@le-space/orbitdb-identity-provider-webauthn-did';

// Re-export unchanged functions
export { 
  checkWebAuthnSupport,
  storeWebAuthnCredential,
  clearWebAuthnCredential
};

// Wrapper for loadWebAuthnCredential that returns our extended type
export function loadWebAuthnCredential(key?: string): WebAuthnCredentialInfo | null {
  const cred = orbitdbLoadWebAuthnCredential(key);
  if (!cred) return null;
  // Cast to our extended type (prfInput and prfSource may be present)
  return cred as WebAuthnCredentialInfo;
}

// TypeScript type definitions (OrbitDB is JavaScript)
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
  did?: string;
  prfInput?: Uint8Array;        // PRF input/salt for deterministic key derivation
  prfSeed?: Uint8Array;         // Actual PRF output seed (stored for later use)
  prfSource?: 'prf' | 'credentialId';  // Track which method was used
}

/**
 * Extended WebAuthn DID Provider with compatibility methods
 * Wraps OrbitDB's provider and adds methods needed by our code
 */
export class WebAuthnDIDProvider extends OrbitDBWebAuthnDIDProvider {
  public did: string;

  constructor(credentialInfo: WebAuthnCredentialInfo) {
    super(credentialInfo);
    this.did = credentialInfo.did || '';
  }

  /**
   * Extract PRF seed from WebAuthn credential with fallback to rawCredentialId
   * Returns the seed and which source was used
   */
  static async getPrfSeed(
    credential: PublicKeyCredential | null,
    rawCredentialId: Uint8Array
  ): Promise<{ seed: Uint8Array; source: 'prf' | 'credentialId' }> {
    // Try to get PRF extension result
    if (credential) {
      try {
        const extensions = credential.getClientExtensionResults();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prfResults = (extensions as any).prf;
        if (prfResults?.results?.first) {
          console.log('✅ Using WebAuthn PRF extension for key derivation');
          return {
            seed: new Uint8Array(prfResults.results.first),
            source: 'prf'
          };
        }
      } catch (error) {
        console.warn('⚠️ Error reading PRF extension results:', error);
      }
    }

    // Fallback to rawCredentialId
    console.log('ℹ️ PRF extension not available, using rawCredentialId for key derivation');
    return {
      seed: rawCredentialId,
      source: 'credentialId'
    };
  }

  /**
   * Try to authenticate with an existing credential first, create new if none exists
   * Compatibility method for our existing code
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
        console.log('🔓 Attempting to authenticate with existing credential');
        
        // Try to load stored credential info to get prfInput
        const storedCred = loadWebAuthnCredential();
        const prfInput = storedCred?.prfInput;
        
        const existingCredInfo = await this.authenticateWithExistingCredential(
          existingCredentialId,
          domain,
          prfInput
        );
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
    return this.createCredentialWithPRF({ userId, displayName, domain });
  }

  /**
   * Create WebAuthn credential with PRF extension support
   */
  static async createCredentialWithPRF(options: {
    userId?: string;
    displayName?: string;
    domain?: string;
  }): Promise<WebAuthnCredentialInfo> {
    const {
      userId = 'ucan-upload-wall-user',
      displayName = 'UCAN Upload Wall User',
      domain = window.location.hostname
    } = options;

    if (!this.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    // Generate random PRF input (salt) for deterministic key derivation
    const prfInput = crypto.getRandomValues(new Uint8Array(32));

    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'UCAN Upload Wall', id: domain },
          user: {
            id: new TextEncoder().encode(userId),
            name: userId,
            displayName
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },   // ES256 (P-256)
            { type: 'public-key', alg: -257 }  // RS256 fallback
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred'
          },
          timeout: 60000,
          // Request PRF extension
          extensions: {
            prf: {
              eval: { first: prfInput }
            }
          }
        }
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create WebAuthn credential');
      }

      console.log('✅ WebAuthn credential created successfully');

      // Extract public key using OrbitDB's method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const publicKey = await this.extractPublicKey(credential) as any;

      // Get PRF seed (with fallback to rawCredentialId)
      const { seed: prfSeed, source } = await this.getPrfSeed(
        credential,
        new Uint8Array(credential.rawId)
      );

      const credentialInfo: WebAuthnCredentialInfo = {
        credentialId: this.arrayBufferToBase64url(credential.rawId),
        rawCredentialId: new Uint8Array(credential.rawId),
        publicKey,
        userId,
        displayName,
        prfInput: source === 'prf' ? prfInput : undefined,
        prfSeed: prfSeed,  // Store the actual PRF output seed
        prfSource: source
      };

      // Generate DID using OrbitDB's method
      credentialInfo.did = await this.createDID(credentialInfo);

      console.log('🔑 Created DID:', credentialInfo.did);
      console.log('🔐 PRF source:', source);

      return credentialInfo;
    } catch (error) {
      const err = error as Error;
      console.error('Failed to create WebAuthn credential:', err);
        throw new Error(`WebAuthn credential creation failed: ${err.message}`);
    }
  }

  /**
   * Helper to get PRF seed from credential info
   * This is used when we need to extract the PRF seed for key derivation
   */
  static async extractPrfSeed(credentialInfo: WebAuthnCredentialInfo): Promise<Uint8Array> {
    // If we have a stored PRF seed, use it
    if (credentialInfo.prfSeed) {
      console.log('✅ Using stored PRF seed', {
        source: credentialInfo.prfSource,
        seedLength: credentialInfo.prfSeed.length
      });
      return credentialInfo.prfSeed;
    }
    
    // Fallback to rawCredentialId for legacy credentials
    console.log('ℹ️ Using rawCredentialId as PRF seed (legacy credential or no PRF available)');
    return credentialInfo.rawCredentialId;
  }

  /**
   * Authenticate with an existing WebAuthn credential and reconstruct DID
   * Compatibility method for our existing code - now with PRF support
   */
  static async authenticateWithExistingCredential(
    credentialId: string,
    domain: string = window.location.hostname,
    prfInput?: Uint8Array
  ): Promise<WebAuthnCredentialInfo | null> {
    if (!this.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const credentialIdBuffer = this.base64urlToArrayBuffer(credentialId);

      // Use stored PRF input if available, otherwise use a fixed value
      // (PRF will fail if input doesn't match, but we'll fallback to rawCredentialId)
      const prfEval = (prfInput || crypto.getRandomValues(new Uint8Array(32))) as BufferSource;

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            id: credentialIdBuffer,
            type: 'public-key'
          }],
          userVerification: 'required',
          timeout: 60000,
          rpId: domain,
          // Request PRF extension
          extensions: {
            prf: {
              eval: { first: prfEval }
            }
          }
        }
      }) as PublicKeyCredential;

      if (!assertion) {
        return null;
      }

      console.log('🔐 WebAuthn authentication successful');

      // Get PRF seed (with fallback to rawCredentialId)
      const { seed: prfSeed, source } = await this.getPrfSeed(
        assertion,
        new Uint8Array(credentialIdBuffer)
      );

      // Reconstruct credential info deterministically
      const reconstructedCredInfo = await this.reconstructCredentialFromAssertion(
        assertion,
        credentialId
      );

      // Add PRF metadata
      reconstructedCredInfo.prfInput = prfInput;
      reconstructedCredInfo.prfSeed = prfSeed;  // Store the actual PRF output seed
      reconstructedCredInfo.prfSource = source;

      console.log('🔐 PRF source:', source);

      return reconstructedCredInfo;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    _assertion: PublicKeyCredential,
    credentialId: string
  ): Promise<WebAuthnCredentialInfo> {
    const credentialIdBuffer = this.base64urlToArrayBuffer(credentialId);
    const hash = await crypto.subtle.digest('SHA-256', credentialIdBuffer);
    const seed = new Uint8Array(hash);

    const yData = new Uint8Array(credentialIdBuffer.byteLength + 4);
    yData.set(new Uint8Array(credentialIdBuffer), 0);
    yData.set([0x59, 0x43, 0x4F, 0x4F], credentialIdBuffer.byteLength);
    const yHash = await crypto.subtle.digest('SHA-256', yData);
    const ySeed = new Uint8Array(yHash);

    const publicKey = {
      algorithm: -7,
      x: seed.slice(0, 32),
      y: ySeed.slice(0, 32),
      keyType: 2,
      curve: 1
    };

    const credentialInfo = {
      credentialId,
      rawCredentialId: new Uint8Array(credentialIdBuffer),
      publicKey,
      userId: 'ucan-upload-wall-user',
      displayName: 'UCAN Upload Wall User',
      did: ''
    };

    // Generate DID using OrbitDB's method
    credentialInfo.did = await this.createDID(credentialInfo);

    return credentialInfo;
  }

  /**
   * Authenticate using WebAuthn (for compatibility with existing code)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async authenticate(): Promise<any> {
    if (!WebAuthnDIDProvider.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            id: this.rawCredentialId as BufferSource,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('WebAuthn authentication failed:', error);

      if (error.name === 'NotAllowedError') {
        throw new Error('Biometric authentication was cancelled');
      } else {
        throw new Error(`WebAuthn authentication error: ${error.message}`);
      }
    }
  }
}
