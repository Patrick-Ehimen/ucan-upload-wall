# ⚠️ SECURITY WARNING

## 🚨 Critical Notice: Not Production Ready

**THIS CODE HAS NOT UNDERGONE A SECURITY AUDIT AND SHOULD NOT BE USED IN PRODUCTION ENVIRONMENTS.**

This project is an experimental proof-of-concept for WebAuthn-based UCAN delegations. It has not been reviewed by security professionals and may contain critical vulnerabilities. Use at your own risk for testing and educational purposes only.

---

## 🔓 Web Worker Security Vulnerabilities

### Attack Surface

While Web Workers provide some isolation from the main thread, they are **not a secure execution environment** and should not be relied upon for protecting sensitive cryptographic material.

### Known Attack Vectors

#### 1. **Code Injection Attacks**

Any malicious code injected into your application (via XSS, supply chain attacks, browser extensions, or compromised dependencies) can:

- **Read Worker Memory**: Access the worker's global scope and extract secrets
- **Intercept Messages**: Monitor `postMessage()` communication between main thread and worker
- **Monkey-Patch APIs**: Override `crypto.subtle`, `postMessage`, or other worker APIs to exfiltrate keys
- **Timing Attacks**: Measure execution time to infer information about private keys

**Example Attack:**
```javascript
// Malicious code injected into main thread or worker
const originalPostMessage = Worker.prototype.postMessage;
Worker.prototype.postMessage = function(msg) {
  console.log('Intercepted:', msg); // Exfiltrate secrets
  sendToAttacker(msg);
  return originalPostMessage.apply(this, arguments);
};
```

#### 2. **localStorage Vulnerabilities**

The encrypted Ed25519 archive is stored in `localStorage`, which is accessible to:
- Any JavaScript running in the same origin
- Browser extensions with appropriate permissions
- Physical access to the device (local storage is not encrypted at rest)

**Even with encryption**, an attacker who can inject code can:
- Wait for the decryption key to be used
- Intercept the decrypted archive during operation
- Capture the PRF seed when WebAuthn authentication occurs

#### 3. **Memory Dumping**

An attacker with sufficient privileges (e.g., via browser vulnerability, malicious extension) could:
- Dump worker memory to extract private keys
- Access the AES-GCM encryption key while it's in use
- Read plaintext secrets during cryptographic operations

#### 4. **Supply Chain Attacks**

Dependencies used in workers (`@ucanto/principal`, `@noble/hashes`, etc.) could be compromised:
- Malicious package updates
- Typosquatting attacks
- Compromised maintainer accounts

### References

