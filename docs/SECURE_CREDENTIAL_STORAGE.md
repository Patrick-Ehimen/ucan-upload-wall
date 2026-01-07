# 🔒 Secure Credential Storage Architecture

## Overview

This document outlines the architecture for moving from localStorage-based credential storage to a more secure, hybrid approach using WebAuthn largeBlob and Storacha decentralized storage.

## 🚨 The Problem: localStorage Vulnerabilities

### Current Implementation

All sensitive data is stored in browser localStorage:
- WebAuthn credential information (metadata only, unencrypted)
- Ed25519 archive (**encrypted with AES-GCM**)
- Ed25519 public key + DID (unencrypted)
- Storacha credentials - private key + proof (**unencrypted**)
- UCAN delegations - created + received (**unencrypted**)
- Revocation cache (**unencrypted**)

### Security Issues

**Vulnerabilities:**
- ❌ **XSS Attacks**: Any JavaScript on same origin can access localStorage
- ❌ **Browser Extensions**: Extensions can read localStorage with appropriate permissions
- ⚠️ **Mixed Encryption at Rest**: 
  - localStorage itself stores data unencrypted on disk by the browser
  - Ed25519 private keys ARE encrypted (AES-GCM) before storage
  - alternative Storacha credentials (key, proof, spaceDID) stored in plain text
  - UCAN delegations and revocation cache stored in plain text
- ❌ **Code Injection**: Malicious code can exfiltrate all credentials (encrypted or not)
- ❌ **Physical Access**: Anyone with device access can read unencrypted localStorage data

**Attack Scenarios:**
1. XSS vulnerability → attacker steals all credentials
2. Malicious browser extension → silent credential exfiltration
3. Supply chain attack → compromised dependency reads localStorage
4. Lost/stolen device → credentials exposed

---

## ✅ The Solution: Three-Tier Hybrid Architecture

```
┌─────────────────────────────────────────────────┐
│ Tier 1: WebAuthn largeBlob (Hardware-Protected) │
│ • Bootstrap data only (< 2KB)                   │
│ • CID pointer to IPFS data                      │
│ • No Storacha credentials needed (Option B)     │
│ • Requires biometric authentication             │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ Tier 2: IPFS via Helia (Decentralized Storage)  │
│ • Full encrypted credentials                    │
│ • All UCAN delegations                          │
│ • Local-first: checks local cache first         │
│ • Offline-capable when data is cached           │
│ • Falls back to IPFS network/gateways           │
│ • Encrypted before upload to Storacha           │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ Tier 3: localStorage (Cache Only)               │
│ • Performance optimization                      │
│ • Can be cleared without data loss              │
│ • Rebuilt from IPFS on demand                   │
└─────────────────────────────────────────────────┘
```

---

## 🔑 Tier 1: WebAuthn largeBlob

### What is largeBlob?

WebAuthn Level 3 extension that stores up to **2KB** of data directly in the authenticator (hardware security key, TPM, or secure enclave).

### Properties

**Security:**
- ✅ Hardware-encrypted by authenticator
- ✅ Requires user authentication (biometric/PIN) to access
- ✅ Protected from XSS and code injection
- ✅ Isolated from JavaScript execution context

**Availability:**
- Some authenticators sync via cloud (iCloud Keychain, Google Password Manager)
- Cross-device access possible with synced authenticators
- Lost device with non-synced authenticator = data recovery needed

**Browser Support:**
- Chrome/Edge 92+
- Safari 17+
- Firefox: No support yet (as of Dec 2024)

### What to Store in largeBlob

**Bootstrap Data (< 2KB):**

```typescript
interface LargeBlobData {
  version: number;
  storacha: {
    credentialsCID: string;      // 59 bytes (CID)
    spaceDID: string;             // ~60 bytes
    readOnlyKey: string;          // ~100 bytes (minimal Ed25519)
  };
  timestamp: number;              // 8 bytes
  fallback: {
    useLocalStorage: boolean;
  };
}
```

**Total size:** ~300 bytes (well within 2KB limit)

### Implementation

