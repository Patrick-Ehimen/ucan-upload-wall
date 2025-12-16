# OrbitDB WebAuthn Package Integration Guide

✅ **Package successfully installed and all exports verified!**

## Installation

The package is installed locally from the file system:

```json
{
  "dependencies": {
    "@le-space/orbitdb-identity-provider-webauthn-did": "file:../../orbitdb-identity-provider-webauthn-did"
  }
}
```

## Available Exports

### ✅ Core WebAuthn Provider

```typescript
import { 
  WebAuthnDIDProvider,
  OrbitDBWebAuthnIdentityProvider,
  OrbitDBWebAuthnIdentityProviderFunction 
} from '@le-space/orbitdb-identity-provider-webauthn-did';
```

**`WebAuthnDIDProvider`** - Main class for WebAuthn credential management:
- ✅ `static isSupported()` - Check WebAuthn support
- ✅ `static isPlatformAuthenticatorAvailable()` - Check biometric availability
- ✅ `static createCredential(options)` - Create WebAuthn credential
- ✅ `static extractPublicKey(credential)` - Extract P-256 public key
- ✅ `static createDID(credentialInfo)` - Generate did:key from P-256
- ✅ `static arrayBufferToBase64url(buffer)` - Utility
- ✅ `static base64urlToArrayBuffer(base64url)` - Utility
- ✅ `async sign(data)` - Sign with WebAuthn (requires biometric)
- ✅ `async verify(signature)` - Verify WebAuthn signature

### ✅ Credential Storage Helpers

```typescript
import { 
  storeWebAuthnCredential,
  loadWebAuthnCredential,
  clearWebAuthnCredential,
  checkWebAuthnSupport
} from '@le-space/orbitdb-identity-provider-webauthn-did';
```

### ✅ Keystore Encryption (Complete Suite)

```typescript
import { 
  KeystoreEncryption,  // Namespace with all functions
  // Or import individually:
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
```

### ✅ Verification Utilities

```typescript
import { 
  VerificationUtils  // Namespace with verification functions
} from '@le-space/orbitdb-identity-provider-webauthn-did';
```

## What We Can Use Directly

### 1. **WebAuthn Credential Creation** ✅

Replace `web/src/lib/webauthn-did.ts` with:

```typescript
import { WebAuthnDIDProvider } from '@le-space/orbitdb-identity-provider-webauthn-did';

// Use directly - much more robust than our current implementation
const credential = await WebAuthnDIDProvider.createCredential({
  userId: 'user@example.com',
  displayName: 'User Name',
  domain: window.location.hostname
});

// Get DID
const did = await WebAuthnDIDProvider.createDID(credential);
```

**Benefits over current implementation:**
- ✅ Better public key extraction with fallbacks
- ✅ Proper CBOR decoding handling
- ✅ More comprehensive error handling
- ✅ Deterministic fallback for credentials

### 2. **Encryption Utilities** ✅

Can use directly - already compatible:

```typescript
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
} from '@le-space/orbitdb-identity-provider-webauthn-did';

// These work exactly like our current implementations
// but with better error handling and logging
```

### 3. **What We DON'T Need** ❌

These are OrbitDB-specific and not needed for UCAN:

- ❌ `OrbitDBWebAuthnIdentityProvider` - OrbitDB identity system
- ❌ `OrbitDBWebAuthnIdentityProviderFunction` - OrbitDB provider registration
- ❌ `registerWebAuthnProvider` - OrbitDB integration

## Integration Strategy

### Option 1: Direct Replacement (Recommended)

Replace our implementations with OrbitDB's exports:

**Current Files → OrbitDB Imports:**

1. **`web/src/lib/webauthn-did.ts`**
   ```typescript
   // Replace entire file with:
   export { 
     WebAuthnDIDProvider,
     storeWebAuthnCredential,
     loadWebAuthnCredential,
     clearWebAuthnCredential,
     checkWebAuthnSupport
   } from '@le-space/orbitdb-identity-provider-webauthn-did';
   
   // Add TypeScript types
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
   }
   ```

