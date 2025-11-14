import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useWorkflowStore } from '@/stores'
import { WorkflowNode } from '@/types'
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Database, 
  Loader2,
  Package,
  PlayCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface ResponseTabProps {
  node: WorkflowNode
}

export function ResponseTab({ node }: ResponseTabProps) {
  const { getNodeExecutionResult } = useWorkflowStore()
  const nodeExecutionResult = getNodeExecutionResult(node.id)

  const handleCopy = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    toast.success('Copied to clipboard')
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
      default:
        return <PlayCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const getNodeStatusBadge = (status?: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Success
          </Badge>
        )
      case 'error':
        return (
          <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        )
      case 'running':
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Running
          </Badge>
        )
      case 'skipped':
        return (
          <Badge className="bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-50">
            Skipped
          </Badge>
        )
      default:
        return <Badge variant="outline">Idle</Badge>
    }
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return '0ms'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  if (!nodeExecutionResult) {
    return (
      <div className="h-[calc(100dvh-222px)] flex flex-col items-center justify-center p-8 text-center">
        <div className="rounded-full bg-gray-100 p-6 mb-4">
          <Database className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Execution Data</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          Execute this node to see detailed response data, execution metrics, and output information.
        </p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100dvh-222px)] overflow-y-auto">
      <div className="p-4 pb-16 space-y-4">
        {/* Execution Summary Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(nodeExecutionResult.status)}
                <CardTitle className="text-base">Execution Summary</CardTitle>
              </div>
              {getNodeStatusBadge(nodeExecutionResult.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Duration</span>
                </div>
                <div className="text-sm font-semibold">
                  {formatDuration(nodeExecutionResult.duration)}
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Package className="w-3 h-3" />
                  <span>Node ID</span>
                </div>
                <div className="text-xs font-mono text-muted-foreground truncate">
                  {nodeExecutionResult.nodeId}
                </div>
              </div>
            </div>

            {nodeExecutionResult.startTime && (
              <>
                <Separator className="my-3" />
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Execution Time</div>
                  <div className="text-sm">
                    {new Date(nodeExecutionResult.startTime).toLocaleString()}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Error Card */}
        {nodeExecutionResult.error && (
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <CardTitle className="text-base text-red-900">Error Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-32">
                <pre className="text-xs text-red-800 whitespace-pre-wrap font-mono">
                  {typeof nodeExecutionResult.error === 'string' 
                    ? nodeExecutionResult.error 
                    : JSON.stringify(nodeExecutionResult.error, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Complete Result */}
        <div className="relative">
          <Button
            size="icon"
            variant="outline"
            onClick={() => handleCopy(nodeExecutionResult)}
            className="absolute top-2 right-2 h-7 w-7 z-10 bg-white/90 backdrop-blur-sm hover:bg-white"
            title="Copy to clipboard"
          >
            <Copy className="w-3 h-3" />
          </Button>
          <ScrollArea className="h-[calc(100dvh-420px)] rounded-md border bg-slate-50">
            <pre className="text-xs p-4 font-mono">
              {JSON.stringify(nodeExecutionResult, null, 2)}
            </pre>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
