import { memo, useMemo, useState } from 'react'
import { Copy, Database, Maximize2, MousePointerClick } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NodeConfigTab } from '@/components/workflow/shared/NodeConfigTab'
import { NodeHeader } from '@/components/workflow/shared/NodeHeader'
import { NodeSettingsForm } from '@/components/workflow/shared/NodeSettingsForm'
import { useWorkflowStore } from '@/stores'
import { NodeType, WorkflowNode } from '@/types'
import { extractNodeOutputData } from '@/utils/nodeOutputUtils'
import { toast } from 'sonner'

interface QuickSettingsPanelProps {
  node: WorkflowNode | null
  nodeType: NodeType | null
  readOnly?: boolean
}

export const QuickSettingsPanel = memo(function QuickSettingsPanel({
  node,
  nodeType,
  readOnly = false,
}: QuickSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState('config')
  const [isExecuting, setIsExecuting] = useState(false)
  const { updateNode, getNodeExecutionResult, executeNode, executionState, openNodeProperties } = useWorkflowStore()

  // Get execution result for output tab
  const executionResult = node ? getNodeExecutionResult(node.id) : null

  // Handle execute node
  const handleExecuteNode = async () => {
    if (!node || readOnly || isExecuting || executionState.status === 'running') return
    setIsExecuting(true)
    try {
      await executeNode(node.id, undefined, 'single')
      setActiveTab('output') // Switch to output tab after execution
    } catch (error) {
      console.error('Failed to execute node:', error)
      toast.error('Failed to execute node')
    } finally {
      setIsExecuting(false)
    }
  }

  const nodeSettings = node?.settings || {}

  // Handle settings changes
  const handleSettingsChange = (fieldName: string, value: any) => {
    if (readOnly || !node) return
    updateNode(node.id, { settings: { ...nodeSettings, [fieldName]: value } })
  }

  // Handle config changes from NodeConfigTab
  const handleNodeUpdate = (updates: { parameters?: Record<string, any>; credentials?: string[] }) => {
    if (readOnly || !node) return
    updateNode(node.id, updates)
  }

  // Handle name change
  const handleNameChange = (name: string) => {
    if (readOnly || !node) return
    updateNode(node.id, { name })
  }

  // Handle expand to full dialog
  const handleExpand = () => {
    if (!node) return
    openNodeProperties(node.id)
  }

  // Extract output data from execution result using shared utility
  const outputData = useMemo(() => {
    return extractNodeOutputData(executionResult)
  }, [executionResult])

  const handleCopyOutput = () => {
    if (outputData) {
      navigator.clipboard.writeText(JSON.stringify(outputData, null, 2))
      toast.success('Copied to clipboard')
    }
  }

  // No node selected state
  if (!node || !nodeType) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
        <MousePointerClick className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No node selected</p>
        <p className="text-xs text-center mt-1 opacity-70">Click on a node to configure it</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <NodeHeader
        nodeType={nodeType}
        nodeName={node.name || ''}
        onNameChange={handleNameChange}
        onExecute={handleExecuteNode}
        isExecuting={isExecuting}
        executionDisabled={executionState.status === 'running'}
        executionStatus={executionResult?.status as 'success' | 'error' | 'running' | 'pending' | 'skipped' | null}
        readOnly={readOnly}
        size="sm"
        actions={
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleExpand}
            title="Open full dialog"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="flex-shrink-0 px-3 py-1 border-b">
          <TabsList className="h-7 p-0.5">
            <TabsTrigger value="config" className="text-xs h-6 px-2">
              Config
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs h-6 px-2">
              Settings
            </TabsTrigger>
            <TabsTrigger value="output" className="text-xs h-6 px-2">
              Output
            </TabsTrigger>
          </TabsList>
        </div>

      <TabsContent value="config" className="flex-1 min-h-0 mt-0 relative">
        <div className="absolute inset-0 overflow-auto p-3">
          <NodeConfigTab
            node={node}
            nodeType={nodeType}
            onNodeUpdate={handleNodeUpdate}
            disabled={readOnly}
          />
        </div>
      </TabsContent>

      <TabsContent value="settings" className="flex-1 min-h-0 mt-0 relative">
        <div className="absolute inset-0 overflow-auto p-3">
          <NodeSettingsForm
            nodeType={nodeType}
            values={nodeSettings}
            onChange={handleSettingsChange}
            disabled={readOnly}
          />
        </div>
      </TabsContent>

      <TabsContent value="output" className="flex-1 min-h-0 mt-0 relative">
        <div className="absolute inset-0 overflow-auto p-3">
          {executionResult ? (
            <div className="space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between">
                <Badge 
                  variant="outline"
                  className={
                    executionResult.status === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                    executionResult.status === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                    (executionResult.status as string) === 'running' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    ''
                  }
                >
                  {executionResult.status}
                </Badge>
                {outputData && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyOutput} title="Copy">
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Error */}
              {executionResult.status === 'error' && executionResult.error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
                  <div className="font-medium mb-1">Error</div>
                  <div className="whitespace-pre-wrap break-words">{executionResult.error}</div>
                </div>
              )}

              {/* Output Data */}
              {outputData ? (
                <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(outputData, null, 2)}
                </pre>
              ) : (
                !executionResult.error && (
                  <p className="text-xs text-muted-foreground text-center py-4">No output data</p>
                )
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Database className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-xs text-center">No output yet</p>
              <p className="text-xs text-center opacity-70">Execute the node to see results</p>
            </div>
          )}
        </div>
      </TabsContent>
      </Tabs>
    </div>
  )
})
