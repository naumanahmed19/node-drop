import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCopyPasteStore, useReactFlowUIStore, useWorkflowStore, useNodeTypes } from '@/stores'
import { NodeExecutionStatus } from '@/types/execution'
import { useReactFlow } from '@xyflow/react'
import { LucideIcon } from 'lucide-react'
import React, { ReactNode, useCallback, useMemo } from 'react'
import { NodeContextMenu } from '../components/NodeContextMenu'
import { NodeHandles } from '../components/NodeHandles'
import { NodeHeader } from '../components/NodeHeader'
import { NodeToolbarContent } from '../components/NodeToolbarContent'
import { useNodeActions } from '../hooks/useNodeActions'
import { useNodeExecution } from '../hooks/useNodeExecution'
import '../node-animations.css'
import { getNodeStatusClasses } from '../utils/nodeStyleUtils'
import { useNodeSize } from './useNodeSize'
import { CollapsedNodeContent } from './CollapsedNodeContent'

export interface BaseNodeWrapperProps {
  /** Node ID */
  id: string

  /** Whether the node is selected */
  selected: boolean

  /** Node data */
  data: {
    label: string
    nodeType: string
    parameters: Record<string, any>
    disabled: boolean
    locked?: boolean
    status?: 'idle' | 'running' | 'success' | 'error' | 'skipped'
    executionResult?: any
    lastExecutionData?: any
    inputs?: string[]
    outputs?: string[]
    inputNames?: string[]
    outputNames?: string[]
    executionCapability?: 'trigger' | 'action' | 'transform' | 'condition'
  }

  /** Whether the node is read-only */
  isReadOnly?: boolean

  /** Whether the node is expanded */
  isExpanded: boolean

  /** Handler for expand/collapse toggle */
  onToggleExpand: () => void

  /** Icon component to display in header (optional if nodeConfig is provided) */
  Icon?: LucideIcon

  /** Background color for the icon */
  iconColor?: string

  /** Width of the node when collapsed */
  collapsedWidth?: string

  /** Width of the node when expanded */
  expandedWidth?: string

  /** Content to display when collapsed */
  collapsedContent?: ReactNode

  /** Content to display when expanded */
  expandedContent?: ReactNode

  /** Additional info to show in header (e.g., "3 messages") */
  headerInfo?: string

  /** Custom content to render in the collapsed view (e.g., for CustomNode with icon and toolbar) */
  customContent?: ReactNode

  /** If no customContent, use default node rendering with these props */
  nodeConfig?: {
    icon?: string
    color?: string
    isTrigger?: boolean
    inputs?: string[]
    outputs?: string[]
    inputNames?: string[]
    outputNames?: string[]
    inputsConfig?: Record<string, {
      position?: 'left' | 'right' | 'top' | 'bottom';
      displayName?: string;
      required?: boolean;
    }>
    imageUrl?: string
    nodeType?: string  // Added to support file: icons
    dynamicHeight?: string  // Added to support dynamic height based on outputs
    compactMode?: boolean  // Added to support compact mode (hide labels, show in tooltip)
    isServiceNode?: boolean  // Added to identify service nodes (tool, memory, model)
  }

  /** Custom metadata to render below node (like NodeMetadata component) */
  customMetadata?: ReactNode

  /** Whether to show label below the node (like CustomNode) */
  showLabelBelow?: boolean

  /** Whether to enable expand/collapse functionality */
  canExpand?: boolean

  /** Custom class name for the wrapper */
  className?: string

  /** Whether to show input handle */
  showInputHandle?: boolean

  /** Whether to show output handle */
  showOutputHandle?: boolean

  /** Custom input handle color */
  inputHandleColor?: string

  /** Custom output handle color */
  outputHandleColor?: string

  /** Custom on double click handler - if not provided, will open properties dialog */
  onDoubleClick?: (e: React.MouseEvent) => void

  /** Toolbar options */
  toolbar?: {
    showToolbar?: boolean
    isExecuting?: boolean
    hasError?: boolean
    hasSuccess?: boolean
    executionError?: any
    workflowExecutionStatus?: string
    onExecute?: (nodeId: string, nodeType: string) => void
    onRetry?: (nodeId: string, nodeType: string) => void
    onToggleDisabled?: (nodeId: string, disabled: boolean) => void
  }

  /** Node enhancements (badges, overlays, etc.) from enhancement registry */
  nodeEnhancements?: ReactNode[]

  /** Whether to show labels on output handles */
  showOutputLabels?: boolean

