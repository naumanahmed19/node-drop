import { useWorkflowStore } from '@/stores'
import type { NodeType } from '@/types'
import { Node, NodeProps } from '@xyflow/react'
import { memo, useMemo } from 'react'
import { NodeMetadata } from './components/NodeMetadata'
import { nodeEnhancementRegistry } from './enhancements'
import { useNodeExecution } from './hooks/useNodeExecution'
import { useNodeValidation } from '@/hooks/workflow'
import { BaseNodeWrapper } from './nodes/BaseNodeWrapper'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle } from 'lucide-react'

interface CustomNodeData extends Record<string, unknown> {
  label: string
  nodeType: string
  parameters: Record<string, any>
  disabled: boolean
  locked?: boolean
  status?: 'idle' | 'running' | 'success' | 'error'
  icon?: string
  color?: string
  // Node definition properties
  inputs?: string[]
  outputs?: string[]
  nodeTypeDefinition?: NodeType  // Add full node type definition
  executionCapability?: 'trigger' | 'action' | 'transform' | 'condition'  // Add capability
  // Position and style properties
  position?: { x: number; y: number }
  dimensions?: { width: number; height: number }
  customStyle?: {
    backgroundColor?: string
    borderColor?: string
    borderWidth?: number
    borderRadius?: number
    shape?: 'rectangle' | 'trigger'
    opacity?: number
  }
  // Additional properties for node toolbar
  nodeGroup?: string[]
  canExecuteIndividually?: boolean
  executionResult?: any
  isExecuting?: boolean
  hasError?: boolean
}

type CustomNodeType = Node<CustomNodeData>

export const CustomNode = memo(function CustomNode({ data, selected, id }: NodeProps<CustomNodeType>) {
  // OPTIMIZATION: Use Zustand selector to prevent unnecessary re-renders
  // Get read-only state from store (only true when viewing past execution)
  const readOnly = useWorkflowStore(state => state.readOnly)

  // Use custom hooks for node visual state
  const { nodeVisualState, nodeExecutionState } = useNodeExecution(id, data.nodeType)

  // Get validation errors for this node
  const { hasErrors, errors } = useNodeValidation(id)

  // Check if this is a trigger node (memoize to prevent recalculation)
  const isTrigger = useMemo(() =>
    data.executionCapability === 'trigger',
    [data.executionCapability]
  )

  // Get icon and color from node type definition using the same utility as NodeTypesList
  // This will handle file: icons, fa: icons, lucide: icons, and emoji automatically
  const nodeIcon = useMemo(() => {
    // If data has icon override, use it; otherwise get from node type definition
    return data.icon || data.nodeTypeDefinition?.icon
  }, [data.icon, data.nodeTypeDefinition?.icon])

  const nodeColor = useMemo(() => {
    // If data has color override, use it; otherwise get from node type definition
    return data.color || data.nodeTypeDefinition?.color || '#666'
  }, [data.color, data.nodeTypeDefinition?.color])

  // For Switch nodes, compute dynamic outputs from parameters
  const computedOutputs = useMemo(() => {
    if (data.nodeType === 'switch' && data.parameters?.outputs) {
      const outputs = data.parameters.outputs as any[]
      if (Array.isArray(outputs) && outputs.length > 0) {
        const computed = outputs.map((output: any, index: number) => {
          // Handle RepeatingField format: { id, values: { rule: { key, expression, value } } }
          const outputConfig = output.values || output
          const rule = outputConfig.rule || {}
          // Use the key field, or fallback to a numbered output
          const key = rule.key?.trim()
          return key || `output${index + 1}`
        })
        // Only return if we have valid outputs
        if (computed.length > 0) {
          return computed
        }
      }
    }
    return data.outputs
  }, [data.nodeType, data.parameters?.outputs, data.outputs])

  // Calculate dynamic height based on number of outputs
  // Each handle needs ~30px of space, with a minimum of 60px for the node
  const dynamicHeight = useMemo(() => {
    const outputCount = computedOutputs?.length || 1
    if (outputCount <= 3) {
      return undefined // Use default height
    }
    // Calculate height: base height (60px) + additional space for extra outputs
    const minHeight = Math.max(60, outputCount * 20)
    return `${minHeight}px`
  }, [computedOutputs?.length])

  // Memoize nodeConfig object to prevent recreation
  const nodeConfig = useMemo(() => ({
    icon: nodeIcon,
    color: nodeColor,
    isTrigger,
    inputs: data.inputs,
    outputs: computedOutputs,
    imageUrl: data.parameters?.imageUrl as string,
    nodeType: data.nodeType,  // Pass nodeType for file: icon resolution
    dynamicHeight,  // Pass dynamic height to node config
  }), [nodeIcon, nodeColor, isTrigger, data.inputs, computedOutputs, data.parameters?.imageUrl, data.nodeType, dynamicHeight])

  // Render node enhancements (badges, overlays, etc.) using the registry
  const nodeEnhancements = useMemo(() => {
    const enhancements = nodeEnhancementRegistry.renderOverlays({
      nodeId: id,
      nodeType: data.nodeType,
      parameters: data.parameters,
      isExecuting: nodeExecutionState.isExecuting,
      executionResult: data.executionResult,
    })

    // Add validation error badge if there are errors
    if (hasErrors) {
      enhancements.push(
        <TooltipProvider key="validation-error" delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 bg-destructive text-destructive-foreground rounded-full shadow-md cursor-help z-10">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-semibold text-xs">Validation Errors:</p>
                {errors.map((error, index) => (
                  <p key={index} className="text-xs">• {error}</p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return enhancements
  }, [id, data.nodeType, data.parameters, nodeExecutionState.isExecuting, data.executionResult, hasErrors, errors])

  // Memoize toolbar config
  const toolbarConfig = useMemo(() => ({
    showToolbar: true,
  }), [])

  // Memoize custom metadata component
  const customMetadata = useMemo(() => (
    <NodeMetadata nodeVisualState={nodeVisualState} />
  ), [nodeVisualState])

  // Show output labels for nodes with multiple outputs (branches)
  const shouldShowOutputLabels = useMemo(() => {
    const outputCount = computedOutputs?.length || 0
    return outputCount > 1
  }, [computedOutputs?.length])

  return (
    <BaseNodeWrapper
      id={id}
      selected={selected}
      data={data}
      isReadOnly={readOnly}
      isExpanded={false}
      onToggleExpand={() => { }}
      canExpand={false}
      nodeConfig={nodeConfig}
      customMetadata={customMetadata}
      toolbar={toolbarConfig}
      nodeEnhancements={nodeEnhancements}
      showOutputLabels={shouldShowOutputLabels}
    />
  )
})
