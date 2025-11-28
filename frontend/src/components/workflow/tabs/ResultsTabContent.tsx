import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/stores/workflow'
import { NodeExecutionResult } from '@/types'
import {
  AlertTriangle,
  Box,
  CheckCircle,
  Clock,
  Database,
  FileText,
  XCircle
} from 'lucide-react'
import { useMemo, useState } from 'react'

interface ResultsTabContentProps {
  displayResults: NodeExecutionResult[]
  nodeId?: string
}

export function ResultsTabContent({ displayResults, nodeId }: ResultsTabContentProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodeId || null)
  const { workflow } = useWorkflowStore()

  // Group results by node
  const nodeResultGroups = useMemo(() => {
    return displayResults.map((result) => {
      const node = workflow?.nodes.find(n => n.id === result.nodeId)
      return {
        nodeId: result.nodeId,
        nodeName: node?.name || result.nodeId,
        nodeType: node?.type || 'unknown',
        result,
        status: result.status
      }
    })
  }, [displayResults, workflow])

  // Get selected node result
  const selectedNodeResult = useMemo(() => {
    if (!selectedNodeId) return null
    return nodeResultGroups.find(g => g.nodeId === selectedNodeId)
  }, [selectedNodeId, nodeResultGroups])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'skipped':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'running':
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />
      default:
        return <div className="h-4 w-4 rounded-full bg-muted" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600'
      case 'error': return 'text-red-600'
      case 'cancelled': return 'text-yellow-600'
      case 'running': return 'text-blue-600'
      case 'skipped': return 'text-muted-foreground'
      default: return 'text-muted-foreground'
    }
  }

  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (status) {
      case 'success': return 'default'
      case 'error': return 'destructive'
      default: return 'outline'
    }
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
    return `${(ms / 60000).toFixed(2)}m`
  }

  if (displayResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Database className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-sm mb-2">No Results Available</h3>
        <p className="text-xs text-muted-foreground max-w-[250px]">
          Execute the workflow to see execution results
        </p>
      </div>
    )
  }

  // If nodeId is provided (dialog mode), show only that node's details
  if (nodeId) {
    const nodeResult = nodeResultGroups.find(g => g.nodeId === nodeId)
    
    if (!nodeResult) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-sm mb-2">No Results for This Node</h3>
          <p className="text-xs text-muted-foreground max-w-[250px]">
            This node hasn't been executed yet
          </p>
        </div>
      )
    }

    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="p-4">
          {/* Node Header */}
          <div className="mb-4 pb-4 border-b">
            <div className="flex items-center gap-2 mb-2">
              <Box className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-base">{nodeResult.nodeName}</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Type: {nodeResult.nodeType}</span>
              <span>•</span>
              <span>Status: <span className={getStatusColor(nodeResult.status)}>{nodeResult.status}</span></span>
              {nodeResult.result.duration && (
                <>
                  <span>•</span>
                  <span>Duration: {formatDuration(nodeResult.result.duration)}</span>
                </>
              )}
            </div>
          </div>

          {/* Error Section */}
          {nodeResult.result.error && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="h-4 w-4 text-red-600" />
                <h4 className="font-semibold text-sm text-red-600">Error</h4>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                <pre className="text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap break-all">
                  {nodeResult.result.error}
                </pre>
              </div>
            </div>
          )}

          {/* Output Data Section */}
          {nodeResult.result.data && (
            <div className="bg-muted/30 rounded-lg border p-3">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all overflow-auto max-h-96">
                {JSON.stringify(nodeResult.result.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Full view mode with navigation tree
  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* Left Navigation Tree */}
      <div className="w-64 border-r border-border flex-shrink-0 overflow-y-auto">
        <div className="p-2">
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">
            Nodes ({nodeResultGroups.length})
          </div>
          <div className="space-y-1">
            {nodeResultGroups.map((group) => (
              <div key={group.nodeId}>
                <div
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/50 transition-colors",
                    selectedNodeId === group.nodeId && "bg-muted"
                  )}
                  onClick={() => setSelectedNodeId(group.nodeId)}
                >
                  <div className="flex-shrink-0">
                    {getStatusIcon(group.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{group.nodeName}</div>
                    <div className="text-xs text-muted-foreground truncate">{group.nodeType}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Badge 
                      variant={getStatusBadgeVariant(group.status)} 
                      className="h-5 px-1 text-xs"
                    >
                      {group.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Details Panel */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!selectedNodeId ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-sm mb-2">Select a Node</h3>
            <p className="text-xs text-muted-foreground max-w-[250px]">
              Click on a node from the left to view its execution results
            </p>
          </div>
        ) : selectedNodeResult ? (
          <div className="p-4">
            {/* Node Header */}
            <div className="mb-4 pb-4 border-b">
              <div className="flex items-center gap-2 mb-2">
                <Box className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-base">{selectedNodeResult.nodeName}</h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Type: {selectedNodeResult.nodeType}</span>
                <span>•</span>
                <span>Status: <span className={getStatusColor(selectedNodeResult.status)}>{selectedNodeResult.status}</span></span>
                {selectedNodeResult.result.duration && (
                  <>
                    <span>•</span>
                    <span>Duration: {formatDuration(selectedNodeResult.result.duration)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Error Section */}
            {selectedNodeResult.result.error && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <h4 className="font-semibold text-sm text-red-600">Error Details</h4>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <pre className="text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap break-all">
                    {selectedNodeResult.result.error}
                  </pre>
                </div>
              </div>
            )}

            {/* Output Data Section */}
            {selectedNodeResult.result.data && (
              <div className="bg-muted/30 rounded-lg border p-3">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all overflow-auto max-h-96">
                  {JSON.stringify(selectedNodeResult.result.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
