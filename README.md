# 🔐 UCAN Upload Wall

A browser-only file upload application powered by **WebAuthn DIDs**, **worker-based Ed25519 keystore**, and **UCAN delegations** on Storacha.

## 🏗️ Architecture

### **WebAuthn DID (P-256)**
- Hardware-secured identity using device biometrics (Face ID, Touch ID, Windows Hello)
- P-256 elliptic curve cryptography
- DID format: `did:key:zDna...` (P-256 public key)
- Used for: Initial authentication, delegation creation

### **Worker-Based Ed25519 Keystore**
- Ed25519 keypair generated in a dedicated web worker
- AES-GCM encryption key derived from WebAuthn PRF seed (deterministic)
- Private key never leaves the worker
- DID format: `did:key:z6Mk...` (Ed25519 public key)
- Used for: UCAN signing, Storacha client principal

**Worker Functions:**
- `init(prfSeed)` - Initialize AES key from WebAuthn PRF seed
- `generateKeypair()` - Generate Ed25519 keypair and archive
- `encrypt(plaintext)` - Encrypt data with AES-GCM
- `decrypt(ciphertext, iv)` - Decrypt data with AES-GCM
- `sign(data)` - Sign data with Ed25519 private key
- `verify(data, signature)` - Verify Ed25519 signature

### **Key Flow**
```
WebAuthn Credential (P-256)
    ↓
rawCredentialId (PRF seed)
    ↓
Worker: HKDF-SHA-256 → AES-GCM key
    ↓
Worker: Generate Ed25519 keypair
    ↓
Worker: Create Ed25519Signer archive
    ↓
Encrypt archive with AES key → localStorage
    ↓
Reconstruct Ed25519Signer for Storacha client
```

## 🚀 Features

### **1. Generate Ed25519 DID**
- Automatically generated on first authentication
- Derived from WebAuthn credential (deterministic per credential)
- Stored encrypted in localStorage
- Format: `did:key:z6Mk...`

### **2. Create Delegation (Storacha CLI)**
```bash
# On Storacha CLI, create delegation for your Ed25519 DID
storacha delegation create did:key:z6Mkwa35STKQF1i5eoDYtQ4W1y6y6NbE9RXe3QiJt7aSK6uS --base64
```

This outputs a base64-encoded UCAN delegation proof.

### **3. Import Delegation**
- Paste the delegation proof from Storacha CLI
- App verifies the delegation is for your current Ed25519 DID
- Delegation stored in localStorage
- Capabilities: `upload/*`, `store/*`, `blob/*`, `space/*`, etc.

### **4. Upload File**
- Drag & drop or click to select
- File uploaded to Storacha using delegation
- Returns CID (Content Identifier)
- Files stored on Filecoin network

### **5. List Files**
- Lists all uploads in your Storacha space
- Uses delegation with `upload/list` capability
- Shows CID, upload date, shards

### **6. Create Delegation** *(Untested)*
- Create new delegations from your current Ed25519 DID
- Delegate to another DID with specific capabilities
- Expiration support
- **Note:** Needs testing with Storacha network

## 📦 Setup

### Prerequisites
- Modern browser with WebAuthn support
- Device with biometric authentication
- Storacha account and credentials (for creating delegations)

### Installation
```bash
cd web
npm install
npm run dev
```

### First-Time Setup
1. **Authenticate** - Click "Authenticate with Biometric"
2. **Get Your DID** - Copy your Ed25519 DID from the UI
3. **Create Delegation** - Use Storacha CLI:
   ```bash
   storacha delegation create <your-did> --base64
   ```
4. **Import Delegation** - Paste the delegation proof
5. **Upload Files** - Start uploading!

## 🔐 Security

- **WebAuthn PRF Seed**: Deterministic seed from WebAuthn credential
- **AES-GCM Encryption**: Archive encrypted with worker-derived AES key
- **Worker Isolation**: Private keys never exposed to main thread
- **Deterministic Salt**: Same PRF seed → same AES key → same Ed25519 DID
- **Encrypted Storage**: Archive stored encrypted in localStorage

## 🛠️ Technical Details

### **Worker Keystore**
- Location: `web/src/workers/ed25519-keystore.worker.ts`
- Generates Ed25519 keypair using Web Crypto API
- Creates `@ucanto/principal/ed25519` compatible archive
- AES key derived deterministically from PRF seed

### **Secure Ed25519 DID**
- Location: `web/src/lib/secure-ed25519-did.ts`
- Wraps worker communication
- Provides `encryptArchive()` / `decryptArchive()` helpers
- Manages DID generation and storage

### **UCAN Delegation Service**
- Location: `web/src/lib/ucan-delegation.ts`
- Manages Storacha client initialization
- Handles delegation import/export
- Upload/list/delete operations

## 📝 Notes

- **Deterministic DID**: Same WebAuthn credential always produces same Ed25519 DID
- **Archive Encryption**: Archive encrypted with AES-GCM, decrypted only in worker
- **Delegation Mismatch**: If DID changes, delegation must be recreated
- **Worker Persistence**: Worker state lost on page reload; archive restored from localStorage

## 🔗 Resources

- [Storacha Documentation](https://docs.storacha.network/)
- [UCAN Specification](https://github.com/ucan-wg/spec)
- [WebAuthn Guide](https://webauthn.guide/)
