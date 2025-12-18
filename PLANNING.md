# 🚀 Future Planning & Roadmap

This document outlines the planned evolution of the UCAN Upload Wall project toward production-ready, hardware-backed security.

## Overview

The project will evolve through four major phases:

0. **UCAN Revocation** - Implement delegation revocation and lifecycle management (PRIORITY)
1. **P-256 Integration** - Enable hardware-backed WebAuthn signing
2. **Multi-Device DKG** - Distributed key generation across multiple devices
3. **Production Hardening** - Security audits and deployment

---

## Phase 0: UCAN Revocation (Immediate Priority)

**Goal**: Close the security gap by implementing delegation revocation and validation, enabling proper lifecycle management of UCAN delegations.

### Why This Comes First

**Critical Security Need**: The application currently creates and shares UCAN delegations, but has no way to revoke them. This means:
- Lost or stolen devices retain permanent access
- Mistakenly delegated permissions cannot be withdrawn
- No defense against compromised delegations
- Cannot enforce time-limited access policies

This is a **security vulnerability** that must be addressed before any other major changes.

### Roadmap

- [ ] **Revocation API Implementation**
  - [ ] Add `revokeDelegation()` method to `UCANDelegationService`
  - [ ] Implement revocation invocation using `@storacha/capabilities/ucan`
  - [ ] Send revocation requests to Storacha service (`did:web:up.storacha.network`)
  - [ ] Handle revocation responses and error cases

- [ ] **Revocation Status Checking**
  - [ ] Implement `isDelegationRevoked()` using Storacha revocation registry
  - [ ] Query `https://up.storacha.network/revocations/[CID]` API
  - [ ] Add `validateDelegation()` to check expiration and revocation status
  - [ ] Cache revocation checks to minimize API calls

- [ ] **Pre-Operation Validation**
  - [ ] Add revocation checks before upload operations
  - [ ] Add revocation checks before list operations
  - [ ] Add revocation checks before delete operations
  - [ ] Return clear error messages when using revoked delegations

- [ ] **User Interface**
  - [ ] Add "Revoke" button to created delegations in `DelegationManager`
  - [ ] Show revocation status badges (Active, Revoked, Expired) on delegation cards
  - [ ] Add confirmation dialog when revoking ("This action cannot be undone")
  - [ ] Visual indicators for revoked/expired delegations (red banner, strikethrough)
  - [ ] Show revocation timestamp and revoker DID when applicable

- [ ] **Testing & Documentation**
  - [ ] Test revocation flow: create → share → revoke → verify blocked
  - [ ] Test that issuer can revoke their created delegations
  - [ ] Test that audience can revoke delegations they received
  - [ ] Document revocation API in README
  - [ ] Add revocation examples to user guide

**Timeline**: 1-2 weeks

**Benefits**:
- 🔒 **Security**: Ability to revoke compromised or mistaken delegations
- ✅ **Access Control**: Enforce time-limited access and permissions
- 🛡️ **Risk Mitigation**: Reduce impact of lost/stolen devices
- 📋 **Audit Trail**: Track delegation lifecycle and revocations
- 🚀 **Production Ready**: Essential feature for real-world deployment

**Technical Details**:
- Works with existing Ed25519 DID implementation
- Uses Storacha's built-in revocation registry
- Revocation tracked by UCAN CID
- Both issuer and audience can revoke
- Revocations are permanent and cannot be undone

