import { canNodeExecuteIndividually, shouldShowExecuteButton } from '@/utils/nodeTypeClassification'
import { NodeToolbar, Position, useStore } from '@xyflow/react'
import { memo, useMemo } from 'react'
import { ExecuteToolbarButton } from '../ExecuteToolbarButton'
import { ConfigToolbarButton } from '../ConfigToolbarButton'
import { OutputToolbarButton } from '../OutputToolbarButton'
import type { NodeExecutionError } from '../types'
import { useNodeTypes } from '@/stores'
import { usePinnedOutputsStore } from '@/stores/pinnedOutputs'

interface NodeToolbarContentProps {
  nodeId: string
  nodeType: string
  nodeLabel: string
  disabled: boolean
  isExecuting: boolean
  hasError: boolean
  hasSuccess: boolean
  executionError?: NodeExecutionError
  workflowExecutionStatus: string
  onExecute: (nodeId: string, nodeType: string) => void
  onRetry: (nodeId: string, nodeType: string) => void
}

export const NodeToolbarContent = memo(function NodeToolbarContent({
  nodeId,
  nodeType,
  nodeLabel,
  disabled,
  isExecuting,
  hasError,
  hasSuccess,
  executionError,
  workflowExecutionStatus,
  onExecute,
  onRetry
}: NodeToolbarContentProps) {
  const { nodeTypes } = useNodeTypes()
  
  // Get node type definition for config button
  const nodeTypeDefinition = useMemo(
    () => nodeTypes.find((nt) => nt.identifier === nodeType),
    [nodeTypes, nodeType]
  )

  // Check if this node is selected using ReactFlow's store
  const isNodeSelected = useStore((state) => {
    const node = state.nodes.find(n => n.id === nodeId)
    return node?.selected || false
  })

  // Check if this node has a pinned output
  const { isPinned } = usePinnedOutputsStore()
  const hasPinnedOutput = isPinned(nodeId)

  return (
    <NodeToolbar
      isVisible={true}
      position={Position.Top}
      offset={10}
      align="center"
    >
      <div 
        className="flex items-center gap-0.5 node-toolbar-container" 
        role="toolbar" 
        aria-label={`Controls for ${nodeLabel}`}
        aria-orientation="horizontal"
      >
        {/* Execute button */}
        {shouldShowExecuteButton(nodeType) && (
          <ExecuteToolbarButton
            nodeId={nodeId}
            nodeType={nodeType}
            isExecuting={isExecuting}
            canExecute={
              canNodeExecuteIndividually(nodeType) && 
              !disabled && 
              workflowExecutionStatus !== 'running'
            }
            hasError={hasError}
            hasSuccess={hasSuccess}
            executionError={executionError}
            onExecute={() => onExecute(nodeId, nodeType)}
            onRetry={() => onRetry(nodeId, nodeType)}
          />
        )}
        
        {/* Config button - visible when selected */}
        {nodeTypeDefinition && isNodeSelected && (
          <ConfigToolbarButton
            nodeId={nodeId}
            nodeType={nodeTypeDefinition}
            disabled={disabled}
          />
        )}

        {/* Output button - visible when selected or pinned */}
        {(isNodeSelected || hasPinnedOutput) && (
          <OutputToolbarButton
            nodeId={nodeId}
            disabled={disabled}
          />
        )}
      </div>
    </NodeToolbar>
  )
})

NodeToolbarContent.displayName = 'NodeToolbarContent'