  /** Small variant for service nodes (reduced size, icon, padding) */
  small?: boolean
}

/**
 * BaseNodeWrapper - A generic wrapper component for creating expandable/collapsible 
 * interactive nodes in the workflow canvas.
 * 
 * Features:
 * - Expand/collapse functionality
 * - Context menu integration
 * - Input/output handles
 * - Customizable icon, colors, and content
 * - Consistent styling and behavior
 * 
 * @example
 * ```tsx
 * <BaseNodeWrapper
 *   id={id}
 *   selected={selected}
 *   data={data}
 *   isExpanded={isExpanded}
 *   onToggleExpand={handleToggleExpand}
 *   Icon={MessageCircle}
 *   iconColor="bg-blue-500"
 *   collapsedWidth="180px"
 *   expandedWidth="320px"
 *   headerInfo="5 messages"
 *   expandedContent={<YourCustomContent />}
 * />
 * ```
 */
export function BaseNodeWrapper({
  id,
  selected,
  data,
  isReadOnly = false,
  isExpanded,
  onToggleExpand,
  Icon,
  iconColor = 'bg-blue-500',
  collapsedWidth = '180px',
  expandedWidth = '320px',
  collapsedContent,
  expandedContent,
  headerInfo,
  className = '',
  showInputHandle = true,
  showOutputHandle = true,
  onDoubleClick: customOnDoubleClick,
  customContent,
  customMetadata,
  canExpand = true,
  nodeConfig,
  nodeEnhancements,
  showOutputLabels = false,
  small = false,
}: BaseNodeWrapperProps) {
  // Use node actions hook for context menu functionality
  const {
    handleOpenProperties,
    handleExecuteFromContext,
    handleDuplicate,
    handleDelete,
    handleToggleLock,
    handleToggleCompact,
    handleUngroup,
    handleGroup,
    handleOutputClick,
    handleServiceInputClick,
    handleToggleDisabled
  } = useNodeActions(id)

  // Get copy/paste functions from store
  const { copy, cut, paste, canCopy, canPaste } = useCopyPasteStore()

  // Get node type definition for context menu
  const { nodeTypes } = useNodeTypes()
  const nodeTypeDefinition = useMemo(() => 
    nodeTypes.find(nt => nt.identifier === data.nodeType),
    [nodeTypes, data.nodeType]
  )

  // Import useReactFlow to check if node is in a group
  const { getNode, getNodes } = useReactFlow()
  const currentNode = getNode(id)
  const isInGroup = !!currentNode?.parentId

  // Check if we can group (need at least 1 selected node that isn't a group or in a group)
  const selectedNodesForGrouping = getNodes().filter(
    (node) =>
      node.selected &&
      !node.parentId &&
      node.type !== 'group'
  )
  const canGroup = selectedNodesForGrouping.length >= 1

  // Check if we can create template (need at least 1 selected node)
  const selectedNodesForTemplate = getNodes().filter(node => node.selected && node.type !== 'group')
  const canCreateTemplate = selectedNodesForTemplate.length >= 1

  // Get template dialog action from store
  const openTemplateDialog = useWorkflowStore(state => state.openTemplateDialog)
  
  // Handle create template
  const handleCreateTemplate = useCallback(() => {
    openTemplateDialog()
  }, [openTemplateDialog])

  // Use execution hook for toolbar functionality and visual state
  const {
    nodeExecutionState,
    nodeVisualState,
    handleExecuteNode,
    handleRetryNode
  } = useNodeExecution(id, data.nodeType)

  // Debug logging for service nodes
  React.useEffect(() => {
    if (data.nodeType === 'openai-model' || data.nodeType === 'anthropic-model' || data.nodeType === 'redis-memory') {
      console.log(`[BaseNodeWrapper] ${data.nodeType} (${id}) execution state changed:`, {
        isExecuting: nodeExecutionState.isExecuting,
        hasError: nodeExecutionState.hasError,
        hasSuccess: nodeExecutionState.hasSuccess,
      });
    }
  }, [nodeExecutionState.isExecuting, nodeExecutionState.hasError, nodeExecutionState.hasSuccess, data.nodeType, id]);

  // Get execution state and workflow from store
  const { executionState, workflow } = useWorkflowStore()

  // Get compact mode from UI store (global) and node settings (per-node)
  const { compactMode: globalCompactMode } = useReactFlowUIStore()
  const workflowNode = workflow?.nodes.find(n => n.id === id)
  const nodeCompactMode = workflowNode?.settings?.compact || false
  
  // Use node-specific compact mode if set, otherwise use global
  const compactMode = nodeCompactMode || globalCompactMode

  // Determine effective node status from visual state or data.status
  // Priority: nodeVisualState > data.status for consistent styling across execution modes
  const effectiveStatus = nodeVisualState?.status
    ? (nodeVisualState.status === NodeExecutionStatus.RUNNING ? 'running' :
      nodeVisualState.status === NodeExecutionStatus.COMPLETED ? 'success' :
        nodeVisualState.status === NodeExecutionStatus.FAILED ? 'error' :
          nodeVisualState.status === NodeExecutionStatus.SKIPPED ? 'skipped' :
            nodeVisualState.status === NodeExecutionStatus.QUEUED ? 'running' :
              data.status)
    : data.status

  // Handle double-click to open properties dialog
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (customOnDoubleClick) {
      customOnDoubleClick(e)
    } else {
      handleOpenProperties()
    }
  }, [customOnDoubleClick, handleOpenProperties])

  // Handle expand/collapse toggle
  const handleToggleExpandClick = useCallback(() => {
    onToggleExpand()
  }, [onToggleExpand])

  // Local state for tracking which output connector is hovered (for default rendering)
  const [hoveredOutput, setHoveredOutput] = React.useState<string | null>(null)

  // Get inputs/outputs from data or use defaults
  // If nodeConfig has outputs, use those (for dynamic outputs like Switch node)
  const nodeInputs = nodeConfig?.inputs || data.inputs || (showInputHandle ? ['main'] : [])
  const nodeOutputs = nodeConfig?.outputs || data.outputs || (showOutputHandle ? ['main'] : [])
  const nodeInputNames = nodeConfig?.inputNames || data.inputNames
  const nodeOutputNames = nodeConfig?.outputNames || data.outputNames
  const isTrigger = data.executionCapability === 'trigger'
  
  // Show input labels if inputNames are provided
  const showInputLabels = !!nodeInputNames && nodeInputNames.length > 0

  // Check if this is a service node for compact styling
  const isServiceNode = nodeConfig && 'isServiceNode' in nodeConfig && nodeConfig.isServiceNode

  // Use node size hook for centralized size configuration
  const { minHeight, iconSize, labelClass, containerClasses } = useNodeSize({
    small,
    dynamicHeight: nodeConfig?.dynamicHeight,
    compactMode,
    isServiceNode
  })

  // Calculate node width based on compact mode
  const effectiveCollapsedWidth = compactMode ? 'auto' : collapsedWidth
  const effectiveExpandedWidth = compactMode ? '280px' : expandedWidth

  // Shared props for CollapsedNodeContent
  const collapsedNodeProps = {
    id,
    data,
    selected,
    effectiveStatus,
    effectiveCollapsedWidth,
    minHeight,
    containerClasses,
    className,
    nodeConfig,
    small,
    compactMode,
    isServiceNode,
    iconSize,
    labelClass,
    nodeInputs,
    nodeOutputs,
    nodeInputNames,
    nodeOutputNames,
    isTrigger,
    showInputLabels,
    showOutputLabels,
    hoveredOutput,
    onOutputMouseEnter: setHoveredOutput,
    onOutputMouseLeave: () => setHoveredOutput(null),
    handleOutputClick: handleOutputClick,
    handleServiceInputClick: handleServiceInputClick,
    handleDoubleClick,
    handleToggleExpandClick,
    handleExecuteNode,
    handleRetryNode,
    handleToggleDisabled,
    nodeExecutionState,
    executionStatus: executionState.status,
    customContent,
    collapsedContent,
    Icon,
    iconColor,
    headerInfo,
    nodeEnhancements,
    isReadOnly,
    canExpand,
    expandedContent
  }

  // Compact view (collapsed)
  if (!isExpanded) {
    const contextMenu = (
      <NodeContextMenu
        onOpenProperties={handleOpenProperties}
        onExecute={handleExecuteFromContext}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onToggleLock={handleToggleLock}
        onToggleCompact={handleToggleCompact}
        onCopy={copy || undefined}
        onCut={cut || undefined}
        onPaste={paste || undefined}
        onUngroup={isInGroup ? handleUngroup : undefined}
        onGroup={canGroup ? handleGroup : undefined}
        onCreateTemplate={canCreateTemplate ? handleCreateTemplate : undefined}
        isLocked={!!data.locked}
        isCompact={nodeCompactMode}
        readOnly={isReadOnly}
        canCopy={canCopy}
        canPaste={canPaste}
        isInGroup={isInGroup}
        canGroup={canGroup}
        canCreateTemplate={canCreateTemplate}
        nodeType={nodeTypeDefinition}
      />
    )

    // Wrap with tooltip when in compact mode
    if (compactMode) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div className="relative">
                    <CollapsedNodeContent {...collapsedNodeProps} />
                    {customMetadata && <div className="mt-1">{customMetadata}</div>}
                  </div>
                </ContextMenuTrigger>
                {contextMenu}
              </ContextMenu>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className={`max-w-xs ${small ? 'text-xs' : ''}`}>
            <p className={small ? 'font-medium text-xs' : 'font-medium'}>{data.label}</p>
            {headerInfo && <p className="text-xs text-muted-foreground">{headerInfo}</p>}
          </TooltipContent>
        </Tooltip>
      )
    }

    // No compact mode - return without tooltip
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="relative">
            <CollapsedNodeContent {...collapsedNodeProps} />
            {customMetadata && <div className="mt-1">{customMetadata}</div>}
          </div>
        </ContextMenuTrigger>
        {contextMenu}
      </ContextMenu>
    )
  }

  // Expanded view
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="relative">
          <div
            onDoubleClick={handleDoubleClick}
            className={`relative bg-card rounded-lg ${compactMode ? 'border-2' : 'border'} shadow-lg transition-all duration-200 hover:shadow-xl ${getNodeStatusClasses(
              effectiveStatus,
              selected,
              data.disabled
            )} ${className}`}
            style={{
              width: effectiveExpandedWidth,
              minHeight: nodeConfig?.dynamicHeight
            }}
          >
            {/* Dynamic Handles */}
            <NodeHandles
              inputs={nodeInputs}
              outputs={nodeOutputs}
              inputNames={nodeInputNames}
              outputNames={nodeOutputNames}
              inputsConfig={nodeConfig?.inputsConfig}
              disabled={data.disabled}
              isTrigger={isTrigger}
              hoveredOutput={hoveredOutput}
              onOutputMouseEnter={setHoveredOutput}
              onOutputMouseLeave={() => setHoveredOutput(null)}
              onOutputClick={handleOutputClick}
              onServiceInputClick={handleServiceInputClick}
              readOnly={isReadOnly}
              showInputLabels={showInputLabels}
              showOutputLabels={showOutputLabels}
              compactMode={nodeConfig?.compactMode}
            />

            {/* Node Toolbar */}
            <NodeToolbarContent
              nodeId={id}
              nodeType={data.nodeType}
              nodeLabel={data.label}
              disabled={data.disabled}
              isExecuting={nodeExecutionState.isExecuting}
              hasError={nodeExecutionState.hasError}
              hasSuccess={nodeExecutionState.hasSuccess}
              executionError={nodeExecutionState.executionError}
              workflowExecutionStatus={executionState.status}
              onExecute={handleExecuteNode}
              onRetry={handleRetryNode}
              onToggleDisabled={handleToggleDisabled}
            />

            {/* Expanded Header */}
            <NodeHeader
              label={data.label}
              headerInfo={headerInfo}
              icon={Icon ? { Icon, iconColor } : undefined}
              isExpanded={true}
              canExpand={canExpand}
              onToggleExpand={handleToggleExpandClick}
              showBorder={true}
              isExecuting={nodeExecutionState.isExecuting}
            />

            {/* Expanded Content */}
            {expandedContent}
          </div>
        </div>
      </ContextMenuTrigger>

      <NodeContextMenu
        onOpenProperties={handleOpenProperties}
        onExecute={handleExecuteFromContext}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onToggleLock={handleToggleLock}
        onToggleCompact={handleToggleCompact}
        onCopy={copy || undefined}
        onCut={cut || undefined}
        onPaste={paste || undefined}
        onUngroup={isInGroup ? handleUngroup : undefined}
        onGroup={canGroup ? handleGroup : undefined}
        onCreateTemplate={canCreateTemplate ? handleCreateTemplate : undefined}
        isLocked={!!data.locked}
        isCompact={nodeCompactMode}
        readOnly={isReadOnly}
        canCopy={canCopy}
        canPaste={canPaste}
        isInGroup={isInGroup}
        canGroup={canGroup}
        canCreateTemplate={canCreateTemplate}
        nodeType={nodeTypeDefinition}
      />
    </ContextMenu>
  )
}

BaseNodeWrapper.displayName = 'BaseNodeWrapper'