For more information on Web Worker security limitations:
- [OWASP Web Worker Security](https://owasp.org/www-community/vulnerabilities/Insecure_Web_Worker)
- [MDN: Web Workers Security](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#security)
- [Web Worker XSS Attack Vectors](https://portswigger.net/web-security/cross-site-scripting/contexts/web-workers)
- [Content Security Policy and Workers](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#workers)

---

## 🛡️ Recommended Secure Architecture: Hardware-Backed P-256 DIDs

### The Secure Approach

The **most secure architecture** for this application would be to exclusively use **P-256 DIDs with WebAuthn**, where:

✅ **Private keys never leave hardware**  
✅ **Signing operations performed in secure enclaves** (TPM, Secure Element, Trusted Execution Environment)  
✅ **No key material exposed to JavaScript**  
✅ **Biometric authentication required for each operation**  
✅ **No encrypted keystores in localStorage**  

### Why P-256 + WebAuthn is Superior

| Feature | Current (Ed25519 + Worker) | Ideal (P-256 + WebAuthn) |
|---------|---------------------------|--------------------------|
| **Private Key Exposure** | ❌ Exists in worker memory | ✅ Never leaves hardware |
| **Attack Surface** | ❌ Large (JS injection, worker compromise) | ✅ Minimal (hardware isolation) |
| **Storage Security** | ❌ Encrypted in localStorage | ✅ No storage needed |
| **Signature Operations** | ❌ In JavaScript/WASM | ✅ In secure hardware |
| **Key Extraction** | ❌ Possible with code injection | ✅ Cryptographically impossible |
| **Biometric Gate** | ❌ One-time (for PRF seed) | ✅ Per-operation |

### Architecture Comparison

**Current Implementation (Insecure):**
```
WebAuthn (P-256) → PRF Seed → Worker AES Key → Decrypt Ed25519 Key → Sign in JS
      ↑                                                   ↑
   Hardware Secure                                   Software (Vulnerable)
```

**Ideal Implementation (Secure):**
```
WebAuthn (P-256) → Sign UCAN → Done
      ↑
   Hardware Secure (End-to-End)
```

---

## 🚧 Current Limitation: Storacha Doesn't Support P-256

### The Problem

Unfortunately, the [Storacha upload service](https://github.com/storacha/upload-service) currently **only supports Ed25519 signatures** for UCAN-based authentication. This forces applications to:

1. Generate Ed25519 keys in software (JavaScript)
2. Store these keys (even if encrypted)
3. Expose keys to potential extraction attacks

This architectural limitation **prevents the use of hardware-backed security** that WebAuthn/P-256 provides.

### Our Solution: P-256 Fork

We have implemented P-256 signature support in our fork of the UCAN library:

🔗 **[P-256 Implementation Fork](https://github.com/NiKrause/ucanto/tree/p256)**

This fork adds:
- P-256 signature verification
- WebAuthn-compatible signature schemes
- Hardware-backed UCAN signing

### Path to Production Security

For this application to be production-ready, the following steps are required:

1. ✅ **Complete**: P-256 support implemented in [NiKrause/ucanto](https://github.com/NiKrause/ucanto/tree/p256)
2. ⏳ **Pending**: Integrate P-256 into [storacha/upload-service](https://github.com/storacha/upload-service)
3. ⏳ **Pending**: Security audit of integration
4. ⏳ **Pending**: Deploy to production Storacha infrastructure

**Until Storacha supports P-256**, this application will continue to use the insecure Ed25519-in-worker pattern.

---

## 🔒 Mitigation Strategies (Current Architecture)

While the current architecture is insecure, the following measures reduce (but do not eliminate) risk:

### 1. Content Security Policy (CSP)
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self'; 
               worker-src 'self'; 
               connect-src 'self' https://up.storacha.network;">
```

### 2. Subresource Integrity (SRI)
Use SRI tags for all external scripts:
```html
<script src="..." integrity="sha384-..." crossorigin="anonymous"></script>
```

### 3. Dependency Pinning
Lock all dependencies to specific versions and audit regularly:
```bash
npm audit
npm audit fix
```

### 4. Short-Lived Sessions
- Clear worker memory after operations
- Re-authenticate frequently
- Don't persist decrypted keys

### 5. User Education
Warn users that:
- This is not production-grade security
- Private keys may be exposed to malicious code
- Only use for testing with non-critical data

---

## 📋 Security Checklist

Before using this application, ensure:

- [ ] You understand that **private keys can be extracted** by malicious code
- [ ] You are **not storing valuable or sensitive data**
- [ ] You have reviewed all dependencies for security issues
- [ ] You are running in an **isolated testing environment**
- [ ] You have a **Content Security Policy** configured
- [ ] You are **not using this in production**
- [ ] You understand that **localStorage is not secure storage**
- [ ] You accept the **risks of software-based key management**

---

## 🤝 Contributing to P-256 Integration

Want to help make this architecture secure? Here's how:

1. **Test the P-256 Fork**: Try [NiKrause/ucanto p256 branch](https://github.com/NiKrause/ucanto/tree/p256)
2. **Review Code**: Help audit the P-256 implementation
3. **Integration Work**: Assist with integrating P-256 into [storacha/upload-service](https://github.com/storacha/upload-service)
4. **Documentation**: Improve security documentation and best practices

---

## 📞 Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do NOT open a public issue**
2. Email security concerns to the maintainer
3. Provide detailed reproduction steps
4. Allow time for patches before public disclosure

---

## ⚖️ Disclaimer

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

**USE AT YOUR OWN RISK.**
