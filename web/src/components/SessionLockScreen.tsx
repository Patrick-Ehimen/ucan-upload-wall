import { useState } from 'react';
import { Shield, Lock } from 'lucide-react';

interface SessionLockScreenProps {
  onUnlock: () => Promise<void>;
}

export function SessionLockScreen({ onUnlock }: SessionLockScreenProps) {
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    setUnlocking(true);
    setError(null);
    try {
      await onUnlock();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unlock session';
      setError(errorMessage);
      console.error('Failed to unlock:', err);
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="relative inline-block mb-8">
          <Shield className="h-24 w-24 text-blue-500" />
          <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-lg">
            <Lock className="h-6 w-6 text-gray-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Session Locked
        </h1>

        {/* Description */}
        <p className="text-gray-600 mb-8 leading-relaxed">
          Your private key is encrypted and protected by hardware.
          <br />
          Use your biometric authentication to unlock and access your files.
        </p>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Unlock button */}
        <button
          onClick={handleUnlock}
          disabled={unlocking}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center mx-auto gap-2"
        >
          {unlocking ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              Unlocking...
            </>
          ) : (
            <>
              🔓 Unlock with Biometric
            </>
          )}
        </button>

        {/* Security info */}
        <div className="mt-8 p-4 bg-white rounded-lg border border-gray-200">
          <div className="flex items-start gap-3 text-left">
            <Shield className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900 mb-1">
                🔐 Hardware-Protected Encryption
              </p>
              <p className="text-xs text-gray-600">
                Your Ed25519 private key is encrypted with AES-GCM 256-bit.
                The encryption key is stored securely in your device's hardware authenticator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
