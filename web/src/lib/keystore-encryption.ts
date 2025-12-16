/**
 * Keystore Encryption Utilities
 *
 * Re-exports from @le-space/orbitdb-identity-provider-webauthn-did
 * Provides AES-GCM encryption for Ed25519 private keys,
 * protected by WebAuthn credentials using largeBlob or hmac-secret extensions.
 */

// Re-export all encryption utilities from OrbitDB package
export {
  generateSecretKey,
  encryptWithAESGCM,
  decryptWithAESGCM,
  retrieveSKFromLargeBlob,
  wrapSKWithHmacSecret,
  unwrapSKWithHmacSecret,
  storeEncryptedKeystore,
  loadEncryptedKeystore,
  clearEncryptedKeystore,
  checkExtensionSupport
} from '@le-space/orbitdb-identity-provider-webauthn-did';
