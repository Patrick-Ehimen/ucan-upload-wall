# 🔐 Implement Hardware-Protected Encrypted Keystore for Ed25519 DID

## 🚨 Security Issue

**Current State:** Ed25519 private keys are stored **unencrypted** in localStorage, making them vulnerable to:
- ❌ XSS attacks that can exfiltrate the private key
- ❌ Malicious browser extensions reading localStorage
- ❌ Physical device access (anyone can read localStorage)
- ❌ Any script with localStorage access can steal keys

**Evidence:**
```typescript
// web/src/lib/ucan-delegation.ts:120
localStorage.setItem(STORAGE_KEYS.ED25519_KEYPAIR, JSON.stringify(keypair));
// Stores private key as plaintext hex string!
```

## 🎯 Objective

Implement hardware-protected encryption using WebAuthn extensions (largeBlob/hmac-secret) to:
- ✅ Encrypt private keys at rest with AES-GCM 256-bit
- ✅ Store encryption key in WebAuthn authenticator hardware
- ✅ Require biometric authentication to unlock keys
- ✅ Prevent automatic file loading without authentication
- ✅ Protect against XSS, malicious extensions, and physical access

## 📋 Implementation Plan

### Phase 1: Core Integration (4-6 hours) ✅ COMPLETE
**File:** `web/src/lib/ucan-delegation.ts`

- [x] Import `SecureEd25519DIDProvider` from `./secure-ed25519-did`
- [x] Add private field: `secureEd25519Provider: SecureEd25519DIDProvider | null`
- [x] Add storage key: `ENCRYPTED_KEYSTORE_CREDENTIAL_ID: 'encrypted_keystore_credential_id'`
- [x] Implement `initializeSecureEd25519DID(encryptionMethod, force)`
- [x] Add `unlockSession(): Promise<void>`
- [x] Add `lockSession(): void`
- [x] Add `isUsingEncryptedKeystore(): boolean`
- [x] Add `isSessionLocked(): boolean`
- [x] Update `getCurrentDID()` to prioritize secure provider

**Backward Compatibility:**
- Keep existing `initializeEd25519DID()` unchanged
- Add localStorage flag to track encryption status
- Provide migration path (Phase 4)

### Phase 2: Setup UI Updates (3-4 hours) ✅ COMPLETE
**File:** `web/src/components/Setup.tsx`

- [x] Add state for encryption options (useEncryption, encryptionMethod, extensionSupport)
- [x] Add `useEffect` to detect extension support using `checkExtensionSupport()`
- [x] Update `handleCreateDID()` to use encrypted or unencrypted based on user choice
- [x] Add security options UI section:
  - Checkbox for encryption toggle
  - Radio buttons for largeBlob vs hmac-secret with support status
  - Security benefits list
  - Warning for unencrypted mode
- [x] Show encryption status badge after DID creation (🔐 Hardware-Protected vs ⚠️ Unencrypted)

### Phase 3: Session Management (2-3 hours) ✅ COMPLETE
**File:** `web/src/App.tsx`

- [x] Add state: `isSessionLocked`
- [x] Add effect to check lock status on mount
- [x] Add `handleUnlockSession()` handler
- [x] Add `handleLockSession()` handler
- [x] Prevent file loading when session is locked
- [x] Show SessionLockScreen when locked
- [x] Pass lock handler to Header component

**File:** `web/src/components/SessionLockScreen.tsx` (new) ✅
- [x] Created unlock screen component with biometric UI
- [x] Unlock button with loading state
- [x] Error handling
- [x] Security benefits display

**File:** `web/src/components/Header.tsx` ✅
- [x] Add "Lock Session" button (only visible for encrypted keystores)
- [x] Add security status indicator (🔐 Hardware-Protected vs ⚠️ Unencrypted)

### Phase 4: Migration Tool (2-3 hours)
**File:** `web/src/components/SecurityMigration.tsx` (new)

- [ ] Create migration component with:
  - Detection of unencrypted Ed25519 key
  - Security warning banner
  - "Upgrade to Encrypted Keystore" button
  - Migration progress indicator
- [ ] Implement migration flow:
  ```tsx
  async function migrateToEncryptedKeystore() {
    // 1. Check for unencrypted key
    const unencrypted = localStorage.getItem('ed25519_keypair');
    if (!unencrypted) return;
    
    // 2. Create WebAuthn credential with encryption
    const provider = await SecureEd25519DIDProvider.create({ encryptionMethod });
    
    // 3. Import existing keypair (NOT IMPLEMENTED - need to add to SecureEd25519DIDProvider)
    // For now: require user to create new DID and manually migrate data
    
    // 4. Delete unencrypted version
    localStorage.removeItem('ed25519_keypair');
    
    // 5. Update service to use encrypted provider
    await delegationService.initializeSecureEd25519DID(encryptionMethod, true);
  }
  ```
