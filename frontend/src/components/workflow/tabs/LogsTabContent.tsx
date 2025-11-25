import { ExecutionLogEntry } from '@/types/execution'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  Database
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface LogsTabContentProps {
  logs: ExecutionLogEntry[]
  nodeId?: string
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

export function LogsTabContent({ logs, nodeId }: LogsTabContentProps) {
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [showAllLogs, setShowAllLogs] = useState(false)

  // Filter logs for this specific node if nodeId is provided
  const filteredLogs = nodeId 
    ? logs.filter(log => log.nodeId === nodeId)
    : logs

  // Parse logs to extract tool calls and service calls
  const parsedLogs: ToolCallLog[] = filteredLogs
    .filter(log => log.data?.toolCall || log.data?.serviceCall)
    .map((log, index) => {
      const toolCall = log.data?.toolCall || log.data?.serviceCall
      return {
        id: `${log.timestamp}-${index}`,
        toolName: toolCall?.name || toolCall?.toolName || 'Unknown',
        timestamp: typeof log.timestamp === 'string' ? log.timestamp : new Date(log.timestamp).toISOString(),
        duration: toolCall?.duration,
        input: toolCall?.input || toolCall?.arguments || {},
        output: toolCall?.output || toolCall?.result || {},
        success: toolCall?.success !== false,
        error: toolCall?.error,
        level: log.level,
      }
    })

  console.log('[LogsTabContent] Debug info:', {
    totalLogs: logs.length,
    filteredLogs: filteredLogs.length,
    parsedLogs: parsedLogs.length,
    nodeId,
    sampleLog: filteredLogs[0],
  })

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

  if (filteredLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Database className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-sm mb-2">No Logs Available</h3>
        <p className="text-xs text-muted-foreground max-w-[250px]">
          Execute the workflow to see detailed logs of tool and service calls
        </p>
      </div>
    )
  }

  if (parsedLogs.length === 0) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground text-center py-8">
          <p className="mb-4">No tool or service calls logged for this execution</p>
          {filteredLogs.length > 0 && (
            <div className="text-left max-w-2xl mx-auto">
              <p className="text-xs mb-2">Debug: Found {filteredLogs.length} logs but none contain tool/service call data.</p>
              <details className="text-xs">
                <summary className="cursor-pointer text-blue-600 hover:text-blue-700">Show all logs for debugging</summary>
                <div className="mt-2 space-y-2 max-h-96 overflow-auto">
                  {filteredLogs.map((log, i) => (
                    <div key={i} className="bg-muted p-2 rounded border">
                      <div className="font-semibold">{log.message}</div>
                      <div className="text-muted-foreground">Level: {log.level}</div>
                      {log.data && (
                        <pre className="mt-1 text-xs overflow-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        {/* Debug toggle */}
        {filteredLogs.length > parsedLogs.length && (
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded border mb-4">
            <span className="text-xs text-muted-foreground">
              Showing {parsedLogs.length} tool/service calls ({filteredLogs.length - parsedLogs.length} other logs hidden)
            </span>
            <button
              onClick={() => setShowAllLogs(!showAllLogs)}
              className="text-xs text-blue-600 hover:text-blue-700 underline"
            >
              {showAllLogs ? 'Hide' : 'Show'} all logs
            </button>
          </div>
        )}

        {/* Show all logs if debug mode is on */}
        {showAllLogs && (
          <div className="space-y-2 mb-4">
            <div className="text-xs font-semibold text-muted-foreground mb-2">All Execution Logs:</div>
            {filteredLogs.map((log, i) => (
              <div key={`all-${i}`} className="border rounded p-2 bg-muted/30 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  {getLevelIcon(log.level)}
                  <span className="font-medium">{log.message}</span>
                  <span className="text-muted-foreground ml-auto">
                    {formatTimestamp(typeof log.timestamp === 'string' ? log.timestamp : new Date(log.timestamp).toISOString())}
                  </span>
                </div>
                {log.data && (
                  <pre className="text-xs overflow-auto max-h-32 mt-2 p-2 bg-background rounded">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tool/Service call logs */}
        {parsedLogs.map((log) => {
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
                  <Wrench className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
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
    </ScrollArea>
  )
}
