import { AlertCircle, CheckCircle, ChevronDown, ChevronRight, FileArchive, RefreshCw, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { globalToastManager } from '../../hooks/useToast';
import { NodeType, nodeTypeService } from '../../services/nodeType';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface UploadState {
  uploading: boolean;
  dragActive: boolean;
  result: any | null;
  error: string | null;
}

export const CustomNodeUpload: React.FC<{ onUploadSuccess?: () => void }> = ({ onUploadSuccess }) => {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    dragActive: false,
    result: null,
    error: null,
  });
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [showInstalledNodes] = useState(false);
  const [installedNodes, setInstalledNodes] = useState<NodeType[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(false);
  // const [processingNode] = useState<string | null>(null);

  const resetState = () => {
    setState(prev => ({
      ...prev,
      result: null,
      error: null,
    }));
  };

  // Load installed custom nodes
  const loadInstalledNodes = async () => {
    setLoadingNodes(true);
    try {
      const allNodes = await nodeTypeService.getAllNodeTypes();
      // Filter for custom nodes (you can adjust this logic based on how you identify custom nodes)
      const customNodes = allNodes.filter(node => 
        node.type.includes('custom-') || 
        node.group.includes('Custom') ||
        !['core', 'trigger', 'regular'].some(category => node.group.includes(category))
      );
      setInstalledNodes(customNodes);
    } catch (error) {
      console.error('Failed to load installed nodes:', error);
      globalToastManager.showError(
        'Failed to Load Nodes',
        { message: 'Could not load installed custom nodes' }
      );
    } finally {
      setLoadingNodes(false);
    }
  };

  // Delete/uninstall a custom node
  /* const handleDeleteNode = async (nodeType: NodeType) => {
    if (!confirm(`Are you sure you want to uninstall "${nodeType.displayName}"?`)) {
      return;
    }

    setProcessingNode(nodeType.identifier);
    try {
      await nodeTypeService.deleteNodeType(nodeType.identifier);
      
      globalToastManager.showSuccess(
        'Node Uninstalled',
        { message: `Successfully uninstalled ${nodeType.displayName}` }
      );
      
      // Refresh the list
      await loadInstalledNodes();
      
      if (onUploadSuccess) {
        onUploadSuccess(); // Refresh parent components
      }
    } catch (error: any) {
      console.error('Failed to delete node:', error);
      globalToastManager.showError(
        'Uninstall Failed',
        { 
          message: error?.response?.data?.message || `Failed to uninstall ${nodeType.displayName}`,
          duration: 8000
        }
      );
    } finally {
      setProcessingNode(null);
    }
  }; */

  // Toggle node active status
  /* const handleToggleNodeStatus = async (nodeType: NodeType) => {
    const newStatus = !nodeType.active;
    setProcessingNode(nodeType.identifier);
    
    try {
      await nodeTypeService.updateNodeTypeStatus(nodeType.identifier, newStatus);
      
      globalToastManager.showSuccess(
        `Node ${newStatus ? 'Enabled' : 'Disabled'}`,
        { message: `${nodeType.displayName} is now ${newStatus ? 'active' : 'inactive'}` }
      );
      
      // Refresh the list
      await loadInstalledNodes();
    } catch (error: any) {
      console.error('Failed to toggle node status:', error);
      globalToastManager.showError(
        'Status Update Failed',
        { 
          message: error?.response?.data?.message || `Failed to update ${nodeType.displayName}`,
          duration: 8000
        }
      );
    } finally {
      setProcessingNode(null);
    }
  }; */

  // Load nodes when section is first expanded
  useEffect(() => {
    if (showInstalledNodes && installedNodes.length === 0 && !loadingNodes) {
      loadInstalledNodes();
    }
  }, [showInstalledNodes, installedNodes.length, loadingNodes]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setState(prev => ({ ...prev, dragActive: true }));
    } else if (e.type === 'dragleave') {
      setState(prev => ({ ...prev, dragActive: false }));
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState(prev => ({ ...prev, dragActive: false }));

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Validate file type
    if (!file.name.endsWith('.zip')) {
      setState(prev => ({
        ...prev,
        error: 'Please upload a ZIP file containing your custom nodes.',
        result: null,
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      uploading: true,
      error: null,
      result: null,
    }));

    try {
      const result = await nodeTypeService.uploadCustomNodes(file);
      
      setState(prev => ({
        ...prev,
        uploading: false,
        result,
        error: result.success ? null : (result.errors?.[0] || result.message || 'Upload failed'),
      }));

      if (result.success) {
        // Show success toast
        globalToastManager.showSuccess(
          'Custom Nodes Uploaded!',
          {
            message: `Successfully uploaded ${result.nodes?.length || 0} custom node(s)`,
            duration: 5000
          }
        );
        
        // Call the success callback and wait for it to complete
        if (onUploadSuccess) {
          try {
            await onUploadSuccess();
          } catch (error) {
            console.error('Error in upload success callback:', error);
          }
        }
      } else {
        // Show error toast for upload failures
        globalToastManager.showError(
          'Upload Failed',
          {
            message: result.errors?.[0] || result.message || 'Failed to upload custom nodes',
            duration: 8000
          }
        );
      }
    } catch (error: any) {
      // Handle API errors (e.g., network errors, server errors)
      console.error('Upload failed:', error);
      
      let errorMessage = 'Failed to upload file. Please try again.';
      
      // Extract detailed error message from various possible error structures
      if (error?.response?.data) {
        const errorData = error.response.data;
        if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
          errorMessage = errorData.errors[0];
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      // Show error toast
      globalToastManager.showError(
        'Upload Failed',
        {
          message: errorMessage,
          duration: 8000
        }
      );
      
      setState(prev => ({
        ...prev,
        uploading: false,
        error: errorMessage,
        result: null,
      }));
    }
  };

  return (
    <div className="space-y-0">
      {/* Upload Area */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Upload Custom Nodes</span>
        </div>
        
        <div
          className={`relative border border-dashed rounded-md p-4 text-center transition-colors text-sm ${
            state.dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {state.uploading ? (
            <div className="flex flex-col items-center py-2">
              <RefreshCw className="h-6 w-6 text-primary animate-spin mb-2" />
              <p className="text-sm font-medium">Uploading...</p>
              <p className="text-xs text-muted-foreground">Processing node package</p>
            </div>
          ) : (
            <div className="py-2">
              <FileArchive className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
              <p className="text-sm mb-1">
                Drop ZIP file here or{' '}
                <label className="text-primary hover:text-primary/80 cursor-pointer underline">
                  browse
                  <Input
                    type="file"
                    accept=".zip"
                    onChange={handleFileInput}
                    className="hidden"
                    disabled={state.uploading}
                  />
                </label>
              </p>
              <p className="text-xs text-muted-foreground">
                ZIP files only • Max 50MB
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {state.error && (
        <div className="p-4 border-b bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Upload Failed</p>
              <p className="text-xs text-destructive/80 mt-1">{state.error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetState}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Success Display */}
      {state.result && state.result.success && (
        <div className="p-4 border-b bg-green-50">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800">Upload Successful</p>
              <p className="text-xs text-green-700 mt-1">{state.result.message}</p>
              
              {state.result.nodes && state.result.nodes.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-green-700 mb-1">
                    Added {state.result.nodes.length} node(s):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {state.result.nodes.slice(0, 3).map((node: any, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs h-5">
                        {node.displayName}
                      </Badge>
                    ))}
                    {state.result.nodes.length > 3 && (
                      <Badge variant="secondary" className="text-xs h-5">
                        +{state.result.nodes.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetState}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Guidelines Section */}
      <div className="border-b">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setShowGuidelines(!showGuidelines)}
        >
          <div className="flex items-center gap-2">
            {showGuidelines ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Upload Guidelines</span>
          </div>
        </div>

        {showGuidelines && (
          <div className="px-4 pb-4 space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-1">Required Files:</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-3">
                <li>• package.json - Package metadata</li>
                <li>• nodes/ - Node implementation files</li>
                <li>• credentials/ - (Optional) Custom credentials</li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-1">Node Files:</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-3">
                <li>• .node.ts or .node.js files</li>
                <li>• .node.json description files</li>
                <li>• Proper node class exports</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
