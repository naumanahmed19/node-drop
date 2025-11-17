import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCopyPasteStore, useReactFlowUIStore, useWorkflowStore, useNodeTypes } from '@/stores'
import { NodeExecutionStatus } from '@/types/execution'
import { useReactFlow } from '@xyflow/react'
import { ChevronDown, LucideIcon } from 'lucide-react'
import React, { ReactNode, useCallback, useMemo } from 'react'
import { NodeContextMenu } from '../components/NodeContextMenu'
import { NodeHandles } from '../components/NodeHandles'
import { NodeHeader } from '../components/NodeHeader'
import { NodeIcon } from '../components/NodeIcon'
import { NodeToolbarContent } from '../components/NodeToolbarContent'
import { useNodeActions } from '../hooks/useNodeActions'
import { useNodeExecution } from '../hooks/useNodeExecution'
import '../node-animations.css'
import { getNodeStatusClasses } from '../utils/nodeStyleUtils'

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
    nodeTypes.find(nt => nt.type === data.nodeType),
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

  // Calculate node width based on compact mode
  const effectiveCollapsedWidth = compactMode ? 'auto' : collapsedWidth
  const effectiveExpandedWidth = compactMode ? '280px' : expandedWidth

  // Compact view (collapsed)
  if (!isExpanded) {
    // Wrap with tooltip when in compact mode
    if (compactMode) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div className="relative">
                    <div
                      onDoubleClick={handleDoubleClick}
                      className={`relative bg-card rounded-lg border shadow-sm transition-all duration-200 hover:shadow-md ${getNodeStatusClasses(effectiveStatus, selected, data.disabled)
                        } ${className}`}
                      style={{
                        width: effectiveCollapsedWidth,
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
                      />



                      {/* Node Toolbar - Always show like CustomNode */}
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

                      {/* Render custom content or NodeContent with icon, or default header */}
                      {customContent ? (
                        customContent
                      ) : nodeConfig ? (
                        <div className="relative h-full flex items-center">
                          <div className={`flex items-center w-full ${compactMode ? 'justify-center gap-0 p-2' : 'gap-2 p-3'}`}>
                            <NodeIcon
                              config={nodeConfig}
                              isExecuting={nodeExecutionState.isExecuting}
                            />
                            {!compactMode && (
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-medium truncate">{data.label}</span>
                              </div>
                            )}
                          </div>
                          {/* Render node enhancements (badges, overlays, etc.) */}
                          {nodeEnhancements}
                        </div>
                      ) : (
                        <>
                          {/* Compact Header */}
                          <NodeHeader
                            label={data.label}
                            headerInfo={headerInfo}
                            icon={Icon ? { Icon, iconColor } : undefined}
                            isExpanded={false}
                            canExpand={canExpand && !!expandedContent}
                            onToggleExpand={handleToggleExpandClick}
                            isExecuting={nodeExecutionState.isExecuting}
                          />

                          {/* Optional collapsed content */}
                          {collapsedContent && (
                            <div>
                              {collapsedContent}
                            </div>
                          )}
                        </>
                      )}

                      {/* Bottom Expand Button - Only in compact mode when collapsed and can expand */}
                      {canExpand && !!expandedContent && (
                        <button
                          onClick={handleToggleExpandClick}
                          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-card border border-border shadow-sm hover:shadow-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          aria-label="Expand node"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* Custom metadata below node (e.g., NodeMetadata component) */}
                    {customMetadata && (
                      <div className="mt-1">
                        {customMetadata}
                      </div>
                    )}
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
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium">{data.label}</p>
            {headerInfo && (
              <p className="text-xs text-muted-foreground">{headerInfo}</p>
            )}
          </TooltipContent>
        </Tooltip>
      )
    }

    // No compact mode - return without tooltip
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="relative">
            <div
              onDoubleClick={handleDoubleClick}

              className={`relative bg-card rounded-lg ${compactMode ? 'border-2' : 'border'} shadow-sm transition-all duration-200 hover:shadow-md ${getNodeStatusClasses(effectiveStatus, selected, data.disabled)
                } ${className}`}
              style={{
                width: effectiveCollapsedWidth,
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
              />



              {/* Node Toolbar - Always show like CustomNode */}
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

              {/* Render custom content or NodeContent with icon, or default header */}
              {customContent ? (
                customContent
              ) : nodeConfig ? (
                <div className="relative h-full flex items-center">
                  <div className={`flex items-center w-full ${compactMode ? 'justify-center gap-0 p-2' : 'gap-2 p-3'}`}>
                    <NodeIcon
                      config={nodeConfig}
                      isExecuting={nodeExecutionState.isExecuting}
                    />
                    {!compactMode && (
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-medium truncate">{data.label}</span>
                      </div>
                    )}
                  </div>
                  {/* Render node enhancements (badges, overlays, etc.) */}
                  {nodeEnhancements}
                </div>
              ) : (
                <>
                  {/* Compact Header */}
                  <NodeHeader
                    label={data.label}
                    headerInfo={headerInfo}
                    icon={Icon ? { Icon, iconColor } : undefined}
                    isExpanded={false}
                    canExpand={canExpand && !!expandedContent}
                    onToggleExpand={handleToggleExpandClick}
                    isExecuting={nodeExecutionState.isExecuting}
                  />

                  {/* Optional collapsed content */}
                  {collapsedContent && (
                    <div>
                      {collapsedContent}
                    </div>
                  )}
                </>
              )}

              {/* Bottom Expand Button - Only in compact mode when collapsed and can expand */}
              {compactMode && canExpand && !!expandedContent && (
                <button
                  onClick={handleToggleExpandClick}
                  className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-card border border-border shadow-sm hover:shadow-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="Expand node"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Custom metadata below node (e.g., NodeMetadata component) */}
            {customMetadata && (
              <div className="mt-1">
                {customMetadata}
              </div>
            )}
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

  // Expanded view
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="relative">
          <div
            onDoubleClick={handleDoubleClick}

            className={`relative bg-card rounded-lg ${compactMode ? 'border-2' : 'border'} shadow-lg transition-all duration-200 hover:shadow-xl ${getNodeStatusClasses(effectiveStatus, selected, data.disabled)
              } ${className}`}
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
            />



            {/* Node Toolbar - Always show like CustomNode */}
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
