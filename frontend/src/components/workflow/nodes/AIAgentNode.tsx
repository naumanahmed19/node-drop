import { memo, useState } from 'react'
import { NodeProps } from '@xyflow/react'
import { ServiceHandles } from '../components/ServiceHandles'
import { NodeHandles } from '../components/NodeHandles'
import { NodeHeader } from '../components/NodeHeader'
import { NodeToolbarContent } from '../components/NodeToolbarContent'
import { useNodeActions } from '../hooks/useNodeActions'
import { useNodeExecution } from '../hooks/useNodeExecution'
import { getNodeStatusClasses } from '../utils/nodeStyleUtils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { NodeContextMenu } from '../components/NodeContextMenu'
import { useCopyPasteStore } from '@/stores'
import { Bot } from 'lucide-react'

/**
 * AI Agent Node - Special node type with service connections at bottom-right
 * 
 * Features:
 * - Main input/output for workflow data flow (left/right)
 * - Service inputs at bottom-right with labels (Model, Memory, Tools)
 * - Visual distinction for required vs optional service connections
 */
export const AIAgentNode = memo(function AIAgentNode({
  id,
  selected,
  data,
}: NodeProps) {
  const [hoveredOutput, setHoveredOutput] = useState<string | null>(null)
  
  const {
    handleOpenProperties,
    handleExecuteFromContext,
    handleDuplicate,
    handleDelete,
    handleToggleLock,
    handleUngroup,
    handleGroup,
    handleOutputClick,
    handleToggleDisabled
  } = useNodeActions(id)

  const { copy, cut, paste, canCopy, canPaste } = useCopyPasteStore()
  
  const nodeData = data as any
  const { nodeExecutionState, nodeVisualState } = useNodeExecution(id, nodeData.nodeType)
  const effectiveStatus = nodeVisualState.status || nodeData.status || 'idle'

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleOpenProperties()
  }

  const nodeInputs = nodeData.inputs || ['main']
  const nodeOutputs = nodeData.outputs || ['main']
  const serviceInputs = nodeData.serviceInputs || []
  const isTrigger = nodeData.executionCapability === 'trigger'

  // Debug logging
  console.log('[AIAgentNode] Node data:', {
    nodeType: nodeData.nodeType,
    serviceInputs,
    hasServiceInputs: !!serviceInputs && serviceInputs.length > 0,
    allData: nodeData
  })

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="relative">
          <div
            onDoubleClick={handleDoubleClick}
            className={`relative bg-card rounded-lg border shadow-sm transition-all duration-200 hover:shadow-md ${getNodeStatusClasses(effectiveStatus, selected, nodeData.disabled)}`}
            style={{
              width: '240px',
              minHeight: '120px',
              paddingBottom: serviceInputs.length > 0 ? '60px' : '0'
            }}
          >
            {/* Main Workflow Handles (Left/Right) */}
            <NodeHandles
              inputs={nodeInputs}
              outputs={nodeOutputs}
              disabled={nodeData.disabled}
              isTrigger={isTrigger}
              hoveredOutput={hoveredOutput}
              onOutputMouseEnter={setHoveredOutput}
              onOutputMouseLeave={() => setHoveredOutput(null)}
              onOutputClick={handleOutputClick}
              readOnly={false}
              showInputLabels={false}
              showOutputLabels={false}
            />

            {/* Service Handles (Bottom-Right) */}
            <ServiceHandles
              serviceInputs={serviceInputs}
              disabled={nodeData.disabled}
            />

            {/* Node Toolbar */}
            <NodeToolbarContent
              nodeId={id}
              nodeType={nodeData.nodeType}
              nodeLabel={nodeData.label}
              disabled={nodeData.disabled}
              isExecuting={nodeExecutionState.isExecuting}
              hasError={nodeExecutionState.hasError}
              hasSuccess={nodeExecutionState.hasSuccess}
              executionError={nodeExecutionState.executionError}
              workflowExecutionStatus={nodeVisualState.status}
              onExecute={handleExecuteFromContext}
              onRetry={handleExecuteFromContext}
            />

            {/* Node Header */}
            <div className="p-3">
              <NodeHeader
                label={nodeData.label}
                icon={{
                  Icon: Bot,
                  iconColor: "bg-purple-500"
                }}
              />

              {/* Node Content */}
              <div className="mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Bot className="w-3 h-3" />
                  <span>AI Agent Orchestrator</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      <NodeContextMenu
        nodeType={nodeData.nodeType}
        isDisabled={nodeData.disabled}
        isLocked={nodeData.locked}
        onOpenProperties={handleOpenProperties}
        onExecute={handleExecuteFromContext}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onToggleLock={handleToggleLock}
        onToggleDisabled={() => handleToggleDisabled(id, !nodeData.disabled)}
        onUngroup={handleUngroup}
        onGroup={handleGroup}
        onCopy={copy || undefined}
        onCut={cut || undefined}
        onPaste={paste || undefined}
        canCopy={canCopy}
        canPaste={canPaste}
      />
    </ContextMenu>
  )
})