```typescript
// Write to largeBlob
async function writeToLargeBlob(data: LargeBlobData): Promise<boolean> {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  
  if (bytes.length > 2048) {
    throw new Error('Data exceeds largeBlob 2KB limit');
  }
  
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{
        type: 'public-key',
        id: credentialId
      }],
      extensions: {
        largeBlob: {
          write: bytes
        }
      }
    }
  });
  
  const result = assertion.getClientExtensionResults().largeBlob;
  return result.written === true;
}

// Read from largeBlob
async function readFromLargeBlob(): Promise<LargeBlobData | null> {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{
        type: 'public-key',
        id: credentialId
      }],
      extensions: {
        largeBlob: {
          read: true
        }
      }
    }
  });
  
  const result = assertion.getClientExtensionResults().largeBlob;
  if (result?.blob) {
    const json = new TextDecoder().decode(result.blob);
    return JSON.parse(json);
  }
  return null;
}
```

---

## 🌐 IPFS via Helia: Local-First Content Addressing

### Why Helia?

Helia is a lean, modular JavaScript implementation of IPFS that runs in browsers and Node.js. Unlike traditional IPFS gateways:

- ✅ **Local-First**: Checks local cache before network
- ✅ **Offline-Capable**: Works offline if content is cached
- ✅ **P2P Network**: Connects to decentralized IPFS swarm
- ✅ **No Single Point of Failure**: Multiple fetch strategies
- ✅ **Future-Proof**: Works with any IPFS-compatible system

### Fetch Strategy Hierarchy

```
1. Helia Local Cache (offline capable)
   ↓ (if not found)
2. Helia IPFS Network (P2P, DHT, local nodes)
   ↓ (if not found or timeout)
3. Multiple HTTP Gateways (fallback)
   - w3s.link (Storacha)
   - ipfs.io (IPFS Foundation)
   - dweb.link (Protocol Labs)
   - cloudflare-ipfs.com
   - localhost:8080 (if available)
```

### Benefits

| Feature | Centralized Gateway | Helia + Multi-Gateway |
|---------|-------------------|----------------------|
| Offline Access | ❌ No | ✅ Yes (if cached) |
| Censorship Resistant | ❌ Single point | ✅ Multiple sources |
| Local Network | ❌ Internet only | ✅ LAN/local IPFS |
| Performance | ⚠️ Variable | ✅ Local-first fast |
| Decentralization | ❌ Centralized | ✅ Truly distributed |

---

## 📦 Tier 2: Storacha Storage

### What to Store

**Full Credentials File (encrypted before upload):**

```typescript
interface StorachaCredentialsFile {
  version: number;
  encrypted: boolean;
  encryption: {
    algorithm: 'AES-GCM';
    keyDerivation: 'WebAuthn-PRF';
  };
  
  credentials: {
    ed25519: {
      archive: string;          // Encrypted Ed25519 keys
      publicKey: string;
      did: string;
    };
    storacha: {
      key: string;              // Ed25519 private key
      proof: string;            // Space delegation proof
      spaceDID: string;
    };
  };
  
  delegations: {
    created: DelegationInfo[];
    received: DelegationInfo[];
  };
  
  metadata: {
    createdAt: string;
    updatedAt: string;
    deviceName?: string;
  };
}
```

### Upload Flow

```typescript
async function uploadCredentialsToStoracha(
  credentials: StorachaCredentialsFile
): Promise<string> {
  // 1. Encrypt credentials using WebAuthn PRF-derived key
  const encryptionKey = await deriveEncryptionKeyFromWebAuthn();
  const encrypted = await encryptData(
    JSON.stringify(credentials),
    encryptionKey
  );
  
  // 2. Upload to Storacha
  const blob = new Blob([encrypted]);
  const cid = await storachaClient.uploadFile(blob);
  
  // 3. Store CID in largeBlob
  await writeToLargeBlob({
    version: 1,
    storacha: {
      credentialsCID: cid.toString(),
      spaceDID: credentials.credentials.storacha.spaceDID,
      readOnlyKey: deriveReadOnlyKey()
    },
    timestamp: Date.now(),
    fallback: { useLocalStorage: false }
  });
  
  return cid.toString();
}
```

### Download Flow