2. **`web/src/lib/keystore-encryption.ts`**
   ```typescript
   // Replace entire file with re-exports:
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
   ```

3. **`web/src/lib/secure-ed25519-did.ts`**
   - Keep the Ed25519 keypair generation
   - Use OrbitDB's `WebAuthnDIDProvider.createDID()` logic for proper multicodec encoding
   - Keep ucanto integration
   - Use OrbitDB's encryption utilities

### Option 2: Gradual Migration

Keep current implementations but:
1. Import OrbitDB utilities as fallbacks
2. Test side-by-side
3. Gradually replace implementations

## Key Improvements from OrbitDB Package

### 1. Better Public Key Extraction
```javascript
// OrbitDB's extractPublicKey handles:
// - Both Map and Object CBOR formats
// - Missing attestation data flags
// - Deterministic fallback based on credential ID
// - Better error messages
```

### 2. Proper DID Generation
```javascript
// OrbitDB uses proper multicodec encoding:
// - P-256: 0x1200
// - Ed25519: 0xed
// - secp256k1: 0xe7
// With correct varint encoding and base58btc
```

### 3. Better Logging
```javascript
// Uses @libp2p/logger for structured logging
// Can be enabled with DEBUG env var
// Better debugging for WebAuthn flows
```

## Usage Example

Here's how to use the OrbitDB package in your UCAN project:

```typescript
import { WebAuthnDIDProvider } from '@le-space/orbitdb-identity-provider-webauthn-did';
import { Ed25519Signer } from '@storacha/client/principal/ed25519';

// 1. Create WebAuthn credential
const credential = await WebAuthnDIDProvider.createCredential({
  userId: 'alice@example.com',
  displayName: 'Alice'
});

// 2. Get P-256 DID
const did = await WebAuthnDIDProvider.createDID(credential);
console.log('DID:', did); // did:key:zDna...

// 3. For UCAN signing, you still need Ed25519
// (Keep your current secure-ed25519-did.ts for this)
// But use OrbitDB's encryption utilities

// 4. Use with ucanto (your existing flow)
const signer = Ed25519Signer.parse(privateKey);
const delegation = await delegate({
  issuer: signer,
  audience: targetDID,
  capabilities: [...]
});
```

## Testing Checklist

- [x] Package installs correctly
- [x] All exports are available
- [x] WebAuthnDIDProvider imports
- [x] Encryption utilities import
- [ ] Test WebAuthn credential creation in browser
- [ ] Test P-256 DID generation
- [ ] Test encryption/decryption flow
- [ ] Test largeBlob extension
- [ ] Test hmac-secret extension
- [ ] Verify ucanto integration still works
- [ ] Test UCAN delegation signing
- [ ] Test file upload with new implementation

## Next Steps

1. **Phase 1**: Replace `webauthn-did.ts` with OrbitDB exports
2. **Phase 2**: Replace `keystore-encryption.ts` with OrbitDB exports
3. **Phase 3**: Update `secure-ed25519-did.ts` to use OrbitDB's DID generation
4. **Phase 4**: Test complete flow
5. **Phase 5**: Clean up unused code

## Dependencies

Already compatible:
- ✅ `cbor-web: ^9.0.1` (both projects)
- ✅ `multiformats: ^13.0.0` (both projects)
- ✅ `vite-plugin-node-polyfills: ^0.24.0` (both projects)

New from OrbitDB:
- ✅ `@libp2p/logger: ^5.1.5` (optional, for better logging)

## Conclusion

**YES, we can import and use the OrbitDB library directly!** 

Everything we need is properly exported:
- ✅ WebAuthn credential management
- ✅ P-256 DID generation
- ✅ Encryption utilities (largeBlob, hmac-secret)
- ✅ Storage helpers
- ✅ Better error handling

The only parts we don't need are the OrbitDB-specific identity provider system, which we can simply ignore since we're using UCAN instead.
