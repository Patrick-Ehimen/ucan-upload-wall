import { ExternalLink, Copy, Check, RefreshCw, HardDrive, Upload as UploadIcon, Trash2, Loader2 } from 'lucide-react';
import { UploadedFile } from '../types/upload';
import { StoredFile } from '../hooks/useFileListing';
import { useState } from 'react';

interface FileListProps {
  files: UploadedFile[];
  storedFiles?: StoredFile[];
  isLoadingStored?: boolean;
  onRefreshStored?: () => void;
  storedFilesError?: string | null;
  canListFiles?: boolean;
  canDeleteFiles?: boolean;
  deletingFiles?: Set<string>;
  onDeleteFile?: (cid: string) => void;
}

export function FileList({ files, storedFiles, isLoadingStored, onRefreshStored, storedFilesError, canListFiles = true, canDeleteFiles = false, deletingFiles = new Set(), onDeleteFile }: FileListProps) {
  const [copiedCid, setCopiedCid] = useState<string | null>(null);

  const handleCopyCid = async (cid: string) => {
    try {
      await navigator.clipboard.writeText(cid);
      setCopiedCid(cid);
      setTimeout(() => setCopiedCid(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const hasCurrentFiles = files.length > 0;
  const hasStoredFiles = storedFiles && storedFiles.length > 0;
  const hasAnyFiles = hasCurrentFiles || hasStoredFiles;

  const renderFileItem = (file: UploadedFile | StoredFile, isStored = false) => {
    const fileId = 'id' in file ? file.id : `stored-${file.cid}`;
    const fileName = 'filename' in file ? file.filename : file.name || 'Unknown file';
    const fileSize = file.size || 0;
    const uploadDate = 'uploadedAt' in file ? file.uploadedAt : file.uploadedAt || new Date().toISOString();
    
    return (
      <div
        key={fileId}
        className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-gray-900 truncate">
                {fileName}
              </h3>
              {isStored ? (
                <HardDrive className="w-4 h-4 text-blue-600" title="Stored in space" />
              ) : (
                <UploadIcon className="w-4 h-4 text-green-600" title="Recently uploaded" />
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
              <span>{formatFileSize(fileSize)}</span>
              <span>•</span>
              <span>{formatDate(uploadDate)}</span>
              {isStored && <span className="text-blue-600">• From space</span>}
            </div>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
              <code className="flex-1 text-xs text-gray-700 font-mono truncate">
                {file.cid}
              </code>
              <button
                onClick={() => handleCopyCid(file.cid)}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                title="Copy CID"
              >
                {copiedCid === file.cid ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-600" />
                )}
              </button>
              <a
                href={`https://w3s.link/ipfs/${file.cid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                title="View on IPFS"
              >
                <ExternalLink className="w-4 h-4 text-gray-600" />
              </a>
              {/* Delete button - only for stored files */}
              {isStored && (
                <button
                  onClick={() => onDeleteFile?.(file.cid)}
                  disabled={!canDeleteFiles || deletingFiles.has(file.cid)}
                  className={`p-1.5 rounded transition-colors flex-shrink-0 ${
                    canDeleteFiles 
                      ? 'hover:bg-red-100 text-red-600 hover:text-red-700' 
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                  title={canDeleteFiles ? 'Delete file' : 'Delete not available (no permission)'}
                >
                  {deletingFiles.has(file.cid) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className={`w-4 h-4 ${!canDeleteFiles ? 'line-through' : ''}`} />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!hasAnyFiles) {
    return (
      <div className="w-full max-w-2xl mt-12 text-center">
        <div className="py-16 px-6 bg-white rounded-xl border border-gray-200">
          {!canListFiles ? (
            <>
              <p className="text-amber-600 mb-4">
                🔒 Cannot list files from space - missing list permissions
              </p>
              <p className="text-gray-500 text-sm mb-4">
                Your current delegation does not include file listing capabilities.
                Only recently uploaded files in this session are shown.
              </p>
            </>
          ) : (
            <p className="text-gray-500 mb-4">
              {isLoadingStored ? 'Loading files from space...' : 'No files found. Start by uploading your first file!'}
            </p>
          )}
          
          {storedFilesError && (
            <p className="text-red-600 text-sm mt-2">Error loading stored files: {storedFilesError}</p>
          )}
          {onRefreshStored && !isLoadingStored && canListFiles && (
            <button
              onClick={onRefreshStored}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Files
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mt-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Files</h2>
        {onRefreshStored && (
          <button
            onClick={onRefreshStored}
            disabled={isLoadingStored}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingStored ? 'animate-spin' : ''}`} />
            {isLoadingStored ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>
      
      {storedFilesError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">Error loading stored files: {storedFilesError}</p>
        </div>
      )}
      
      <div className="space-y-3">
        {/* Recently uploaded files */}
        {files.map((file) => renderFileItem(file, false))}
        
        {/* Files from space storage */}
        {storedFiles?.map((file) => renderFileItem(file, true))}
      </div>
    </div>
  );
}