**References**:
- [Storacha Revocation API](https://github.com/storacha/upload-service/blob/main/packages/upload-api/src/ucan/revoke.js)
- [Agent Revoke Implementation](https://github.com/storacha/upload-service/blob/main/packages/access-client/src/agent.js#L259)
- Revocation Registry: `https://up.storacha.network/revocations/`

---

## Phase 1: P-256 Integration (Short-term)

**Goal**: Enable pure P-256 WebAuthn signing by integrating P-256 support into Storacha.

### Roadmap

- [ ] Complete testing of [NiKrause/ucanto p256 branch](https://github.com/NiKrause/ucanto/tree/p256)
- [ ] Submit PR to integrate P-256 into [storacha/upload-service](https://github.com/storacha/upload-service)
- [ ] Work with Storacha team on P-256 acceptance
- [ ] Update application to use pure P-256 WebAuthn signing once supported
- [ ] Remove Ed25519 worker implementation entirely
- [ ] Security audit of P-256 integration

**Timeline**: 6-12 months (dependent on Storacha acceptance)

**Benefits**:
- ✅ Hardware-backed signing (no keys in JavaScript)
- ✅ Eliminates Web Worker attack surface
- ✅ Simplified architecture
- ✅ Better security than current Ed25519 approach

---

## Phase 2: Multi-Device DKG Architecture (Long-term)

**Goal**: Implement true multi-device security using Distributed Key Generation (DKG) with threshold cryptography.

### Concept

Instead of a single Ed25519 key in one browser, split the key across **at least two devices** using threshold cryptography:

```
Device 1 (Browser)     Device 2 (Mobile)
      ↓                       ↓
  Key Share 1            Key Share 2
      ↓                       ↓
      └─────────┬─────────────┘
                ↓
         Combined Signature
         (requires BOTH devices)
```

### Architecture

**Multi-Device Flow:**

1. **Browser**: User initiates UCAN signing request
2. **Browser**: Generates QR code with signing request + PWA URL (e.g., IPFS URL)
3. **Mobile**: Scans QR code, opens same PWA
4. **Mobile**: Authenticates with Passkey (biometric confirmation)
5. **Communication**: Devices communicate via js-libp2p (local network or public DHT)
6. **Signing**: Both devices combine their key shares to create signature
7. **Result**: UCAN signed only with approval from both devices

### Security Benefits

- ✅ **No single point of failure** - compromise of one device doesn't expose private key
- ✅ **Multi-factor authentication** - requires physical access to both devices
- ✅ **Hardware-backed on both devices** - each device uses WebAuthn/Passkey
- ✅ **User confirmation** - explicit biometric approval on second device
- ✅ **Threshold signing** - k-of-n devices required (e.g., 2-of-2, 2-of-3)

### Additional Features

- Key shares stored encrypted on Storacha (under DKG circumstances)
- Recovery possible with threshold of devices
- Compatible with Google/Chrome multi-device Passkeys
- Enables secure UCAN chaining and delegation

### Technical Components

**Roadmap Items:**

- [ ] Research threshold signature schemes for Ed25519 (e.g., FROST)
- [ ] Compare OrbitDB-DKG tests: https://github.com/NiKrause/dkg-orbitdb
- [ ] Implement js-libp2p communication layer
  - [ ] Local network discovery (mDNS) - not available in browsers
  - [ ] Public DHT fallback
  - [ ] Encrypted peer-to-peer channels
- [ ] QR code signing flow UI/UX
- [ ] Multi-device Passkey coordination
- [ ] Key share generation and storage
  - [ ] Encrypted storage on Storacha
  - [ ] Share recovery mechanism
- [ ] Threshold signature protocol implementation
- [ ] Mobile PWA optimization
- [ ] Cross-device session management
- [ ] Security audit of DKG implementation

**Timeline**: 12-24 months (research + implementation)

### Technical References

- **FROST**: Flexible Round-Optimized Schnorr Threshold signatures
- **js-libp2p**: Modular peer-to-peer networking stack
- **OrbitDB DKG**: Existing DKG implementation for reference
- **WebAuthn Level 3**: Future standards for enhanced credential capabilities

---

## Phase 3: Production Hardening

**Goal**: Prepare the application for production use with comprehensive security validation.

### Roadmap

- [ ] Comprehensive security audit by third-party
- [ ] Penetration testing
- [ ] Formal verification of cryptographic protocols
- [ ] Bug bounty program
- [ ] Production deployment infrastructure
- [ ] User documentation and security best practices
- [ ] Compliance review (GDPR, data protection)

**Timeline**: 6-12 months after Phase 2

**Dependencies**: Should be performed after Phase 0 (Revocation) and ideally after Phase 1 (P-256) or Phase 2 (DKG) depending on which features are implemented first.

---

## Contributing to the Roadmap

Want to help accelerate this roadmap?

1. **🔥 Priority: Implement Revocation** (Phase 0): Help build delegation revocation and validation
2. **Test the P-256 Fork**: Try [NiKrause/ucanto p256 branch](https://github.com/NiKrause/ucanto/tree/p256)
3. **Research DKG**: Investigate threshold signature schemes (FROST, GG20, etc.)
4. **Review Code**: Help audit implementations
5. **Documentation**: Improve technical documentation and guides
6. **Integration Work**: Assist with Storacha P-256 integration

---

## Questions & Discussion

For questions about this roadmap or to propose new features:

- Open an issue on GitHub
- Reference this document in discussions
- Tag issues with `roadmap` or `planning`

---

## Related Documents

- [SECURITY.md](./SECURITY.md) - Security considerations and current limitations
- [README.md](./README.md) - Project overview and getting started
- [LICENSE](./LICENSE) - MIT License
