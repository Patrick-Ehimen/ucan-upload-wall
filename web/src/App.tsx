import { useState, useCallback, useEffect } from 'react';
import { Settings, Upload, Share } from 'lucide-react';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { FileList } from './components/FileList';
import { Alert } from './components/Alert';
import { Setup } from './components/Setup';
import { DelegationManager } from './components/DelegationManager';
import { useFileUpload } from './hooks/useFileUpload';
import { useFileListing } from './hooks/useFileListing';
import { UploadedFile } from './types/upload';

type AppView = 'setup' | 'upload' | 'delegations';

function App() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('setup');
  const [didCreated, setDidCreated] = useState(false);
  const { uploadFile, isUploading, error, delegationService } = useFileUpload();
  const { files: storedFiles, isLoading: isLoadingStored, error: storedFilesError, deletingFiles, canListFiles, canDeleteFiles, refreshFiles, deleteFile } = useFileListing(delegationService);
  
  useEffect(() => {
    // Check if setup is complete on load
    if (delegationService.isSetupComplete()) {
      setCurrentView('upload');
    }
    
    // Check if DID is available
    const hasDID = !!delegationService.getCurrentDID();
    setDidCreated(hasDID);
  }, [delegationService]);
  
  // Add a periodic check for DID creation (since it might happen async)
  useEffect(() => {
    const interval = setInterval(() => {
      const hasDID = !!delegationService.getCurrentDID();
      if (hasDID !== didCreated) {
        setDidCreated(hasDID);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [didCreated, delegationService]);

  const handleFileSelect = useCallback(async (file: File) => {
    const result = await uploadFile(file);

    if (result && result.ok) {
      const newFile: UploadedFile = {
        id: crypto.randomUUID(),
        cid: result.cid,
        filename: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      setUploadedFiles(prev => [newFile, ...prev]);
      setAlert({
        type: 'success',
        message: `Successfully uploaded ${file.name}!`,
      });
      
      // Refresh stored files to show the newly uploaded file
      setTimeout(() => refreshFiles(), 1000);
    } else if (error) {
      setAlert({
        type: 'error',
        message: error,
      });
    }
  }, [uploadFile, error]);

  const handleCloseAlert = useCallback(() => {
    setAlert(null);
  }, []);

  const handleSetupComplete = () => {
    // Update state to reflect changes
    const hasDID = !!delegationService.getCurrentDID();
    setDidCreated(hasDID);
    setCurrentView('upload');
  };
  
  const handleDidCreated = () => {
    // Callback for when DID is created in Setup component
    const hasDID = !!delegationService.getCurrentDID();
    setDidCreated(hasDID);
  };

  const renderNavigation = () => {
    const hasCredentials = !!delegationService.getStorachaCredentials();
    const hasDID = !!delegationService.getCurrentDID();
    const hasReceivedDelegations = delegationService.getReceivedDelegations().length > 0;
    
    // Different access rules:
    // - Setup: Always accessible
    // - Upload: Accessible if has credentials OR has received delegations
    // - Delegations: Accessible if has DID (for Browser A and Browser B)
    const canAccessUpload = hasCredentials || hasReceivedDelegations;
    const canAccessDelegations = hasDID;
    
    return (
      <nav className="bg-white border-b border-gray-200 mb-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-center space-x-8">
            <button
              onClick={() => setCurrentView('setup')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                currentView === 'setup'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Settings className="h-4 w-4 inline mr-2" />
              Setup
            </button>
            
            <button
              onClick={() => setCurrentView('upload')}
              disabled={!canAccessUpload}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                currentView === 'upload'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Upload className="h-4 w-4 inline mr-2" />
              Upload Files
              {!canAccessUpload && (
                <span className="ml-1 text-xs text-gray-400">(needs credentials or delegation)</span>
              )}
            </button>
            
            <button
              onClick={() => setCurrentView('delegations')}
              disabled={!canAccessDelegations}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                currentView === 'delegations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Share className="h-4 w-4 inline mr-2" />
              Delegations
              {!canAccessDelegations && (
                <span className="ml-1 text-xs text-gray-400">(needs DID)</span>
              )}
            </button>
          </div>
        </div>
      </nav>
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case 'setup':
        return (
          <Setup 
            delegationService={delegationService} 
            onSetupComplete={handleSetupComplete}
            onDidCreated={handleDidCreated}
          />
        );
      
      case 'delegations':
        return (
          <DelegationManager delegationService={delegationService} />
        );
      
      case 'upload':
      default:
        return (
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex flex-col items-center">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-gray-900 mb-3">
                  Store it your way
                </h2>
                <p className="text-lg text-gray-600 max-w-2xl">
                  Upload files directly to the Storacha network with WebAuthn DID + UCAN authorization.
                  Your data stays verifiable, private, and under your control — no servers, no intermediaries.
                </p>
              </div>

              <UploadZone onFileSelect={handleFileSelect} isUploading={isUploading} />
              <FileList 
                files={uploadedFiles} 
                storedFiles={storedFiles}
                isLoadingStored={isLoadingStored}
                onRefreshStored={refreshFiles}
                storedFilesError={storedFilesError}
                canListFiles={canListFiles}
                canDeleteFiles={canDeleteFiles}
                deletingFiles={deletingFiles}
                onDeleteFile={deleteFile}
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />
      {renderNavigation()}
      <main>
        {renderContent()}
      </main>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={handleCloseAlert}
        />
      )}
    </div>
  );
}

export default App;
