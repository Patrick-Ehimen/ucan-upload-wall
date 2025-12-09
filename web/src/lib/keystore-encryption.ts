/**
 * Keystore Encryption Utilities
 *
 * Provides AES-GCM encryption for Ed25519 private keys,
 * protected by WebAuthn credentials using largeBlob or hmac-secret extensions.
 * 
 * Extracted and adapted from orbitdb-identity-provider-webauthn-did
 */

/**
 * Generate a random AES-GCM secret key (256-bit)
 */
export function generateSecretKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Encrypt data with AES-GCM
 */
export async function encryptWithAESGCM(
  data: Uint8Array,
  sk: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  console.log('🔐 Encrypting data with AES-GCM');

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Import secret key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    sk,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );

  console.log('✅ Encryption successful, ciphertext length:', ciphertext.byteLength);

  return {
    ciphertext: new Uint8Array(ciphertext),
    iv
  };
}

/**
 * Decrypt data with AES-GCM
 */
export async function decryptWithAESGCM(
  ciphertext: Uint8Array,
  sk: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  console.log('🔓 Decrypting data with AES-GCM');

  try {
    // Import secret key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      sk,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );

    console.log('✅ Decryption successful, plaintext length:', plaintext.byteLength);

    return new Uint8Array(plaintext);
  } catch (error) {
    console.error('❌ Decryption failed:', error);
    throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieve secret key from WebAuthn credential using largeBlob extension
 */
export async function retrieveSKFromLargeBlob(
  credentialId: Uint8Array,
  rpId: string
): Promise<Uint8Array> {
  console.log('📦 Retrieving secret key from largeBlob');

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{
          id: credentialId,
          type: 'public-key'
        }],
        rpId: rpId,
        userVerification: 'required',
        extensions: {
          largeBlob: {
            read: true
          }
        }
      }
    });

    if (!assertion) {
      throw new Error('WebAuthn assertion failed');
    }

    const extensions = (assertion as PublicKeyCredential).getClientExtensionResults();

    if (!extensions.largeBlob || !(extensions.largeBlob as any).blob) {
      throw new Error('No largeBlob data found in credential');
    }

    const sk = new Uint8Array((extensions.largeBlob as any).blob);
    console.log('✅ Retrieved secret key from largeBlob, length:', sk.length);

    return sk;
  } catch (error) {
    console.error('❌ Failed to retrieve secret key from largeBlob:', error);
    throw new Error(`Failed to retrieve secret key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Wrap secret key using hmac-secret extension
 */
export async function wrapSKWithHmacSecret(
  credentialId: Uint8Array,
  sk: Uint8Array,
  rpId: string
): Promise<{ wrappedSK: Uint8Array; wrappingIV: Uint8Array; salt: Uint8Array }> {
  console.log('🔐 Wrapping secret key with hmac-secret');

  const salt = crypto.getRandomValues(new Uint8Array(32));

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{
          id: credentialId,
          type: 'public-key'
        }],
        rpId: rpId,
        userVerification: 'required',
        extensions: {
          hmacGetSecret: {
            salt1: salt
          }
        }
      }
    });

    if (!assertion) {
      throw new Error('WebAuthn assertion failed');
    }

    const extensions = (assertion as PublicKeyCredential).getClientExtensionResults();

    if (!(extensions as any).hmacGetSecret || !(extensions as any).hmacGetSecret.output1) {
      throw new Error('No hmac-secret output from credential');
    }

    const hmacOutput = new Uint8Array((extensions as any).hmacGetSecret.output1);

    // Use HMAC output as wrapping key
    const wrappedSK = await encryptWithAESGCM(sk, hmacOutput.slice(0, 32));

    console.log('✅ Secret key wrapped with hmac-secret');

    return {
      wrappedSK: wrappedSK.ciphertext,
      wrappingIV: wrappedSK.iv,
      salt
    };
  } catch (error) {
    console.error('❌ Failed to wrap secret key with hmac-secret:', error);
    throw new Error(`Failed to wrap secret key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Unwrap secret key using hmac-secret extension
 */
export async function unwrapSKWithHmacSecret(
  credentialId: Uint8Array,
  wrappedSK: Uint8Array,
  wrappingIV: Uint8Array,
  salt: Uint8Array,
  rpId: string
): Promise<Uint8Array> {
  console.log('🔓 Unwrapping secret key with hmac-secret');

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{
          id: credentialId,
          type: 'public-key'
        }],
        rpId: rpId,
        userVerification: 'required',
        extensions: {
          hmacGetSecret: {
            salt1: salt
          }
        }
      }
    });

    if (!assertion) {
      throw new Error('WebAuthn assertion failed');
    }

    const extensions = (assertion as PublicKeyCredential).getClientExtensionResults();

    if (!(extensions as any).hmacGetSecret || !(extensions as any).hmacGetSecret.output1) {
      throw new Error('No hmac-secret output from credential');
    }

    const hmacOutput = new Uint8Array((extensions as any).hmacGetSecret.output1);

    // Unwrap with HMAC output
    const sk = await decryptWithAESGCM(wrappedSK, hmacOutput.slice(0, 32), wrappingIV);

    console.log('✅ Secret key unwrapped with hmac-secret');

    return sk;
  } catch (error) {
    console.error('❌ Failed to unwrap secret key with hmac-secret:', error);
    throw new Error(`Failed to unwrap secret key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Store encrypted keystore data in localStorage
 */
export async function storeEncryptedKeystore(
  data: {
    ciphertext: Uint8Array;
    iv: Uint8Array;
    credentialId: string;
    publicKey: Uint8Array;
    did: string;
    encryptionMethod: 'largeBlob' | 'hmac-secret';
    wrappedSK?: Uint8Array;
    wrappingIV?: Uint8Array;
    salt?: Uint8Array;
  },
  credentialId: string
): Promise<void> {
  console.log('💾 Storing encrypted keystore in localStorage');

  const storageKey = `encrypted-keystore-${credentialId}`;

  const serializedData = {
    ciphertext: Array.from(data.ciphertext),
    iv: Array.from(data.iv),
    credentialId: data.credentialId,
    publicKey: Array.from(data.publicKey),
    did: data.did,
    wrappedSK: data.wrappedSK ? Array.from(data.wrappedSK) : undefined,
    wrappingIV: data.wrappingIV ? Array.from(data.wrappingIV) : undefined,
    salt: data.salt ? Array.from(data.salt) : undefined,
    encryptionMethod: data.encryptionMethod,
    timestamp: Date.now()
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(serializedData));
    console.log('✅ Encrypted keystore stored successfully');
  } catch (error) {
    console.error('❌ Failed to store encrypted keystore:', error);
    throw new Error(`Failed to store encrypted keystore: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load encrypted keystore data from localStorage
 */
export async function loadEncryptedKeystore(credentialId: string): Promise<{
  ciphertext: Uint8Array;
  iv: Uint8Array;
  credentialId: string;
  publicKey: Uint8Array;
  did: string;
  wrappedSK?: Uint8Array;
  wrappingIV?: Uint8Array;
  salt?: Uint8Array;
  encryptionMethod: 'largeBlob' | 'hmac-secret';
  timestamp: number;
}> {
  console.log('📂 Loading encrypted keystore from localStorage');

  const storageKey = `encrypted-keystore-${credentialId}`;

  try {
    const stored = localStorage.getItem(storageKey);

    if (!stored) {
      throw new Error('No encrypted keystore found for this credential');
    }

    const data = JSON.parse(stored);

    const deserialized = {
      ciphertext: new Uint8Array(data.ciphertext),
      iv: new Uint8Array(data.iv),
      credentialId: data.credentialId,
      publicKey: new Uint8Array(data.publicKey),
      did: data.did,
      wrappedSK: data.wrappedSK ? new Uint8Array(data.wrappedSK) : undefined,
      wrappingIV: data.wrappingIV ? new Uint8Array(data.wrappingIV) : undefined,
      salt: data.salt ? new Uint8Array(data.salt) : undefined,
      encryptionMethod: data.encryptionMethod || 'largeBlob',
      timestamp: data.timestamp
    };

    console.log('✅ Encrypted keystore loaded successfully');

    return deserialized;
  } catch (error) {
    console.error('❌ Failed to load encrypted keystore:', error);
    throw new Error(`Failed to load encrypted keystore: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clear encrypted keystore from storage
 */
export async function clearEncryptedKeystore(credentialId: string): Promise<void> {
  console.log('🗑️ Clearing encrypted keystore from storage');

  const storageKey = `encrypted-keystore-${credentialId}`;

  try {
    localStorage.removeItem(storageKey);
    console.log('✅ Encrypted keystore cleared successfully');
  } catch (error) {
    console.error('❌ Failed to clear encrypted keystore:', error);
  }
}

/**
 * Check if browser supports WebAuthn extensions
 */
export async function checkExtensionSupport(): Promise<{
  largeBlob: boolean;
  hmacSecret: boolean;
}> {
  const support = {
    largeBlob: false,
    hmacSecret: false
  };

  if (!window.PublicKeyCredential) {
    return support;
  }

  try {
    // Check largeBlob support
    if (window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      // largeBlob is available in Chrome 106+, Edge 106+
      support.largeBlob = available && 'largeBlob' in PublicKeyCredential.prototype;
    }

    // hmac-secret is more widely supported but harder to detect
    // Assume support if WebAuthn is available (will fail gracefully if not)
    support.hmacSecret = true;

  } catch (error) {
    console.error('Failed to check extension support:', error);
  }

  return support;
}
