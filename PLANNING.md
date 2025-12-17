# 🚀 Future Planning & Roadmap

This document outlines the planned evolution of the UCAN Upload Wall project toward production-ready, hardware-backed security.

## Overview

The project will evolve through three major phases:

1. **P-256 Integration** - Enable hardware-backed WebAuthn signing
2. **Multi-Device DKG** - Distributed key generation across multiple devices
3. **Production Hardening** - Security audits and deployment

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

---

## Contributing to the Roadmap

Want to help accelerate this roadmap?

1. **Test the P-256 Fork**: Try [NiKrause/ucanto p256 branch](https://github.com/NiKrause/ucanto/tree/p256)
2. **Research DKG**: Investigate threshold signature schemes (FROST, GG20, etc.)
3. **Review Code**: Help audit implementations
4. **Documentation**: Improve technical documentation and guides
5. **Integration Work**: Assist with Storacha P-256 integration

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