```typescript
async function downloadCredentialsFromIPFS(): Promise<StorachaCredentialsFile> {
  // 1. Read CID from largeBlob
  const bootstrap = await readFromLargeBlob();
  if (!bootstrap) {
    throw new Error('No bootstrap data found');
  }
  
  const cid = CID.parse(bootstrap.storacha.credentialsCID);
  
  // 2. Fetch via Helia (local-first, falls back to network)
  const encryptedData = await fetchViaHelia(cid);
  
  // 3. Decrypt using WebAuthn PRF-derived key
  const decryptionKey = await deriveEncryptionKeyFromWebAuthn();
  const decrypted = await decryptData(encryptedData, decryptionKey);
  
  return JSON.parse(decrypted);
}

// Helia-based fetch with fallback strategies
async function fetchViaHelia(cid: CID): Promise<ArrayBuffer> {
  try {
    // Initialize Helia (cached singleton)
    const helia = await getOrCreateHelia();
    const fs = unixfs(helia);
    
    // Try local cache first (works offline)
    try {
      console.log('Fetching from Helia local cache...');
      const chunks: Uint8Array[] = [];
      for await (const chunk of fs.cat(cid, { offline: true })) {
        chunks.push(chunk);
      }
      console.log('✅ Found in local cache');
      return concatenateChunks(chunks).buffer;
    } catch (offlineError) {
      // Not in cache, try network
      console.log('Not in local cache, fetching from IPFS network...');
    }
    
    // Fetch from IPFS network (DHT, peers, etc.)
    const chunks: Uint8Array[] = [];
    const timeout = setTimeout(() => {
      throw new Error('Helia network fetch timeout');
    }, 10000); // 10s timeout
    
    for await (const chunk of fs.cat(cid)) {
      chunks.push(chunk);
    }
    clearTimeout(timeout);
    
    console.log('✅ Fetched from IPFS network');
    return concatenateChunks(chunks).buffer;
    
  } catch (heliaError) {
    // Fallback to HTTP gateways
    console.warn('Helia fetch failed, trying HTTP gateways:', heliaError);
    return await fetchViaGateways(cid);
  }
}

// Multi-gateway fallback
const IPFS_GATEWAYS = [
  'https://w3s.link/ipfs',           // Storacha gateway
  'https://dweb.link/ipfs',           // Protocol Labs
  'https://ipfs.io/ipfs',             // IPFS Foundation
  'https://cloudflare-ipfs.com/ipfs', // Cloudflare
  'http://localhost:8080/ipfs',       // Local IPFS daemon
];

async function fetchViaGateways(
  cid: CID,
  timeout = 5000
): Promise<ArrayBuffer> {
  const cidString = cid.toString();
  
  // Race all gateways in parallel
  const promises = IPFS_GATEWAYS.map(async (gateway) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(`${gateway}/${cidString}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      console.log(`✅ Fetched from gateway: ${gateway}`);
      return await response.arrayBuffer();
    } catch (error) {
      console.warn(`Gateway ${gateway} failed:`, error.message);
      throw error;
    }
  });
  
  // Return first successful response
  try {
    return await Promise.any(promises);
  } catch (aggregateError) {
    throw new Error(
      'All IPFS gateways failed. Check network connection.'
    );
  }
}

// Helia singleton manager
let heliaInstance: Helia | null = null;

async function getOrCreateHelia(): Promise<Helia> {
  if (heliaInstance) {
    return heliaInstance;
  }
  
  const { createHelia } = await import('helia');
  const { createLibp2p } = await import('libp2p');
  
  heliaInstance = await createHelia({
    // Lightweight config for browser
    libp2p: await createLibp2p({
      // Minimal transports for browser
      transports: [],
      // Enable browser-compatible features
    }),
  });
  
  return heliaInstance;
}

// Utility to concatenate chunks
function concatenateChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
```

---

## 💾 Tier 3: localStorage (Cache)

### Purpose

Performance optimization only - not the source of truth.

### What to Cache

```typescript
interface LocalStorageCache {
  // Mark as cache (can be cleared)
  _cache: true;
  _lastSync: number;
  _storachaCID: string;
  
  // Cached data
  credentials?: StorachaCredentialsFile;
  delegations?: DelegationInfo[];
  revocationCache?: Record<string, { revoked: boolean; checkedAt: number }>;
}
```

### Cache Invalidation

```typescript
async function syncFromStoracha(force = false): Promise<void> {
  const cache = getLocalStorageCache();
  
  // Check if cache is stale (> 1 hour old)
  const isStale = Date.now() - cache._lastSync > 3600000;
  
  if (force || isStale || !cache.credentials) {
    // Fetch fresh data from IPFS via Helia
    const credentials = await downloadCredentialsFromIPFS();
    
    // Update cache
    setLocalStorageCache({
      _cache: true,
      _lastSync: Date.now(),
      _storachaCID: credentials.metadata.storachaCID,
      credentials,
      delegations: [
        ...credentials.delegations.created,
        ...credentials.delegations.received
      ]
    });
  }
}
```

---

## 🔄 Complete User Flows

### First-Time Setup

```
1. User creates WebAuthn credential (with largeBlob support)
   ↓
2. Generate Ed25519 keys (in worker)
   ↓
