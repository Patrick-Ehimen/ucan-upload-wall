import { useState, useEffect } from 'react';
import { Key, Shield, Copy, Check, AlertCircle, Smartphone, Lock } from 'lucide-react';
import { UCANDelegationService } from '../lib/ucan-delegation';
import { WebAuthnDIDProvider } from '../lib/webauthn-did';
import { checkExtensionSupport } from '../lib/keystore-encryption';

interface SetupProps {
  delegationService: UCANDelegationService;
  onSetupComplete?: () => void;
  onDidCreated?: () => void;
}

export function Setup({ delegationService, onSetupComplete, onDidCreated }: SetupProps) {
  const [credentials, setCredentials] = useState({
    key: '',
    proof: '',
    spaceDid: ''
  });
  const [currentDID, setCurrentDID] = useState<string | null>(null);
  const [isCreatingDID, setIsCreatingDID] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [webauthnSupported, setWebauthnSupported] = useState(false);
  
  // Encryption options
  const [useEncryption, setUseEncryption] = useState(true);
  const [encryptionMethod, setEncryptionMethod] = useState<'largeBlob' | 'hmac-secret'>('hmac-secret');
  const [extensionSupport, setExtensionSupport] = useState({ largeBlob: false, hmacSecret: false });
  const [isUsingEncrypted, setIsUsingEncrypted] = useState(false);

  useEffect(() => {
    // Check WebAuthn support
    setWebauthnSupported(WebAuthnDIDProvider.isSupported());
    
    // Check encryption extension support
    checkExtensionSupport().then(support => {
      setExtensionSupport(support);
      // Auto-select best method (prefer hmac-secret for wider browser support)
      if (support.hmacSecret) {
        setEncryptionMethod('hmac-secret');
      } else if (support.largeBlob) {
        setEncryptionMethod('largeBlob');
      } else {
        setUseEncryption(false); // Disable if no support
      }
    });
    
    // Load existing credentials
    const existing = delegationService.getStorachaCredentials();
    if (existing) {
      setCredentials(existing);
      setSavedCredentials(true);
    }

    // Load existing DID
    const did = delegationService.getCurrentDID();
    setCurrentDID(did);
    
    // Check if using encrypted keystore
    setIsUsingEncrypted(delegationService.isUsingEncryptedKeystore());
  }, [delegationService]);

  const handleCredentialChange = (field: keyof typeof credentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveCredentials = () => {
    if (!credentials.key || !credentials.proof || !credentials.spaceDid) {
      alert('Please fill in all credential fields');
      return;
    }

    delegationService.storeStorachaCredentials(credentials);
    setSavedCredentials(true);
    
    if (currentDID && onSetupComplete) {
      onSetupComplete();
    }
  };

  const handleCreateDID = async () => {
    setIsCreatingDID(true);
    try {
      if (useEncryption && webauthnSupported) {
        try {
          // Try to create encrypted keystore (triggers biometric)
          await delegationService.initializeSecureEd25519DID(encryptionMethod, false);
          setIsUsingEncrypted(true);
        } catch (encryptionError: any) {
          // If encryption fails (e.g., Safari doesn't support extensions), fall back to unencrypted
          console.warn('Hardware encryption failed, falling back to unencrypted:', encryptionError.message);
          
          if (confirm(
            'Hardware-protected encryption is not supported on this browser.\n\n' +
            'Would you like to create an UNENCRYPTED DID instead?\n' +
            '(Keys will be stored in browser localStorage without hardware protection)'
          )) {
            await delegationService.initializeEd25519DID(false);
            setIsUsingEncrypted(false);
          } else {
            throw new Error('DID creation cancelled');
          }
        }
      } else {
        // Create unencrypted keystore (localStorage only)
        await delegationService.initializeEd25519DID(false);
        setIsUsingEncrypted(false);
      }
      
      const did = delegationService.getCurrentDID();
      setCurrentDID(did);
      
      // Notify parent that DID was created
      if (onDidCreated) {
        onDidCreated();
      }
      
      if (savedCredentials && onSetupComplete) {
        onSetupComplete();
      }
    } catch (error) {
      alert(`Failed to create DID: ${error}`);
    } finally {
      setIsCreatingDID(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const isSetupComplete = savedCredentials && currentDID;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          Browser-Only Setup
        </h2>
        <p className="text-gray-600">
          Set up WebAuthn DID authentication and Storacha credentials for decentralized file uploads
        </p>
      </div>

      {/* WebAuthn Support Check */}
      {!webauthnSupported && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
            <div>
              <h3 className="text-red-800 font-medium">WebAuthn Not Supported</h3>
              <p className="text-red-700 text-sm">
                Your browser doesn't support WebAuthn. Please use a modern browser like Chrome, Firefox, or Safari.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: WebAuthn DID */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Key className="h-6 w-6 text-blue-500 mr-3" />
          <h3 className="text-xl font-semibold text-gray-900">
            Step 1: Create Ed25519 DID
          </h3>
        </div>
        
        <div className="space-y-4">
          <p className="text-gray-600">
            Generate an Ed25519 DID for UCAN delegations. Choose hardware-protected encryption for maximum security.
          </p>
          
          {currentDID ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isUsingEncrypted ? (
                    <Lock className="h-5 w-5 text-green-500" />
                  ) : (
                    <Shield className="h-5 w-5 text-green-500" />
                  )}
                  <div>
                    <span className="text-green-800 font-medium">DID Created</span>
                    <span className="text-xs text-green-600 ml-2">
                      {isUsingEncrypted ? '🔐 Hardware-Protected' : '⚠️ Unencrypted'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(currentDID, 'did')}
                  className="flex items-center text-green-600 hover:text-green-800"
                >
                  {copiedField === 'did' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-2">
                <code className="text-sm text-green-700 bg-green-100 px-2 py-1 rounded break-all">
                  {currentDID}
                </code>
              </div>
            </div>
          ) : (
            <>
              {/* Encryption Options */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-2">Security Options</h4>
                    
                    {/* Encryption toggle */}
                    <label className="flex items-center gap-2 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useEncryption}
                        onChange={(e) => setUseEncryption(e.target.checked)}
                        disabled={!extensionSupport.largeBlob && !extensionSupport.hmacSecret}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 font-medium">
                        Use hardware-protected encryption (Recommended)
                      </span>
                    </label>
                    
                    {/* Encryption method selection */}
                    {useEncryption && (
                      <div className="ml-6 space-y-2">
                        <p className="text-xs text-gray-600 mb-2">Encryption method:</p>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="encryptionMethod"
                            value="largeBlob"
                            checked={encryptionMethod === 'largeBlob'}
                            onChange={() => setEncryptionMethod('largeBlob')}
                            disabled={!extensionSupport.largeBlob}
                          />
                          <span className="text-sm text-gray-700">
                            largeBlob {extensionSupport.largeBlob ? '✅' : '❌ Not supported'}
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="encryptionMethod"
                            value="hmac-secret"
                            checked={encryptionMethod === 'hmac-secret'}
                            onChange={() => setEncryptionMethod('hmac-secret')}
                            disabled={!extensionSupport.hmacSecret}
                          />
                          <span className="text-sm text-gray-700">
                            hmac-secret {extensionSupport.hmacSecret ? '✅' : '❌ Not supported'}
                          </span>
                        </label>
                      </div>
                    )}
                    
                    {/* Security benefits */}
                    {useEncryption && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p className="text-xs font-medium text-gray-700 mb-1">🔐 Benefits:</p>
                        <ul className="text-xs text-gray-600 space-y-1">
                          <li>• Private key encrypted with AES-GCM 256-bit</li>
                          <li>• Encryption key stored in hardware authenticator</li>
                          <li>• Protected from XSS and malicious extensions</li>
                          <li>• Requires biometric to unlock each session</li>
                        </ul>
                      </div>
                    )}
                    
                    {!useEncryption && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-xs text-yellow-800">
                          ⚠️ Unencrypted mode: Private key will be stored in localStorage without encryption.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleCreateDID}
                  disabled={isCreatingDID || !webauthnSupported}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {useEncryption ? <Lock className="h-4 w-4 mr-2" /> : <Key className="h-4 w-4 mr-2" />}
                  {isCreatingDID ? 'Generating...' : useEncryption ? 'Create Secure DID' : 'Create DID'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Storacha Credentials */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Key className="h-6 w-6 text-purple-500 mr-3" />
          <h3 className="text-xl font-semibold text-gray-900">
            Step 2: Add Storacha Credentials
          </h3>
        </div>

        <div className="space-y-4">
          <p className="text-gray-600">
            Paste your Storacha space credentials. These will be stored securely in your browser.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Private Key
              </label>
              <textarea
                value={credentials.key}
                onChange={(e) => handleCredentialChange('key', e.target.value)}
                placeholder="Paste your Storacha private key here..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Space Proof
              </label>
              <textarea
                value={credentials.proof}
                onChange={(e) => handleCredentialChange('proof', e.target.value)}
                placeholder="Paste your Storacha space proof here..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Space DID
              </label>
              <input
                type="text"
                value={credentials.spaceDid}
                onChange={(e) => handleCredentialChange('spaceDid', e.target.value)}
                placeholder="did:key:..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            <button
              onClick={handleSaveCredentials}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center"
            >
              <Key className="h-4 w-4 mr-2" />
              Save Credentials
            </button>

            {savedCredentials && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-green-800 font-medium">Credentials Saved</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Setup Complete */}
      {isSetupComplete && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200 p-6">
          <div className="text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Setup Complete!
            </h3>
            <p className="text-gray-600 mb-4">
              You can now upload files and create UCAN delegations using WebAuthn authentication.
            </p>
            {onSetupComplete && (
              <button
                onClick={onSetupComplete}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
              >
                Continue to App
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}