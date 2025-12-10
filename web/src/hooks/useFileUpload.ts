import { useState } from 'react';
import { UploadResponse } from '../types/upload';
import { UCANDelegationService } from '../lib/ucan-delegation';

const delegationService = new UCANDelegationService();

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File): Promise<UploadResponse | null> => {
    console.log('🚀 Upload started for file:', file.name, 'Size:', file.size);
    setIsUploading(true);
    setError(null);

    try {
      // Check if setup is complete
      console.log('📋 Checking setup status...');
      const setupComplete = delegationService.isSetupComplete();
      console.log('Setup complete:', setupComplete);
      
      if (!setupComplete) {
        const credentials = delegationService.getStorachaCredentials();
        const delegations = delegationService.getReceivedDelegations();
        console.log('Has credentials:', !!credentials);
        console.log('Received delegations:', delegations.length);
        throw new Error('Setup incomplete. Please import a UCAN delegation or add Storacha credentials first.');
      }

      // Initialize WebAuthn DID if needed
      console.log('🔐 Initializing WebAuthn DID...');
      await delegationService.initializeWebAuthnDID();
      console.log('✅ WebAuthn DID initialized');

      // Upload file using browser-only Storacha client
      console.log('📤 Starting upload via delegationService.uploadFile()...');
      const result = await delegationService.uploadFile(file);
      console.log('✅ Upload completed! CID:', result.cid);
      
      return {
        ok: true,
        cid: result.cid
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      console.error('❌ Upload failed:', message);
      console.error('Full error:', err);
      setError(message);
      return null;
    } finally {
      setIsUploading(false);
      console.log('Upload process finished');
    }
  };

  return { uploadFile, isUploading, error, delegationService };
}
