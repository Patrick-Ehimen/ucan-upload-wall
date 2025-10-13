import { useState, useCallback, useEffect } from 'react';
import { UCANDelegationService } from '../lib/ucan-delegation';

export interface StoredFile {
  cid: string;
  name?: string;
  size?: number;
  uploadedAt?: string;
}

export function useFileListing(delegationService: UCANDelegationService) {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());

  const loadFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const fileList = await delegationService.listFiles();
      setFiles(fileList);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load files';
      setError(errorMessage);
      console.error('Failed to load files:', err);
    } finally {
      setIsLoading(false);
    }
  }, [delegationService]);

  const deleteFile = useCallback(async (cid: string) => {
    try {
      setDeletingFiles(prev => new Set([...prev, cid]));
      
      const result = await delegationService.deleteFile(cid);
      
      if (result.success) {
        // Remove from local state and refresh from server
        setFiles(prev => prev.filter(file => file.cid !== cid));
        // Also refresh to get the latest state from server
        setTimeout(() => loadFiles(), 1000);
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete file';
      setError(errorMessage);
      console.error('Failed to delete file:', err);
    } finally {
      setDeletingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(cid);
        return newSet;
      });
    }
  }, [delegationService, loadFiles]);

  const refreshFiles = useCallback(() => {
    loadFiles();
  }, [loadFiles]);

  // Check permissions
  const canListFiles = delegationService.canListFiles();
  const canDeleteFiles = delegationService.canDeleteFiles();

  // Load files on mount if setup is complete
  useEffect(() => {
    if (delegationService.isSetupComplete() && canListFiles) {
      loadFiles();
    }
  }, [delegationService, loadFiles, canListFiles]);

  return {
    files,
    isLoading,
    error,
    deletingFiles,
    canListFiles,
    canDeleteFiles,
    refreshFiles,
    loadFiles,
    deleteFile
  };
}