3. User adds Storacha credentials
   ↓
4. Package all credentials into JSON
   ↓
5. Encrypt with WebAuthn PRF-derived key
   ↓
6. Upload to Storacha → get CID
   ↓
7. Store CID in largeBlob (requires biometric)
   ↓
8. Optionally cache in localStorage
```

### Returning User (Login)

```
1. User authenticates with WebAuthn
   ↓
2. Read largeBlob → get Storacha CID
   ↓
3. Check localStorage cache
   ├─ Cache valid? → Use cache
   └─ Cache stale/missing? → Fetch from IPFS (Helia → network → gateways)
   ↓
4. Decrypt credentials with WebAuthn PRF
   ↓
5. Initialize app with credentials
   ↓
6. Update cache in localStorage (optional)
```

### Updating Credentials

```
1. User makes changes (e.g., imports delegation)
   ↓
2. Update in-memory credentials
   ↓
3. Encrypt updated credentials
   ↓
4. Upload to Storacha → get new CID
   ↓
5. Update largeBlob with new CID (requires biometric)
   ↓
6. Update localStorage cache
```

### Device Loss Recovery

```
1. User gets new device
   ↓
2. If authenticator synced (iCloud/Google):
   ├─ Authenticate with synced credential
   └─ largeBlob synced → full recovery
   ↓
3. If authenticator not synced:
   ├─ Use recovery method (see below)
   └─ Manual re-setup required
```

---

## 🛡️ Security Benefits

### Compared to localStorage-only

| Attack Vector | localStorage | Hybrid (largeBlob + Storacha) |
|--------------|-------------|--------------------------------|
| XSS Injection | ❌ Full access | ✅ Requires biometric |
| Browser Extension | ❌ Can read | ✅ Cannot access largeBlob |
| Code Injection | ❌ Steal all | ✅ Only cache accessible |
| Physical Device Access | ❌ Unencrypted | ✅ Encrypted + biometric needed |
| Lost Device | ❌ Permanent loss | ✅ Recoverable from Storacha |
| Supply Chain Attack | ❌ Full exposure | ✅ Limited to cache |

### Encryption Layers

1. **WebAuthn largeBlob**: Hardware-encrypted by authenticator
2. **Storacha upload**: Encrypted before upload (AES-GCM)
3. **Encryption key**: Derived from WebAuthn PRF (hardware-backed)
4. **Access control**: Requires biometric authentication

---

## 🚧 Solving the Chicken-and-Egg Problem

### The Problem

To access Storacha, you need credentials.
To get credentials, you need to fetch from Storacha.
To fetch from Storacha, you need credentials. 🔄

### The Solution: Bootstrap Key in largeBlob

**Option A: Read-Only Key (Recommended)**

Store a minimal read-only Ed25519 key in largeBlob that can only:
- Read from Storacha (fetch files)
- Cannot create delegations
- Cannot upload files
- Cannot modify space

```typescript
interface BootstrapData {
  storacha: {
    credentialsCID: string;
    spaceDID: string;
    readOnlyKey: string;  // Minimal permissions
  }
}
```

**Option B: Public CID + Encryption**

Store only the CID (no key needed for public reads):
- Upload credentials as publicly readable
- But encrypted with WebAuthn PRF
- Anyone can fetch, but only you can decrypt

```typescript
interface BootstrapData {
  storacha: {
    credentialsCID: string;  // Public CID
    spaceDID: string;
    // No key needed - public read, private decrypt
  }
}
```

### Bootstrap Process

```
First Setup:
1. Create WebAuthn credential
2. Create Ed25519 keys
3. Upload credentials to Storacha
4. Store CID in largeBlob

