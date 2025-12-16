import { Shield } from 'lucide-react';
import { UCANDelegationService } from '../lib/ucan-delegation';

interface HeaderProps {
  delegationService?: UCANDelegationService;
}

export function Header({ delegationService }: HeaderProps) {
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
          
              {/* Security indicator */}
          {currentDID && (
            <div className="flex items-center gap-3">
              {/* Security status */}
              <div 
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200"
                title="Ed25519 DID active. Keys are stored locally in your browser (no extra WebAuthn keystore encryption)."
              >
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Ed25519 DID Active</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
