import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useWorkflowStore } from '@/stores'
import { usePinnedOutputsStore } from '@/stores/pinnedOutputs'
import { AlertCircle, Copy, Database, FileText, Pin, X } from 'lucide-react'
import { memo, useState, useEffect } from 'react'
import { toast } from 'sonner'
import './toolbar-buttons.css'

interface OutputToolbarButtonProps {
  nodeId: string
  disabled?: boolean
}

export const OutputToolbarButton = memo(function OutputToolbarButton({
  nodeId,
  disabled = false,
}: OutputToolbarButtonProps) {
  const [open, setOpen] = useState(false)
  const { getNodeExecutionResult } = useWorkflowStore()
  const { isPinned: isNodePinned, setPinned } = usePinnedOutputsStore()
  const isPinned = isNodePinned(nodeId)
  
  // Keep popover open if pinned
  useEffect(() => {
    if (isPinned) {
      setOpen(true)
    }
  }, [isPinned])

  // Get execution result for this node
  const executionResult = getNodeExecutionResult(nodeId)

  // Helper function to safely extract node output data (same as OutputColumn)
  const extractNodeOutputData = (nodeExecutionResult: any) => {
    try {
      // Handle the new standardized format from backend
      if (nodeExecutionResult?.data?.main || nodeExecutionResult?.data?.branches) {
        const { main, branches, metadata } = nodeExecutionResult.data

        // For branching nodes (like IF), return the branches structure
        if (metadata?.hasMultipleBranches && branches) {
          return {
            type: 'branches',
            branches: branches,
            metadata: metadata,
          }
        }

        // For regular nodes, extract the JSON data from main
        if (main && main.length > 0) {
          // If main contains objects with 'json' property, extract that
          if (main[0]?.json) {
            // If there are multiple items, return array of unwrapped json
            if (main.length > 1) {
              return main.map((item: any) => item.json)
            }
            // Single item: return just the json content
            return main[0].json
          }
          // Otherwise return the main array directly
          return main.length > 1 ? main : main[0]
        }
      }

      // Fallback for legacy format handling
      if (nodeExecutionResult?.data?.[0]?.main?.[0]?.json) {
        return nodeExecutionResult.data[0].main[0].json
      }

      if (
        Array.isArray(nodeExecutionResult?.data) &&
        nodeExecutionResult.data.length > 0
      ) {
        return nodeExecutionResult.data[0]
      }

      if (
        nodeExecutionResult?.data &&
        typeof nodeExecutionResult.data === 'object'
      ) {
        return nodeExecutionResult.data
      }

      return null
    } catch (error) {
      console.warn('Failed to extract node output data:', error)
      return null
    }
  }

  const displayData = extractNodeOutputData(executionResult)
  const hasOutput = !!displayData
  const isBranchingNode = displayData?.type === 'branches'

  const handleCopy = () => {
    const copyData = isBranchingNode ? displayData.branches : displayData
    navigator.clipboard.writeText(JSON.stringify(copyData, null, 2))
    toast.success('Copied to clipboard')
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-50 text-green-700 border-green-200">Success</Badge>
      case 'error':
        return <Badge className="bg-red-50 text-red-700 border-red-200">Error</Badge>
      case 'running':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Running</Badge>
      default:
        return <Badge variant="outline">Idle</Badge>
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    // If pinned, keep it open (don't allow closing via focus lost or clicking outside)
    if (isPinned) {
      return
    }
    setOpen(newOpen)
  }

  const handleClose = () => {
    // Explicit close (unpin and close)
    setPinned(nodeId, false)
    setOpen(false)
  }

  const handlePinToggle = () => {
    setPinned(nodeId, !isPinned)
    if (!isPinned) {
      setOpen(true)
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
        <PopoverTrigger asChild>
          <button
            className="toolbar-button"
            disabled={disabled || !hasOutput}
            title={hasOutput ? 'View Output' : 'No output available'}
            aria-label="View node output"
            tabIndex={0}
            role="button"
          >
            <FileText className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
      <PopoverContent
        className="w-96 max-h-[600px] overflow-hidden p-0"
        align="end"
        side="right"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium text-sm">Node Output</h4>
            </div>
            <div className="flex items-center gap-1">
              {getStatusBadge(executionResult?.status)}
              <Button
                size="icon"
                variant="ghost"
                onClick={handlePinToggle}
                className={`h-6 w-6 ${isPinned ? 'text-orange-600' : 'text-muted-foreground'}`}
                title={isPinned ? 'Pinned - stays open for comparison' : 'Pin to keep open'}
              >
                <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-current' : ''}`} />
              </Button>
              {isPinned && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleClose}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 max-h-[500px]">
            <div className="p-4">
              {/* Error Message */}
              {executionResult?.status === 'error' && executionResult?.error && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold mb-1">Execution Failed</div>
                    <div className="text-xs whitespace-pre-wrap break-words">
                      {executionResult.error}
                    </div>
                  </div>
                </div>
              )}

              {/* Output Data */}
              {hasOutput ? (
                isBranchingNode ? (
                  /* Branching Node Display */
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Branch Outputs ({displayData.metadata?.nodeType || 'Conditional'})
                    </div>
                    {Object.entries(displayData.branches || {}).map(
                      ([branchName, branchData]) => (
                        <div key={branchName} className="border rounded-lg">
                          <div className="flex items-center justify-between p-2 bg-muted/50 border-b">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  branchName === 'true'
                                    ? 'bg-green-500'
                                    : branchName === 'false'
                                    ? 'bg-red-500'
                                    : 'bg-blue-500'
                                }`}
                              />
                              <span className="font-medium text-xs capitalize">
                                {branchName}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {Array.isArray(branchData) ? branchData.length : 0} items
                            </Badge>
                          </div>
                          <div className="p-2">
                            <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto overflow-y-auto max-h-[150px] max-w-full font-mono whitespace-pre break-words">
                              {JSON.stringify(branchData, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  /* Regular JSON Output */
                  <div className="space-y-2">
                    {executionResult?.duration && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>Duration: {executionResult.duration}ms</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleCopy}
                          className="h-5 w-5"
                          title="Copy to clipboard"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {!executionResult?.duration && hasOutput && (
                      <div className="flex items-center justify-end mb-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleCopy}
                          className="h-5 w-5"
                          title="Copy to clipboard"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto overflow-y-auto max-h-[400px] max-w-full font-mono whitespace-pre break-words">
                      {JSON.stringify(displayData, null, 2)}
                    </pre>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Database className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p>No output data available.</p>
                  <p className="text-xs mt-1">Execute the node to see results.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
    </>
  )
})

OutputToolbarButton.displayName = 'OutputToolbarButton'
