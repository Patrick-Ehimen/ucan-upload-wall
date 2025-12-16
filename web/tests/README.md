# E2E Tests

## Overview

This directory contains end-to-end tests for the UCAN Upload Wall application.

## Test Files

### `encrypted-keystore.spec.ts` ✅ **NEW - RECOMMENDED**
**Focus:** Hardware-protected encrypted keystore functionality

Tests the core security features:
- Creating encrypted Ed25519 DID with biometric
- Session lock/unlock flow after page refresh
- Manual session locking via header button
- Fallback to unencrypted mode
- Extension support detection

**Run:** `npm run test:e2e -- encrypted-keystore`

**Why these tests:**
- Focused on the encrypted keystore feature
- Use virtual WebAuthn authenticator (no real biometric needed)
- Fast (30-60 seconds total)
- Test the security flow users will actually use
- Don't require real Storacha credentials

### `alice-bob-*.spec.ts` ⚠️ **LEGACY - NEEDS REWRITE**

The Alice/Bob tests are currently skipped/incomplete. They need to be rewritten to:
- Use the new encrypted keystore
- Mock Storacha API calls instead of requiring real credentials
- Be simpler and more maintainable (currently 500-700 lines each)

## Running Tests

```bash
# Run new encrypted keystore tests only
npm run test:e2e -- encrypted-keystore

# Run with browser visible
HEADLESS=false npm run test:e2e -- encrypted-keystore

# Debug mode
npm run test:e2e:debug -- encrypted-keystore

# UI mode (interactive)
npm run test:e2e:ui
```

## Test Strategy

The new `encrypted-keystore.spec.ts` tests focus on what matters most:

1. **UI/UX**: Can users see and use encryption options?
2. **Creation**: Does encrypted DID creation work?
3. **Session Management**: Lock/unlock flow
4. **Fallback**: Unencrypted mode still works
5. **Security Indicators**: Users can see encryption status

## Recommendations

### ✅ DO:
- Focus on `encrypted-keystore.spec.ts` for core functionality
- Test error handling and edge cases
- Test browser compatibility

### ❌ DON'T:
- Try to test full production workflow in E2E (too brittle)
- Rely on real API credentials in CI/CD
- Create 500+ line test files

## Next Steps

1. Run `npm run test:e2e -- encrypted-keystore` to validate
2. Add to CI/CD pipeline
3. Consider rewriting Alice/Bob tests with mocks
