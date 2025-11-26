import { ExecutionLogEntry } from '@/types/execution'
import { Badge } from '@/components/ui/badge'
import { 
  ChevronRight, 
  ChevronDown, 
  Clock, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Wrench,
  Bot,
  Database,
  Box,
  FileText
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/stores/workflow'

interface LogsTabContentProps {
  logs?: ExecutionLogEntry[]
  nodeId?: string
  isActive?: boolean
  onClearLogs?: () => void
}

interface ToolCallLog {
  id: string
  toolName: string
  timestamp: string
  duration?: number
  input: any
  output: any
  success: boolean
  error?: string
  level: 'info' | 'warn' | 'error' | 'debug'
}

interface NodeLogGroup {
  nodeId: string
  nodeName: string
  nodeType: string
  logs: ExecutionLogEntry[]
  toolCalls: ToolCallLog[]
  errorCount: number
  warnCount: number
  infoCount: number
}

export function LogsTabContent({ logs, nodeId }: LogsTabContentProps) {
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodeId || null)
  const { workflow } = useWorkflowStore()

  // Safety check: ensure logs is an array
  const safeLogs = Array.isArray(logs) ? logs : []

  // Group logs by node
  const nodeLogGroups = useMemo(() => {
    const groups = new Map<string, NodeLogGroup>()
    
    // Add a group for logs without nodeId (system logs)
    const systemLogs = safeLogs.filter(log => !log.nodeId)
    if (systemLogs.length > 0) {
      groups.set('__system__', {
        nodeId: '__system__',
        nodeName: 'System',
        nodeType: 'system',
        logs: systemLogs,
        toolCalls: [],
        errorCount: systemLogs.filter(l => l.level === 'error').length,
        warnCount: systemLogs.filter(l => l.level === 'warn').length,
        infoCount: systemLogs.filter(l => l.level === 'info').length,
      })
    }

    // Group logs by nodeId
    safeLogs.forEach(log => {
      if (!log.nodeId) return
      
      if (!groups.has(log.nodeId)) {
        const node = workflow?.nodes.find(n => n.id === log.nodeId)
        const toolCalls: ToolCallLog[] = []
        
        groups.set(log.nodeId, {
          nodeId: log.nodeId,
          nodeName: node?.name || log.nodeId,
          nodeType: node?.type || 'unknown',
          logs: [],
          toolCalls,
          errorCount: 0,
          warnCount: 0,
          infoCount: 0,
        })
      }
      
      const group = groups.get(log.nodeId)!
      group.logs.push(log)
      
      // Count by level
      if (log.level === 'error') group.errorCount++
      else if (log.level === 'warn') group.warnCount++
      else if (log.level === 'info') group.infoCount++
      
      // Extract tool calls
      if (log.data?.toolCall || log.data?.serviceCall) {
        const toolCall = log.data?.toolCall || log.data?.serviceCall
        group.toolCalls.push({
          id: `${log.timestamp}-${group.toolCalls.length}`,
          toolName: toolCall?.name || toolCall?.toolName || 'Unknown',
          timestamp: typeof log.timestamp === 'string' ? log.timestamp : new Date(log.timestamp).toISOString(),
          duration: toolCall?.duration,
          input: toolCall?.input || toolCall?.arguments || {},
          output: toolCall?.output || toolCall?.result || {},
          success: toolCall?.success !== false,
          error: toolCall?.error,
          level: log.level,
        })
      }
    })
    
    return Array.from(groups.values())
  }, [safeLogs, workflow])

  // Get logs for selected node
  const selectedNodeLogs = useMemo(() => {
    if (!selectedNodeId) return []
    const group = nodeLogGroups.find(g => g.nodeId === selectedNodeId)
    return group?.logs || []
  }, [selectedNodeId, nodeLogGroups])

  // Get tool calls for selected node
  const selectedNodeToolCalls = useMemo(() => {
    if (!selectedNodeId) return []
    const group = nodeLogGroups.find(g => g.nodeId === selectedNodeId)
    return group?.toolCalls || []
  }, [selectedNodeId, nodeLogGroups])

  const toggleExpanded = (logId: string) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpandedLogs(newExpanded)
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      const timeStr = date.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit'
      })
      const ms = date.getMilliseconds().toString().padStart(3, '0')
      return `${timeStr}.${ms}`
    } catch {
      return timestamp
    }
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  if (safeLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Database className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-sm mb-2">No Logs Available</h3>
        <p className="text-xs text-muted-foreground max-w-[250px]">
          Execute the workflow to see detailed logs
        </p>
      </div>
    )
  }

  // If nodeId is provided (dialog mode), show only that node's details
  if (nodeId) {
    const nodeGroup = nodeLogGroups.find(g => g.nodeId === nodeId)
    
    if (!nodeGroup || nodeGroup.logs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-sm mb-2">No Logs for This Node</h3>
          <p className="text-xs text-muted-foreground max-w-[250px]">
            This node hasn't generated any logs yet
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
              <h3 className="font-semibold text-base">{nodeGroup.nodeName}</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Type: {nodeGroup.nodeType}</span>
              <span>•</span>
              <span>{nodeGroup.logs.length} logs</span>
              {nodeGroup.toolCalls.length > 0 && (
                <>
                  <span>•</span>
                  <span>{nodeGroup.toolCalls.length} tool calls</span>
                </>
              )}
            </div>
          </div>

          {/* Tool Calls Section */}
          {nodeGroup.toolCalls.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">Tool & Service Calls</h4>
              </div>
              <div className="space-y-2">
                {nodeGroup.toolCalls.map((log) => {
                  const isExpanded = expandedLogs.has(log.id)
                  
                  return (
                    <div
                      key={log.id}
                      className={cn(
                        "border rounded-lg overflow-hidden transition-colors",
                        log.success ? "border-border" : "border-red-200 bg-red-50/50"
                      )}
                    >
                      {/* Log Header */}
                      <div
                        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpanded(log.id)}
                      >
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-shrink-0">
                          {getLevelIcon(log.level)}
                        </div>

                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-medium text-sm truncate">{log.toolName}</span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {log.duration && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDuration(log.duration)}
                            </Badge>
                          )}
                          <Badge 
                            variant={log.success ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {log.success ? 'Success' : 'Failed'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t bg-muted/30">
                          {/* Input Section */}
                          <div className="p-3 border-b">
                            <div className="flex items-center gap-2 mb-2">
                              <Bot className="h-3.5 w-3.5 text-blue-600" />
                              <span className="text-xs font-semibold text-blue-600">Input</span>
                            </div>
                            <div className="bg-background rounded border p-2">
                              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                                {JSON.stringify(log.input, null, 2)}
                              </pre>
                            </div>
                          </div>

                          {/* Output Section */}
                          <div className="p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Database className="h-3.5 w-3.5 text-green-600" />
                              <span className="text-xs font-semibold text-green-600">Output</span>
                            </div>
                            <div className="bg-background rounded border p-2">
                              {log.error ? (
                                <div className="text-xs text-red-600 font-mono whitespace-pre-wrap">
                                  {log.error}
                                </div>
                              ) : (
                                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                                  {JSON.stringify(log.output, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* All Logs Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">All Logs</h4>
            </div>
            <div className="space-y-2">
              {nodeGroup.logs.map((log, i) => (
                <div key={`log-${i}`} className="border rounded p-3 bg-muted/30 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    {getLevelIcon(log.level)}
                    <span className="font-medium flex-1">{log.message}</span>
                    <span className="text-muted-foreground">
                      {formatTimestamp(typeof log.timestamp === 'string' ? log.timestamp : new Date(log.timestamp).toISOString())}
                    </span>
                  </div>
                  {log.data && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-700 text-xs">
                        Show data
                      </summary>
                      <pre className="text-xs overflow-auto max-h-48 mt-2 p-2 bg-background rounded border">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
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
              Nodes ({nodeLogGroups.length})
            </div>
            <div className="space-y-1">
              {nodeLogGroups.map((group) => (
                <div key={group.nodeId}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/50 transition-colors",
                      selectedNodeId === group.nodeId && "bg-muted"
                    )}
                    onClick={() => setSelectedNodeId(group.nodeId)}
                  >
                    <div className="flex-shrink-0">
                      {group.nodeId === '__system__' ? (
                        <Database className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Box className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{group.nodeName}</div>
                      <div className="text-xs text-muted-foreground truncate">{group.nodeType}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {group.errorCount > 0 && (
                        <Badge variant="destructive" className="h-5 px-1 text-xs">
                          {group.errorCount}
                        </Badge>
                      )}
                      {group.warnCount > 0 && (
                        <Badge variant="outline" className="h-5 px-1 text-xs border-yellow-600 text-yellow-600">
                          {group.warnCount}
                        </Badge>
                      )}
                      {group.errorCount === 0 && group.warnCount === 0 && (
                        <Badge variant="outline" className="h-5 px-1 text-xs">
                          {group.logs.length}
                        </Badge>
                      )}
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
              Click on a node from the left to view its logs and details
            </p>
          </div>
        ) : (
          <div className="p-4">
              {/* Node Header */}
              <div className="mb-4 pb-4 border-b">
                <div className="flex items-center gap-2 mb-2">
                  <Box className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-base">
                    {nodeLogGroups.find(g => g.nodeId === selectedNodeId)?.nodeName}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Type: {nodeLogGroups.find(g => g.nodeId === selectedNodeId)?.nodeType}</span>
                  <span>•</span>
                  <span>{selectedNodeLogs.length} logs</span>
                  {selectedNodeToolCalls.length > 0 && (
                    <>
                      <span>•</span>
                      <span>{selectedNodeToolCalls.length} tool calls</span>
                    </>
                  )}
                </div>
              </div>

              {/* Tool Calls Section */}
              {selectedNodeToolCalls.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold text-sm">Tool & Service Calls</h4>
                  </div>
                  <div className="space-y-2">
                    {selectedNodeToolCalls.map((log) => {
                      const isExpanded = expandedLogs.has(log.id)
                      
                      return (
                        <div
                          key={log.id}
                          className={cn(
                            "border rounded-lg overflow-hidden transition-colors",
                            log.success ? "border-border" : "border-red-200 bg-red-50/50"
                          )}
                        >
                          {/* Log Header */}
                          <div
                            className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleExpanded(log.id)}
                          >
                            <div className="flex-shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>

                            <div className="flex-shrink-0">
                              {getLevelIcon(log.level)}
                            </div>

                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="font-medium text-sm truncate">{log.toolName}</span>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {log.duration && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {formatDuration(log.duration)}
                                </Badge>
                              )}
                              <Badge 
                                variant={log.success ? "default" : "destructive"}
                                className="text-xs"
                              >
                                {log.success ? 'Success' : 'Failed'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatTimestamp(log.timestamp)}
                              </span>
                            </div>
                          </div>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="border-t bg-muted/30">
                              {/* Input Section */}
                              <div className="p-3 border-b">
                                <div className="flex items-center gap-2 mb-2">
                                  <Bot className="h-3.5 w-3.5 text-blue-600" />
                                  <span className="text-xs font-semibold text-blue-600">Input</span>
                                </div>
                                <div className="bg-background rounded border p-2">
                                  <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                                    {JSON.stringify(log.input, null, 2)}
                                  </pre>
                                </div>
                              </div>

                              {/* Output Section */}
                              <div className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Database className="h-3.5 w-3.5 text-green-600" />
                                  <span className="text-xs font-semibold text-green-600">Output</span>
                                </div>
                                <div className="bg-background rounded border p-2">
                                  {log.error ? (
                                    <div className="text-xs text-red-600 font-mono whitespace-pre-wrap">
                                      {log.error}
                                    </div>
                                  ) : (
                                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                                      {JSON.stringify(log.output, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* All Logs Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold text-sm">All Logs</h4>
                </div>
                <div className="space-y-2">
                  {selectedNodeLogs.map((log, i) => (
                    <div key={`log-${i}`} className="border rounded p-3 bg-muted/30 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        {getLevelIcon(log.level)}
                        <span className="font-medium flex-1">{log.message}</span>
                        <span className="text-muted-foreground">
                          {formatTimestamp(typeof log.timestamp === 'string' ? log.timestamp : new Date(log.timestamp).toISOString())}
                        </span>
                      </div>
                      {log.data && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-700 text-xs">
                            Show data
                          </summary>
                          <pre className="text-xs overflow-auto max-h-48 mt-2 p-2 bg-background rounded border">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
        )}
      </div>
    </div>
  )
}
