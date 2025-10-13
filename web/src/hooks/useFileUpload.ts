import { useState } from 'react';
import { UploadResponse, UploadError } from '../types/upload';
import { UCANDelegationService } from '../lib/ucan-delegation';

const delegationService = new UCANDelegationService();

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File): Promise<UploadResponse | null> => {
    setIsUploading(true);
    setError(null);

    try {
      // Check if setup is complete
      if (!delegationService.isSetupComplete()) {
        throw new Error('Setup incomplete. Please add your Storacha credentials first.');
      }

      // Initialize WebAuthn DID if needed
      await delegationService.initializeWebAuthnDID();

      // Upload file using browser-only Storacha client
      const result = await delegationService.uploadFile(file);
      
      return {
        ok: true,
        cid: result.cid
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading, error, delegationService };
}
