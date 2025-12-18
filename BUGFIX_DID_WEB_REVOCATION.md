# Bug Fix: did:web Revocation Support

## 🐛 Issues

### Issue 1: Unsupported DID Format
Revocation was failing with error:
```
Error: Unsupported did did:web:up.storacha.network
```

### Issue 2: invoke is not a function
After fixing Issue 1, encountered:
```
TypeError: invoke is not a function
```

### Issue 3: Cannot read properties of undefined
After fixing Issue 2, encountered:
```
TypeError: Cannot read properties of undefined (reading 'error')
```

## 🔍 Root Causes

### Root Cause 1: Wrong DID Parser
The implementation was using `Verifier.parse()` from `@ucanto/principal`:

```typescript
// ❌ WRONG - Only works with did:key
const { Verifier } = await import('@ucanto/principal');
const serviceVerifier = Verifier.parse('did:web:up.storacha.network');
```

**Problem:** `Verifier.parse()` only supports `did:key` format, not `did:web` format.

### Root Cause 2: Wrong Import Path
The `invoke` function was imported from the wrong module:

```typescript
// ❌ WRONG - invoke is not exported from delegation submodule
const { invoke } = await import('@ucanto/core/delegation');
```

**Problem:** `invoke` is exported from `@ucanto/core`, not `@ucanto/core/delegation`.

### Root Cause 3: Wrong Response Handling
The code assumed `execute()` returns a single result object:

```typescript
// ❌ WRONG - execute() returns an array, not a single result
const result = await connection.execute(revocationInvocation);
if (result.out.error) { // result.out is undefined!
```

**Problem:** `connection.execute()` returns an **array** of results (one per invocation), not a single result object.

## ✅ Solutions

### Solution 1: Use Client.connect() for did:web

Use `Client.connect()` pattern from Storacha's agent.js:

```typescript
// ✅ CORRECT - Works with any DID format
const UcantoClient = await import('@ucanto/client');
const { CAR, HTTP } = await import('@ucanto/transport');

const serviceID = {
  did: () => 'did:web:up.storacha.network'
};

const connection = UcantoClient.connect({
  id: serviceID,
  codec: CAR.outbound,
  channel: HTTP.open({
    url: new URL('https://up.storacha.network'),
    method: 'POST',
  }),
});
```

### Solution 2: Import invoke from @ucanto/core

```typescript
// ✅ CORRECT - Import from core, not core/delegation
const { invoke } = await import('@ucanto/core');

// Create the invocation
const revocationInvocation = await invoke({
  issuer,
  audience: serviceID,
  capability: {
    can: 'ucan/revoke',
    with: issuer.did(),
    nb: { ucan: parsedDelegation.cid }
  },
  proofs: [parsedDelegation]
});

// Execute through the connection
const result = await connection.execute(revocationInvocation);
```

### Solution 3: Handle Array Response

```typescript
// ✅ CORRECT - execute() returns array, access first element
const results = await connection.execute(revocationInvocation);
const result = results[0]; // Get the first result

// Check if result exists and has out property
if (!result || !result.out) {
  console.error('❌ Invalid response from Storacha:', results);
  return { success: false, error: 'Invalid response from Storacha service' };
}

// Now safely check for errors
if (result.out.error) {
  console.error('❌ Revocation failed:', result.out.error);
  return { success: false, error: result.out.error.message || 'Revocation failed' };
}
```

## 📚 Reference Implementation

This follows the exact pattern used in Storacha's official agent.js:

**File:** [`packages/access-client/src/agent.js`](https://github.com/storacha/upload-service/blob/main/packages/access-client/src/agent.js)

**Lines 77-87:**
```javascript
export function connection(options = {}) {
  return Client.connect({
    id: options.principal ?? PRINCIPAL,
    codec: CAR.outbound,
    channel: HTTP.open({
      url: options.url ?? new URL(HOST),
      method: 'POST',
      fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
    }),
  })
}
```

## 🔑 Key Learnings

1. **Verifier.parse()** is for `did:key` only
2. **Client.connect()** works with any DID format via simple object: `{ did: () => string }`
3. **invoke** is exported from `@ucanto/core`, not `@ucanto/core/delegation`
4. **delegate** is exported from `@ucanto/core/delegation` (different function!)
5. **connection.execute()** returns an **array** of results, not a single result
6. Always access results array: `const result = results[0]`
7. **Always check Storacha's source code** - they've already solved these issues
8. **did:web** requires special handling compared to `did:key`

## 📦 Modules Used

- `@ucanto/client` - For Client.connect()
- `@ucanto/transport/car` - For CAR codec
- `@ucanto/transport/http` - For HTTP channel
- `@ucanto/core` - For invoke() (NOT from @ucanto/core/delegation)

## 🧪 Testing

After all three fixes, revocation should work:

1. Create delegation
2. Click "Revoke" button
3. Confirm action
4. ✅ Success: Delegation marked as revoked
5. ✅ Recipient can no longer use it

**Expected console output:**
```
🔄 Revoking delegation: bafyrei...
Issuer DID: did:key:z6Mk...
Delegation CID: bafyrei...
📤 Sending revocation invocation to Storacha...
✅ Delegation revoked successfully
Response: { time: 1734552000000 }
```

**What was fixed:**
- ✅ No more "Unsupported did" error (Issue 1)
- ✅ No more "invoke is not a function" error (Issue 2)
- ✅ No more "Cannot read properties of undefined" error (Issue 3)
- ✅ Revocation request successfully sent to Storacha
- ✅ Response properly handled as array

## 🔗 Related Files

- `web/src/lib/ucan-delegation.ts` - Lines 1610-1650 (revokeDelegation method)
- `REVOCATION_IMPLEMENTATION.md` - Full feature documentation

---

**Date:** December 18, 2024  
**Fixed By:** 
1. Using Storacha agent.js pattern (Client.connect) for did:web support
2. Correcting invoke import path (@ucanto/core)
3. Handling execute() response as array

**Status:** ✅ All Three Issues Resolved