- [ ] Show migration success confirmation
- [ ] Add "Export Old Key" option before migration (safety backup)

**Note:** Full automatic migration requires extending `SecureEd25519DIDProvider` to accept existing private key - consider as future enhancement.

### Phase 5: Testing (3-4 hours)
**File:** `web/tests/encrypted-keystore.spec.ts` (new)

- [ ] Test encrypted keystore creation with virtual authenticator
- [ ] Test session unlock flow
- [ ] Test session lock/unlock
- [ ] Test fallback to unencrypted when extensions not supported
- [ ] Test migration warning displays correctly
- [ ] Test file loading prevention when locked

**Manual Testing Checklist:**
- [ ] Create encrypted DID with largeBlob on macOS Safari
- [ ] Create encrypted DID with hmac-secret on Chrome
- [ ] Verify biometric prompt appears during creation
- [ ] Verify biometric prompt appears on unlock
- [ ] Verify files don't load when session locked
- [ ] Test unlock after page refresh
- [ ] Test migration warning for users with unencrypted keys
- [ ] Verify backward compatibility (unencrypted still works)
- [ ] Test on Chrome 106+, Safari 17+, Edge 106+, Firefox (fallback)

## 🏗️ Architecture

**Before (Vulnerable):**
```
localStorage: {
  "ed25519_keypair": {
    "privateKey": "a1b2c3..." // ❌ PLAINTEXT!
  }
}
```

**After (Secure):**
```
localStorage: {
  "encrypted-keystore-abc123": {
    "ciphertext": "x7y8z9...",  // ✅ AES-GCM encrypted
    "iv": "...",
    "encryptionMethod": "largeBlob"
  }
}

WebAuthn Hardware: {
  largeBlob: "secret_aes_key"  // 🔐 Protected by biometric
}
```

## 📊 Success Criteria

- [ ] Users can create encrypted Ed25519 DID with biometric protection
- [ ] Session requires biometric unlock after page refresh
- [ ] Files don't load automatically without authentication
- [ ] Migration tool successfully warns users with unencrypted keys
- [ ] Backward compatibility maintained (unencrypted still works)
- [ ] E2E tests pass for all encryption scenarios
- [ ] Browser compatibility validated on Chrome, Safari, Edge, Firefox
- [ ] Performance: unlock operation < 500ms
- [ ] Security: XSS cannot exfiltrate private key from localStorage

## 🌐 Browser Compatibility

| Extension | Chrome | Safari | Edge | Firefox |
|-----------|--------|--------|------|---------|
| **largeBlob** | ✅ 106+ | ✅ 17+ | ✅ 106+ | ❌ Not yet |
| **hmac-secret** | ✅ 86+ | ⚠️ 16+ | ✅ 86+ | ✅ 87+ |

**Fallback Strategy:**
1. Auto-detect supported method
2. Prefer: largeBlob → hmac-secret → unencrypted
3. Show clear security trade-off messaging

## ⏱️ Estimated Effort

- Phase 1: 4-6 hours
- Phase 2: 3-4 hours
- Phase 3: 2-3 hours
- Phase 4: 2-3 hours
- Phase 5: 3-4 hours

**Total: 14-20 hours**

## 🔗 References

- **Demo implementation:** `../orbitdb-identity-provider-webauthn-did/examples/ed25519-encrypted-keystore-demo`
- **Existing utilities:** 
  - `web/src/lib/keystore-encryption.ts` (already implemented ✅)
  - `web/src/lib/secure-ed25519-did.ts` (already implemented ✅)
- **WebAuthn Extensions:**
  - [largeBlob spec](https://www.w3.org/TR/webauthn-3/#sctn-large-blob-extension)
  - [hmac-secret spec](https://fidoalliance.org/specs/fido-v2.1-ps-20210615/fido-client-to-authenticator-protocol-v2.1-ps-20210615.html#sctn-hmac-secret-extension)

## 📝 Labels

`security`, `enhancement`, `high-priority`, `good-first-issue` (for documentation parts)

## 💡 Future Enhancements

- [ ] Auto-lock after inactivity (15 minutes)
- [ ] Lock on tab close/browser close
- [ ] Audit log of unlock attempts
- [ ] User education modal on first use
- [ ] Export/import encrypted keystore
- [ ] Support for importing existing unencrypted keys during migration
