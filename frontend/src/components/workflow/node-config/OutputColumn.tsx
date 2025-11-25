import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { JsonEditor } from '@/components/ui/json-editor'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNodeConfigDialogStore, useWorkflowStore } from '@/stores'
import { useNodeTypesStore } from '@/stores/nodeTypes'
import { WorkflowNode } from '@/types'
import {
  AlertCircle,
  Copy,
  Database,
  Download,
  Edit,
  Pin,
  PinOff,
  Table as TableIcon
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ImagePreviewOutput } from './output-components/ImagePreviewOutput'
import { getOutputComponent } from './output-components/OutputComponentRegistry'
import { TableView } from './output-components/TableView'

interface OutputColumnProps {
  node: WorkflowNode
  readOnly?: boolean
}

export function OutputColumn({ node }: OutputColumnProps) {
  const [viewMode, setViewMode] = useState<'json' | 'table'>('json')
  const { getNodeExecutionResult } = useWorkflowStore()
  const { getNodeTypeById } = useNodeTypesStore()
  const {
    mockData,
    mockDataPinned,
    mockDataEditor,
    openMockDataEditor,
    closeMockDataEditor,
    updateMockDataContent,
    updateMockData,
    toggleMockDataPinned
  } = useNodeConfigDialogStore()

  const nodeExecutionResult = getNodeExecutionResult(node.id)
  const nodeTypeDefinition = getNodeTypeById(node.type)

  // Get custom output component if defined
  // Temporary: Check node type directly until database migration is complete
  const CustomOutputComponent = nodeTypeDefinition?.outputComponent
    ? getOutputComponent(nodeTypeDefinition.outputComponent)
    : node.type === 'image-preview'
      ? ImagePreviewOutput
      : undefined

  const handleMockDataSave = () => {
    try {
      const parsed = JSON.parse(mockDataEditor.content)
      updateMockData(parsed)
      closeMockDataEditor()
      toast.success('Mock data saved successfully')
    } catch (error) {
      toast.error('Invalid JSON format. Please check your syntax.')
    }
  }

  const handleMockDataClear = () => {
    updateMockData(null)
    closeMockDataEditor()
    toast.success('Mock data cleared')
  }

  // Helper function to safely extract node output data
  const extractNodeOutputData = (nodeExecutionResult: any) => {
    try {
      // Handle the new standardized format from backend
      if (nodeExecutionResult?.data?.main || nodeExecutionResult?.data?.branches) {
        const { main, branches, metadata } = nodeExecutionResult.data;

        // For branching nodes (like IF), return the branches structure for separate display
        if (metadata?.hasMultipleBranches && branches) {
          return {
            type: 'branches',
            branches: branches,
            metadata: metadata
          };
        }

        // For regular nodes, extract the JSON data from main
        if (main && main.length > 0) {
          // If main contains objects with 'json' property, extract that
          if (main[0]?.json) {
            // If there are multiple items, return array of unwrapped json
            if (main.length > 1) {
              return main.map((item: any) => item.json);
            }
            // Single item: return just the json content
            return main[0].json;
          }
          // Otherwise return the main array directly
          return main.length > 1 ? main : main[0];
        }
      }

      // Fallback for legacy format handling
      if (nodeExecutionResult?.data?.[0]?.main?.[0]?.json) {
        return nodeExecutionResult.data[0].main[0].json;
      }

      if (Array.isArray(nodeExecutionResult?.data) && nodeExecutionResult.data.length > 0) {
        return nodeExecutionResult.data[0];
      }

      if (nodeExecutionResult?.data && typeof nodeExecutionResult.data === 'object') {
        return nodeExecutionResult.data;
      }

      return null;
    } catch (error) {
      console.warn('Failed to extract node output data:', error);
      return null;
    }
  }

  // Determine what data to show - mock data if pinned and available, otherwise execution result
  const displayData = mockDataPinned && mockData
    ? mockData
    : extractNodeOutputData(nodeExecutionResult)
  const isShowingMockData = mockDataPinned && mockData
  const isBranchingNode = displayData?.type === 'branches'

  // Helper to detect if data contains downloadable content
  const hasDownloadableContent = (data: any): boolean => {
    if (!data || isBranchingNode) return false
    return !!(data?.content && data?.contentType)
  }

  // Download file from content field
  const handleDownload = () => {
    if (!displayData?.content || !displayData?.contentType) return
    
    try {
      // Decode base64 data
      const byteCharacters = atob(displayData.content)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: displayData.contentType })

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = displayData.file?.name || displayData.fileName || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('File downloaded successfully')
    } catch (error) {
      console.error('Failed to download file:', error)
      toast.error('Failed to download file')
    }
  }

  return (
    <div className="flex w-full h-full border-l flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Output Data</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Edit Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={openMockDataEditor}
            className="h-7 px-2 text-xs gap-1"
          >
            <Edit className="h-3 w-3" />
            Edit
          </Button>

          {/* Download Button - Show if data has downloadable content */}
          {hasDownloadableContent(displayData) && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="h-7 px-2 text-xs gap-1"
            >
              <Download className="h-3 w-3" />
              Download
            </Button>
          )}

          {/* Copy Button */}
          {displayData && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const copyData = isBranchingNode ? displayData.branches : displayData;
                navigator.clipboard.writeText(JSON.stringify(copyData, null, 2))
                toast.success('Copied to clipboard')
              }}
              className="h-7 px-2 text-xs gap-1"
            >
              <Copy className="h-3 w-3" />
              Copy
            </Button>
          )}

          {/* Pin Mock Data Toggle */}
          {mockData && (
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-background border">
              <Switch
                checked={mockDataPinned}
                onCheckedChange={toggleMockDataPinned}
              />
              <div className="flex items-center gap-1">
                {mockDataPinned ? (
                  <Pin className="h-3 w-3 text-orange-600" />
                ) : (
                  <PinOff className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="text-xs font-medium">
                  {mockDataPinned ? 'Pinned' : 'Pin Mock'}
                </span>
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* Mock Data Editor - Full Width/Height when open */}
        {mockDataEditor.isOpen ? (
          <div className="h-full flex flex-col bg-card">
            {/* Editor Header */}


            {/* Editor Content */}
            <div className="flex-1  flex flex-col min-h-0">
              <JsonEditor
                value={mockDataEditor.content}
                onValueChange={updateMockDataContent}
                placeholder='{\n  "message": "Hello World",\n  "data": {\n    "success": true\n  }\n}'


                className="flex-1"
                required
              />
            </div>

            {/* Editor Actions */}
            <div className="p-4 border-t bg-muted/10">
              <div className="flex gap-2">
                <Button
                  onClick={handleMockDataSave}
                  size="sm"
                  className="flex-1"
                >
                  Save Changes
                </Button>
                <Button
                  onClick={handleMockDataClear}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  Clear All
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Main Output Display - Only shown when editor is closed */
          <ScrollArea className="h-full">
            <div className="p-4 h-full flex flex-col space-y-4">
              {/* Error Message at Top */}
              {nodeExecutionResult?.status === 'error' && nodeExecutionResult?.error && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 flex-shrink-0">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold mb-1">Execution Failed</div>
                    <div className="text-xs whitespace-pre-wrap break-words">{nodeExecutionResult.error}</div>
                  </div>
                </div>
              )}

              {/* Pin Message at Top */}
              {isShowingMockData && (
                <div className="flex items-center justify-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 flex-shrink-0">
                  <span>💡 This mock data is currently pinned and will be used for connected nodes</span>
                </div>
              )}

              {displayData ? (
                isBranchingNode ? (
                  /* Branching Node Display - Show each branch separately */
                  <div className="flex flex-col h-full space-y-4">
                    <div className="flex items-center justify-between flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Database className="h-4 w-4" />
                          <h3 className="text-sm font-medium">
                            Branch Outputs ({displayData.metadata?.nodeType || 'Conditional'})
                          </h3>
                        </div>
                        <Badge variant="default">
                          {Object.keys(displayData.branches || {}).length} Branches
                        </Badge>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 space-y-3">
                      {Object.entries(displayData.branches || {}).map(([branchName, branchData]) => (
                        <div key={branchName} className="border rounded-lg">
                          {/* Branch Header */}
                          <div className="flex items-center justify-between p-3 bg-muted/50 border-b rounded-t-lg">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${branchName === 'true' ? 'bg-green-500' :
                                branchName === 'false' ? 'bg-red-500' : 'bg-blue-500'
                                }`} />
                              <span className="font-medium text-sm capitalize">{branchName} Path</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {Array.isArray(branchData) ? branchData.length : 0} items
                            </Badge>
                          </div>

                          {/* Branch Content */}
                          <div className="p-3">
                            {Array.isArray(branchData) && branchData.length > 0 ? (
                              <ScrollArea className="h-32 w-full">
                                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                                  {JSON.stringify(branchData, null, 2)}
                                </pre>
                              </ScrollArea>
                            ) : (
                              <div className="text-xs text-muted-foreground italic text-center py-4">
                                No data in this branch
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Regular Node Display - Single output */
                  <div className="flex flex-col h-full space-y-4">
                    {/* Render custom output component if available, otherwise show JSON/Table tabs */}
                    {CustomOutputComponent ? (
                      <>
                        <div className="flex items-center justify-between flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Database className="h-4 w-4" />
                              <h3 className="text-sm font-medium">
                                {isShowingMockData ? 'Mock Data Output' : 'Execution Output'}
                              </h3>
                            </div>
                            <Badge
                              variant={isShowingMockData ? "secondary" : "default"}
                              className={isShowingMockData ? "bg-amber-100 text-amber-800" : ""}
                            >
                              {isShowingMockData ? 'Mock' : nodeExecutionResult?.status || 'Ready'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex-1 min-h-0">
                          <CustomOutputComponent
                            data={displayData}
                            nodeType={node.type}
                            executionStatus={nodeExecutionResult?.status}
                          />
                        </div>
                      </>
                    ) : (
                      /* Regular JSON/Table output for nodes without custom output component */
                      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'json' | 'table')} className="flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between flex-shrink-0">
                          <TabsList className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground w-auto">
                            <TabsTrigger value="json" className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium">
                              <Database className="h-3 w-3 mr-1" />
                              JSON
                            </TabsTrigger>
                            <TabsTrigger value="table" className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium">
                              <TableIcon className="h-3 w-3 mr-1" />
                              Table
                            </TabsTrigger>
                          </TabsList>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={isShowingMockData ? "secondary" : "default"}
                              className={isShowingMockData ? "bg-amber-100 text-amber-800" : ""}
                            >
                              {isShowingMockData ? 'Mock' : nodeExecutionResult?.status || 'Ready'}
                            </Badge>
                          </div>
                        </div>

                        <TabsContent value="json" className="flex-1 min-h-0 mt-0 p-3">
                          <div className="rounded-md border bg-muted/30 p-3 h-full">
                            <ScrollArea className="h-full w-full">
                              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                                {JSON.stringify(displayData, null, 2)}
                              </pre>
                            </ScrollArea>
                          </div>
                        </TabsContent>

                        <TabsContent value="table" className="flex-1 min-h-0 mt-0 p-3">
                          <div className="rounded-md border bg-muted/30 h-full">
                            <TableView data={displayData} />
                          </div>
                        </TabsContent>
                      </Tabs>
                    )}
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Database className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium text-sm mb-2">No Output Data</h3>
                  <p className="text-xs text-muted-foreground mb-4 max-w-[200px]">
                    Execute the workflow or create mock data to see output
                  </p>
                  <Button
                    onClick={openMockDataEditor}
                    size="sm"
                    variant="outline"
                    className="gap-1"
                  >
                    <Edit className="h-3 w-3" />
                    Create Mock Data
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
