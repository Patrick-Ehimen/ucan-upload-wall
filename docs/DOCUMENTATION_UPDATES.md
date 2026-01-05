# Documentation Updates - WebAuthn PRF Implementation

**Date:** January 5, 2026  
**Reason:** Correcting documentation to reflect PRF seed storage in localStorage

---

## Summary of Changes

Following the implementation of WebAuthn PRF extension support, the documentation has been updated to accurately reflect that **PRF seeds are now stored in localStorage** for better UX, rather than being purely ephemeral.

---

## Files Updated

### 1. `KEYSTORE_ARCHITECTURE.md`

#### Changes Made:

**A. Storage Model Diagram (Lines 23-62)**
- ✅ Added "Store PRF Seed in localStorage" step
- ✅ Noted that PRF output is ephemeral (only exists during auth)
- ✅ Updated final storage box to show `WEBAUTHN_CREDENTIAL` includes `prfSeed`

**B. Lifecycle: First Use - Step 2 (Lines 142-149)**
- ✅ Changed from "Extract PRF Seed" to "Extract and Store PRF Seed"
- ✅ Added code showing storage of `prfSeed` and `prfSource` in localStorage
- ✅ Shows use of `getPrfSeed()` helper with fallback logic

**C. Lifecycle: Subsequent Use - Step 1 (Lines 188-202)**
- ✅ Changed from "Authenticate with WebAuthn" to "Load Stored PRF Seed"
- ✅ Shows loading from localStorage (no biometric prompt needed)
- ✅ Shows deserialization of Uint8Array from stored data
- ✅ Added note explaining seed was captured during initial auth

**D. Storage Keys Reference (Lines 300-323)**
- ✅ Added detailed comment showing PRF fields in `WEBAUTHN_CREDENTIAL`
- ✅ Explicitly lists: `prfInput`, `prfSeed`, `prfSource`

**E. New Section: PRF Seed Storage Strategy (Lines 297-341)**
- ✅ Explains why we store PRF seed (ephemeral nature)
- ✅ Trade-off analysis: UX vs. security
- ✅ Mitigation strategies
- ✅ Future plan: WebAuthn largeBlob

**F. Security Properties - Limitations (Lines 359-379)**
- ✅ **NEW #1:** Added PRF seed storage as primary limitation
- ✅ Updated XSS concern to note PRF seed is also accessible
- ✅ Reordered to prioritize new storage concern

**G. FAQ Updates**

1. **"Is the PRF seed stored anywhere?"** (Lines 368-382)
   - ❌ Old: "No. The PRF seed is ephemeral..."
   - ✅ New: "Yes (as of WebAuthn PRF implementation)..."
   - Added: Detailed explanation of what's stored and why
   - Added: Security note about trade-offs

2. **"Why not store the AES key?"** (Lines 394-402)
   - ✅ Updated to acknowledge PRF seed IS stored
   - ✅ Explains why we don't ALSO store derived AES key
   - ✅ Notes that XSS can derive AES anyway if they have seed

3. **"What if someone steals encrypted archive?"** (Lines 404-422)
   - ❌ Old: "They can't decrypt without AES key..."
   - ✅ New: Explicitly states attacker can decrypt if they have localStorage
   - ✅ Lists step-by-step what attacker can do
   - ✅ Explains what protection remains
   - ✅ Acknowledges this is a conscious UX trade-off

---

## Why These Changes Were Necessary

### The Problem
The original documentation stated the PRF seed was "ephemeral" and only existed in memory during sessions. This was **technically incorrect** after implementing the PRF extension support.

### What Actually Happens
1. PRF extension output IS ephemeral (only available during credential operation)
2. BUT we capture and store it in localStorage
3. This allows page reloads without biometric prompts
4. Trade-off: Better UX, but localStorage-based security model

### Security Implications Clarified

**Before (Incorrect Understanding):**
- PRF seed only in memory → Hardware-protected
- localStorage only has encrypted data → Can't decrypt without hardware

**After (Correct Understanding):**
- PRF seed in localStorage → Accessible to XSS
- localStorage has both encrypted archive AND decryption seed
- XSS can decrypt Ed25519 keys
- Protection comes from: CSP, initial WebAuthn auth, physical device security

---

## Related Documentation

### Already Accurate:
- ✅ `WEBAUTHN_PRF_IMPLEMENTATION.md` - Correctly describes PRF seed storage (lines 213-234)
- ✅ `SECURE_CREDENTIAL_STORAGE.md` - Future proposal, doesn't describe current implementation

### Updated:
- ✅ `KEYSTORE_ARCHITECTURE.md` - Now accurately reflects PRF seed storage

---

## Implementation References

The actual implementation can be found in:
- `web/src/lib/webauthn-did.ts` - PRF seed capture and storage
- `web/src/lib/ucan-delegation.ts` - PRF seed deserialization and use
- `web/src/types/orbitdb-webauthn.d.ts` - Type definitions

---

## Future Improvements

As noted in the documentation, the long-term plan is to migrate to **WebAuthn largeBlob** storage:
- Hardware-encrypted by authenticator
- Requires biometric to access
- Not accessible to XSS
- See `SECURE_CREDENTIAL_STORAGE.md` for details

---

## Verification Checklist

- [x] Storage model diagram updated
- [x] Lifecycle sections corrected
- [x] Storage keys reference updated
- [x] New PRF Storage Strategy section added
- [x] Security limitations updated
- [x] All relevant FAQs corrected
- [x] Cross-references to other docs verified
- [x] Security trade-offs clearly explained

---

**Review Status:** ✅ Complete  
**Accuracy:** ✅ Verified against implementation  
**Next Review:** When implementing largeBlob migration

