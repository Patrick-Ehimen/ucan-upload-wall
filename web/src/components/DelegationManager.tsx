import { useState, useEffect } from 'react';
import { Share, Copy, Check, Plus, Users, Download, Upload, Shield, Trash2, ArrowRight, User, Clock, Key } from 'lucide-react';
import { UCANDelegationService, DelegationInfo } from '../lib/ucan-delegation';

interface DelegationManagerProps {
  delegationService: UCANDelegationService;
}

export function DelegationManager({ delegationService }: DelegationManagerProps) {
  const [currentDID, setCurrentDID] = useState<string | null>(null);
  const [createdDelegations, setCreatedDelegations] = useState<DelegationInfo[]>([]);
  const [receivedDelegations, setReceivedDelegations] = useState<DelegationInfo[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [targetDID, setTargetDID] = useState('');
  const [importProof, setImportProof] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showDelegationProof, setShowDelegationProof] = useState(false);
  const [createdDelegationProof, setCreatedDelegationProof] = useState('');
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([
    'space/blob/add', 'space/blob/list', 'upload/add', 'upload/list'
  ]);

  // Available capabilities with descriptions
  const availableCapabilities = [
    { id: 'space/blob/add', label: 'Upload Files', description: 'Add files to the space', category: 'Upload' },
    { id: 'space/blob/list', label: 'List Files (Space)', description: 'List files in the space', category: 'List' },
    { id: 'space/blob/remove', label: 'Delete Files (Space)', description: 'Remove files from the space', category: 'Delete' },
    { id: 'upload/add', label: 'Upload Files (Alt)', description: 'Alternative upload capability', category: 'Upload' },
    { id: 'upload/list', label: 'List Files (Upload)', description: 'List uploaded files', category: 'List' },
    { id: 'upload/remove', label: 'Delete Files (Upload)', description: 'Remove uploaded files', category: 'Delete' },
    { id: 'store/add', label: 'Store Data', description: 'Store data in the space', category: 'Store' },
    { id: 'store/list', label: 'List Stored Data', description: 'List stored data', category: 'Store' },
    { id: 'store/remove', label: 'Remove Stored Data', description: 'Remove stored data', category: 'Store' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setCurrentDID(delegationService.getCurrentDID());
    setCreatedDelegations(delegationService.getCreatedDelegations());
    setReceivedDelegations(delegationService.getReceivedDelegations());
  };

  const handleCreateDelegation = async () => {
    if (!targetDID) {
      alert('Please enter a target DID');
      return;
    }

    if (selectedCapabilities.length === 0) {
      alert('Please select at least one capability to delegate');
      return;
    }

    setIsCreating(true);
    try {
      console.log('🔄 Creating delegation for target DID:', targetDID);
      console.log('🛠️ Selected capabilities:', selectedCapabilities);
      const delegationProof = await delegationService.createDelegation(targetDID, selectedCapabilities);
      console.log('✅ Delegation created, proof length:', delegationProof?.length || 0);
      console.log('📄 Delegation proof preview:', delegationProof?.substring(0, 100) + '...');
      
      loadData();
      setShowCreateForm(false);
      setTargetDID('');
      
      // Show the created delegation proof in modal
      if (delegationProof && delegationProof.length > 0) {
        setCreatedDelegationProof(delegationProof);
        setShowDelegationProof(true);
        console.log('📋 Modal state set - showing delegation proof');
      } else {
        console.error('❌ Empty delegation proof received!');
        alert('Delegation was created but proof is empty. Check console for details.');
      }
    } catch (error) {
      console.error('❌ Delegation creation failed:', error);
      alert(`Failed to create delegation: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleImportDelegation = async () => {
    if (!importProof) {
      alert('Please paste a delegation proof');
      return;
    }

    try {
      await delegationService.importDelegation(importProof);
      loadData();
      setShowImportForm(false);
      setImportProof('');
      alert('Delegation imported successfully!');
    } catch (error) {
      alert(`Failed to import delegation: ${error}`);
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

  const handleDeleteCreatedDelegations = () => {
    if (createdDelegations.length === 0) {
      alert('No created delegations to delete.');
      return;
    }
    
    if (confirm(`Are you sure you want to delete all ${createdDelegations.length} created delegation(s)? This action cannot be undone.`)) {
      delegationService.clearCreatedDelegations();
      loadData();
      alert('All created delegations have been deleted.');
    }
  };

  const handleDeleteReceivedDelegations = () => {
    if (receivedDelegations.length === 0) {
      alert('No received delegations to delete.');
      return;
    }
    
    if (confirm(`Are you sure you want to delete all ${receivedDelegations.length} received delegation(s)? This will remove your upload capabilities from other browsers.`)) {
      delegationService.clearReceivedDelegations();
      loadData();
      alert('All received delegations have been deleted.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          UCAN Delegations
        </h2>
        <p className="text-gray-600">
          Manage delegations to share upload capabilities across browsers
        </p>
      </div>

      {/* Current DID */}
      {currentDID && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-blue-500 mr-3" />
              <div>
                <h3 className="text-blue-800 font-medium">Your DID</h3>
                <code className="text-sm text-blue-700 break-all">{currentDID}</code>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(currentDID, 'current-did')}
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              {copiedField === 'current-did' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Delegation
        </button>
        
        <button
          onClick={() => setShowImportForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Download className="h-4 w-4 mr-2" />
          Import Delegation
        </button>
      </div>

      {/* Create Delegation Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Create New Delegation
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target DID (from another browser)
              </label>
              <input
                type="text"
                value={targetDID}
                onChange={(e) => setTargetDID(e.target.value)}
                placeholder="did:key:..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Capabilities to Delegate
              </label>
              
              <div className="space-y-4">
                {/* Group capabilities by category */}
                {['Upload', 'List', 'Delete', 'Store'].map(category => {
                  const categoryCapabilities = availableCapabilities.filter(cap => cap.category === category);
                  if (categoryCapabilities.length === 0) return null;
                  
                  return (
                    <div key={category} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                        {category === 'Upload' && <Upload className="h-4 w-4 mr-2 text-green-600" />}
                        {category === 'List' && <Users className="h-4 w-4 mr-2 text-blue-600" />}
                        {category === 'Delete' && <Trash2 className="h-4 w-4 mr-2 text-red-600" />}
                        {category === 'Store' && <Shield className="h-4 w-4 mr-2 text-purple-600" />}
                        {category} Capabilities
                      </h4>
                      
                      <div className="space-y-2">
                        {categoryCapabilities.map(capability => (
                          <label key={capability.id} className="flex items-start space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedCapabilities.includes(capability.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCapabilities(prev => [...prev, capability.id]);
                                } else {
                                  setSelectedCapabilities(prev => prev.filter(id => id !== capability.id));
                                }
                              }}
                              className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{capability.label}</div>
                              <div className="text-xs text-gray-500">{capability.description}</div>
                              <code className="text-xs text-gray-400 bg-gray-100 px-1 py-0.5 rounded">{capability.id}</code>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick selection buttons */}
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setSelectedCapabilities(['space/blob/add', 'space/blob/list'])}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                >
                  Basic (Upload + List)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCapabilities(['space/blob/add', 'space/blob/list', 'upload/add', 'upload/list'])}
                  className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                >
                  Recommended
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCapabilities(availableCapabilities.map(cap => cap.id))}
                  className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                >
                  All Capabilities
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCapabilities([])}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Clear All
                </button>
              </div>
              
              <div className="text-xs text-gray-500 mt-2">
                Selected: {selectedCapabilities.length} capability(ies)
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleCreateDelegation}
                disabled={isCreating}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Share className="h-4 w-4 mr-2" />
                {isCreating ? 'Creating...' : 'Create Delegation'}
              </button>
              
              <button
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Delegation Form */}
      {showImportForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Import Delegation
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delegation Proof
              </label>
              <textarea
                value={importProof}
                onChange={(e) => setImportProof(e.target.value)}
                placeholder="Paste the delegation proof here..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                rows={4}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleImportDelegation}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Import Delegation
              </button>
              
              <button
                onClick={() => setShowImportForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Created Delegations */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Upload className="h-6 w-6 text-green-500 mr-3" />
            <h3 className="text-xl font-semibold text-gray-900">
              Delegations Created ({createdDelegations.length})
            </h3>
          </div>
          {createdDelegations.length > 0 && (
            <button
              onClick={handleDeleteCreatedDelegations}
              className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 flex items-center text-sm"
              title="Delete all created delegations"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete All
            </button>
          )}
        </div>

        {createdDelegations.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Share className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Delegations Created</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              Create a delegation to share your upload capabilities with another browser. 
              This allows others to upload files using your Storacha credentials.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Delegation
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {createdDelegations.map((delegation) => (
              <div key={delegation.id} className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <Share className="h-5 w-5 text-green-600 mr-2" />
                      <span className="font-semibold text-gray-900">Delegation Created</span>
                    </div>
                    <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-medium">
                      Shared
                    </div>
                  </div>
                  
                  {/* Delegation Chain Visualization */}
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <div className="text-xs font-medium text-gray-600 mb-2">DELEGATION FLOW:</div>
                    <div className="flex items-center space-x-2 text-sm">
                      <div className="flex items-center bg-green-100 px-2 py-1 rounded text-green-800">
                        <Shield className="h-3 w-3 mr-1" />
                        <span className="font-medium">You</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                      <div className="flex items-center bg-orange-100 px-2 py-1 rounded text-orange-800">
                        <User className="h-3 w-3 mr-1" />
                        <span className="font-medium">Recipient</span>
                      </div>
                    </div>
                    
                    <div className="mt-3 space-y-2">
                      <div className="text-xs">
                        <span className="font-medium text-gray-600">From:</span>
                        <code className="ml-1 text-xs bg-green-50 text-green-700 px-1 py-0.5 rounded">
                          {delegation.fromIssuer?.startsWith('did:key:') 
                            ? `${delegation.fromIssuer.slice(0, 20)}...${delegation.fromIssuer.slice(-8)}`
                            : delegation.fromIssuer || currentDID || 'Your DID'
                          }
                        </code>
                      </div>
                      <div className="text-xs">
                        <span className="font-medium text-gray-600">To:</span>
                        <code className="ml-1 text-xs bg-orange-50 text-orange-700 px-1 py-0.5 rounded">
                          {delegation.toAudience.startsWith('did:key:') 
                            ? `${delegation.toAudience.slice(0, 20)}...${delegation.toAudience.slice(-8)}`
                            : delegation.toAudience
                          }
                        </code>
                      </div>
                    </div>
                  </div>
                  
                  {/* Delegation Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Clock className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="font-medium text-gray-600">Created:</span>
                        <span className="ml-1 text-gray-900">
                          {new Date(delegation.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="text-sm">
                        <span className="font-medium text-gray-600">Delegation ID:</span>
                        <code className="ml-1 text-xs bg-gray-100 text-gray-700 px-1 py-0.5 rounded">
                          {delegation.id.length > 16 ? `${delegation.id.slice(0, 16)}...` : delegation.id}
                        </code>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-1">Capabilities Granted:</div>
                      <div className="flex flex-wrap gap-1">
                        {delegation.capabilities.map((cap, index) => (
                          <span key={index} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-green-200">
                    <div className="text-xs text-gray-500">
                      Share this delegation proof with the recipient to grant them upload permissions
                    </div>
                    <button
                      onClick={() => copyToClipboard(delegation.proof || btoa(JSON.stringify(delegation)), `created-${delegation.id}`)}
                      className="flex items-center text-green-600 hover:text-green-800 text-sm"
                      title="Copy delegation proof to share"
                    >
                      {copiedField === `created-${delegation.id}` ? 
                        <><Check className="h-4 w-4 mr-1" /> Copied!</> : 
                        <><Copy className="h-4 w-4 mr-1" /> Copy to Share</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Received Delegations */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Download className="h-6 w-6 text-blue-500 mr-3" />
            <h3 className="text-xl font-semibold text-gray-900">
              Delegations Received ({receivedDelegations.length})
            </h3>
          </div>
          {receivedDelegations.length > 0 && (
            <button
              onClick={handleDeleteReceivedDelegations}
              className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 flex items-center text-sm"
              title="Delete all received delegations"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete All
            </button>
          )}
        </div>

        {receivedDelegations.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Download className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Delegations Received</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              Import a delegation from another browser to gain upload capabilities. 
              Ask someone with Storacha credentials to create a delegation for your DID.
            </p>
            {currentDID && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg max-w-md mx-auto">
                <p className="text-sm font-medium text-blue-900 mb-2">Your DID (share this):</p>
                <div className="flex items-center justify-between bg-white p-2 rounded border">
                  <code className="text-xs text-blue-700 flex-1 truncate">
                    {currentDID}
                  </code>
                  <button
                    onClick={() => copyToClipboard(currentDID, 'current-did-empty')}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    {copiedField === 'current-did-empty' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => setShowImportForm(true)}
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Import Delegation
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {receivedDelegations.map((delegation) => (
              <div key={delegation.id} className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <Key className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="font-semibold text-gray-900">Delegation Chain</span>
                    </div>
                    <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-medium">
                      Active
                    </div>
                  </div>
                  
                  {/* Delegation Chain Visualization */}
                  <div className="bg-white rounded-lg p-3 border border-blue-200">
                    <div className="text-xs font-medium text-gray-600 mb-2">DELEGATION FLOW:</div>
                    <div className="flex items-center space-x-2 text-sm">
                      <div className="flex items-center bg-purple-100 px-2 py-1 rounded text-purple-800">
                        <User className="h-3 w-3 mr-1" />
                        <span className="font-medium">Issuer</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                      <div className="flex items-center bg-blue-100 px-2 py-1 rounded text-blue-800">
                        <Shield className="h-3 w-3 mr-1" />
                        <span className="font-medium">You</span>
                      </div>
                    </div>
                    
                    <div className="mt-3 space-y-2">
                      <div className="text-xs">
                        <span className="font-medium text-gray-600">From:</span>
                        <code className="ml-1 text-xs bg-purple-50 text-purple-700 px-1 py-0.5 rounded">
                          {delegation.fromIssuer?.startsWith('did:key:') 
                            ? `${delegation.fromIssuer.slice(0, 20)}...${delegation.fromIssuer.slice(-8)}`
                            : delegation.fromIssuer || 'Unknown Issuer'
                          }
                        </code>
                      </div>
                      <div className="text-xs">
                        <span className="font-medium text-gray-600">To:</span>
                        <code className="ml-1 text-xs bg-blue-50 text-blue-700 px-1 py-0.5 rounded">
                          {delegation.toAudience?.startsWith('did:key:') 
                            ? `${delegation.toAudience.slice(0, 20)}...${delegation.toAudience.slice(-8)}`
                            : delegation.toAudience || 'Unknown Audience'
                          }
                        </code>
                        {currentDID && delegation.toAudience !== currentDID && (
                          <div className="mt-1 text-xs text-red-600 font-medium">
                            ⚠️ DID Mismatch - delegation is for different credential
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Delegation Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Clock className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="font-medium text-gray-600">Received:</span>
                        <span className="ml-1 text-gray-900">
                          {new Date(delegation.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="text-sm">
                        <span className="font-medium text-gray-600">Delegation ID:</span>
                        <code className="ml-1 text-xs bg-gray-100 text-gray-700 px-1 py-0.5 rounded">
                          {delegation.id.length > 16 ? `${delegation.id.slice(0, 16)}...` : delegation.id}
                        </code>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-1">Capabilities:</div>
                      <div className="flex flex-wrap gap-1">
                        {delegation.capabilities.map((cap, index) => (
                          <span key={index} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                    <div className="text-xs text-gray-500">
                      This delegation allows you to upload files using another browser's permissions
                    </div>
                    <button
                      onClick={() => copyToClipboard(delegation.proof, `received-${delegation.id}`)}
                      className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
                      title="Copy delegation proof"
                    >
                      {copiedField === `received-${delegation.id}` ? 
                        <><Check className="h-4 w-4 mr-1" /> Copied!</> : 
                        <><Copy className="h-4 w-4 mr-1" /> Copy Proof</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delegation Proof Modal */}
      {showDelegationProof && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  🎉 Delegation Created Successfully!
                </h3>
                <button
                  onClick={() => setShowDelegationProof(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-gray-600">
                  Copy this delegation proof and share it with the target browser:
                </p>
                
                {/* Debug info */}
                <div className="text-xs text-gray-500">
                  Debug: Proof length: {createdDelegationProof?.length || 0}
                </div>
                
                <div className="relative">
                  <textarea
                    value={createdDelegationProof || 'No delegation proof available'}
                    readOnly
                    className="w-full p-3 border border-gray-300 rounded-lg font-mono text-xs bg-gray-50"
                    rows={8}
                    placeholder="Delegation proof will appear here..."
                  />
                  <button
                    onClick={() => copyToClipboard(createdDelegationProof, 'delegation-proof')}
                    className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center"
                  >
                    {copiedField === 'delegation-proof' ? (
                      <><Check className="h-4 w-4 mr-1" /> Copied!</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" /> Copy</>
                    )}
                  </button>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">📋 Next Steps:</h4>
                  <ol className="text-blue-800 text-sm space-y-1 list-decimal list-inside">
                    <li>Copy the delegation proof above</li>
                    <li>Open the target browser (Browser B)</li>
                    <li>Go to the Delegations tab</li>
                    <li>Click "Import Delegation" and paste the proof</li>
                    <li>Browser B can now upload files using your permissions!</li>
                  </ol>
                </div>
                
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowDelegationProof(false)}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
