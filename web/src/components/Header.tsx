import { Lock, Shield } from 'lucide-react';
import { UCANDelegationService } from '../lib/ucan-delegation';

interface HeaderProps {
  onLockSession?: () => void;
  delegationService?: UCANDelegationService;
}

export function Header({ onLockSession, delegationService }: HeaderProps) {
  const isUsingEncrypted = delegationService?.isUsingEncryptedKeystore() ?? false;
  const currentDID = delegationService?.getCurrentDID();
  
  return (
    <header className="w-full bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🔐 UCAN Upload Wall <span className="text-lg text-blue-600">(Browser-Only)</span>
            </h1>
            <p className="text-sm text-gray-600">
              WebAuthn DID + Storacha Network • UCAN Delegation • No Servers
            </p>
          </div>
          
          {/* Security indicator and lock button */}
          {currentDID && (
            <div className="flex items-center gap-3">
              {/* Security status */}
              <div 
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200"
                title={isUsingEncrypted 
                  ? "🔐 Hardware-Protected: Ed25519 private key encrypted with AES-GCM 256-bit. Encryption key stored in WebAuthn hardware authenticator (largeBlob/hmac-secret). Protected from XSS and malicious extensions." 
                  : "⚠️ Unencrypted: Ed25519 private key stored in browser localStorage without encryption. Vulnerable to XSS and malicious extensions. Use hardware-protected encryption for better security."}
              >
                {isUsingEncrypted ? (
                  <>
                    <Lock className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">🔐 Hardware-Protected</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-700">⚠️ Unencrypted</span>
                  </>
                )}
              </div>
              
              {/* Lock session button (only for encrypted keystores) */}
              {isUsingEncrypted && onLockSession && (
                <button
                  onClick={onLockSession}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-colors"
                  title="Lock session"
                >
                  <Lock className="h-4 w-4 text-gray-700" />
                  <span className="text-sm font-medium text-gray-700">Lock</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