Subsequent Access:
1. Authenticate (biometric)
2. Read CID from largeBlob
3. Fetch from IPFS via Helia (local-first, fallback to gateways)
4. Decrypt with WebAuthn PRF
5. Full access restored
```

---

## 📊 Implementation Roadmap

### Phase 1: Detection and Fallback (1-2 weeks)

- [ ] Detect WebAuthn largeBlob support
- [ ] Add feature detection UI
- [ ] Implement fallback to localStorage
- [ ] Add migration path for existing users

### Phase 2: largeBlob Integration (2-3 weeks)

- [ ] Implement largeBlob read/write functions
- [ ] Create bootstrap data structure
- [ ] Store CID in largeBlob
- [ ] Handle authentication failures gracefully

### Phase 3: Storacha Upload (2-3 weeks)

- [ ] Package credentials into JSON format
- [ ] Implement encryption with WebAuthn PRF
- [ ] Upload to Storacha
- [ ] Store CID reference

### Phase 4: IPFS Download via Helia (2-3 weeks)

- [ ] Integrate Helia for local-first IPFS
- [ ] Implement local cache checking (offline mode)
- [ ] Add IPFS network fetching (DHT, peers)
- [ ] Implement multi-gateway fallback
- [ ] Fetch credentials by CID
- [ ] Decrypt with WebAuthn PRF
- [ ] Validate credential integrity
- [ ] Handle network failures gracefully
- [ ] Add fetch performance metrics

### Phase 5: Cache Management (1 week)

- [ ] Mark localStorage as cache
- [ ] Implement cache invalidation
- [ ] Add sync indicators
- [ ] Handle cache clearing gracefully

### Phase 6: Migration Tool (1-2 weeks)

- [ ] Create migration wizard for existing users
- [ ] Export from localStorage
- [ ] Upload to Storacha
- [ ] Store CID in largeBlob
- [ ] Verify migration success

---

## 📦 Dependencies

### Required npm Packages

```json
{
  "dependencies": {
    "helia": "^4.0.0",
    "@helia/unixfs": "^3.0.0",
    "multiformats": "^13.0.0",
    "libp2p": "^1.0.0"
  }
}
```

### Installation

```bash
npm install helia @helia/unixfs multiformats libp2p
```

### Bundle Size Considerations

Helia adds ~200KB gzipped to bundle. Optimization strategies:
- Lazy load Helia on first use
- Use dynamic imports
- Consider code-splitting for upload vs download paths
- Evaluate tree-shaking opportunities

---

## 🧪 Testing Strategy

### Browser Support Testing

```typescript
async function detectLargeBlobSupport(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    return false;
  }
  
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    // largeBlob support is implicit in modern authenticators
    return available;
  } catch {
    return false;
  }
}
```

### Test Scenarios

1. **Setup Flow**
   - Fresh user on supported browser
   - Fresh user on unsupported browser (fallback)
   
2. **Login Flow**
   - Returning user with largeBlob
   - Returning user with localStorage fallback
   - Returning user with stale cache
   
3. **Update Flow**
   - Import new delegation
   - Create delegation
   - Update credentials
   
4. **Recovery Flow**
   - Lost device with synced authenticator
   - Lost device without sync
   - Corrupted localStorage cache
   
5. **Error Handling**
   - Helia local cache hit (offline)
   - Helia local cache miss (network fetch)
   - IPFS network timeout (gateway fallback)
   - All gateways fail (error state)
   - Storacha offline
   - Authentication failure
   - Decryption failure
   - Network timeout

---

## 🔗 Related Documents

- [SECURITY.md](../SECURITY.md) - Security vulnerabilities and mitigations
- [PLANNING.md](../PLANNING.md) - Overall project roadmap
- [REVOCATION_IMPLEMENTATION.md](./REVOCATION_IMPLEMENTATION.md) - UCAN revocation feature

---

## 📚 References

### WebAuthn largeBlob
- [W3C WebAuthn Level 3 Spec](https://www.w3.org/TR/webauthn-3/#sctn-large-blob-extension)
- [MDN: largeBlob Extension](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API/WebAuthn_extensions#largeblob)
- [Chrome Platform Status: largeBlob](https://chromestatus.com/feature/5134801792098304)

### IPFS & Helia
- [Helia Documentation](https://helia.io/)
- [Helia GitHub](https://github.com/ipfs/helia)
- [UnixFS in Helia](https://github.com/ipfs/helia-unixfs)
- [IPFS Content Addressing (CID)](https://docs.ipfs.tech/concepts/content-addressing/)
- [IPFS Gateway Specification](https://specs.ipfs.tech/http-gateways/)

### Storacha
- [Storacha Documentation](https://docs.storacha.network/)
- [UCAN Specification](https://github.com/ucan-wg/spec)

### Security
- [WebAuthn Security Considerations](https://www.w3.org/TR/webauthn-3/#sctn-security-considerations)
- [localStorage Security Risks](https://owasp.org/www-community/vulnerabilities/DOM_Based_XSS)

---

**Status:** 📋 Planned (Phase 1.5 in PLANNING.md)  
**Priority:** High (addresses critical localStorage vulnerabilities)  
**Estimated Effort:** 8-12 weeks  
**Date Created:** December 18, 2024  
**Last Updated:** January 7, 2025 (Added Helia local-first IPFS architecture)
