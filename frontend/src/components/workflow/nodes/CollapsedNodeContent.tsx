import React, { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { NodeHandles } from '../components/NodeHandles'
import { NodeToolbarContent } from '../components/NodeToolbarContent'
import { NodeIcon } from '../components/NodeIcon'
import { NodeHeader } from '../components/NodeHeader'
import { NodeLabel } from './NodeLabel'
import { getNodeStatusClasses } from '../utils/nodeStyleUtils'

interface CollapsedNodeContentProps {
  // Node identification
  id: string
  
  // Node data
  data: {
    label: string
    nodeType: string
    disabled: boolean
    status?: 'idle' | 'running' | 'success' | 'error' | 'skipped'
  }
  
  // Visual state
  selected: boolean
  effectiveStatus?: string
  effectiveCollapsedWidth: string
  minHeight: string
  containerClasses: string
  className?: string
  
  // Node configuration
  nodeConfig?: any
  small?: boolean
  compactMode?: boolean
  isServiceNode?: boolean
  iconSize: 'sm' | 'md'
  labelClass: string
  
  // Handles
  nodeInputs: string[]
  nodeOutputs: string[]
  nodeInputNames?: string[]
  nodeOutputNames?: string[]
  isTrigger: boolean
  showInputLabels: boolean
  showOutputLabels: boolean
  hoveredOutput: string | null
  onOutputMouseEnter: (output: string) => void
  onOutputMouseLeave: () => void
  
  // Actions
  handleOutputClick: (event: React.MouseEvent<HTMLDivElement>, outputHandle: string) => void
  handleServiceInputClick: (event: React.MouseEvent<HTMLDivElement>, input: string) => void
  handleDoubleClick: (e: React.MouseEvent) => void
  handleToggleExpandClick: () => void
  handleExecuteNode: (nodeId: string, nodeType: string) => void
  handleRetryNode: (nodeId: string, nodeType: string) => void
  handleToggleDisabled: (nodeId: string, disabled: boolean) => void
  
  // Execution state
  nodeExecutionState: {
    isExecuting: boolean
    hasError: boolean
    hasSuccess: boolean
    executionError?: any
  }
  executionStatus: string
  
  // Content
  customContent?: ReactNode
  collapsedContent?: ReactNode
  Icon?: any
  iconColor?: string
  headerInfo?: string
  nodeEnhancements?: ReactNode[]
  
  // Flags
  isReadOnly?: boolean
  canExpand: boolean
  expandedContent?: ReactNode
}

/**
 * CollapsedNodeContent - Renders the collapsed view of a node
 * Extracted to reduce duplication between tooltip and non-tooltip versions
 */
export function CollapsedNodeContent({
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
  onOutputMouseEnter,
  onOutputMouseLeave,
  handleOutputClick,
  handleServiceInputClick,
  handleDoubleClick,
  handleToggleExpandClick,
  handleExecuteNode,
  handleRetryNode,
  handleToggleDisabled,
  nodeExecutionState,
  executionStatus,
  customContent,
  collapsedContent,
  Icon,
  iconColor,
  headerInfo,
  nodeEnhancements,
  isReadOnly,
  canExpand,
  expandedContent
}: CollapsedNodeContentProps) {
  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`relative bg-card rounded-lg border shadow-sm transition-all duration-200 hover:shadow-md ${getNodeStatusClasses(
        effectiveStatus,
        selected,
        data.disabled
      )} ${className}`}
      style={{
        width: effectiveCollapsedWidth,
        minHeight
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
        onOutputMouseEnter={onOutputMouseEnter}
        onOutputMouseLeave={onOutputMouseLeave}
        onOutputClick={handleOutputClick}
        onServiceInputClick={handleServiceInputClick}
        readOnly={isReadOnly}
        showInputLabels={showInputLabels}
        showOutputLabels={showOutputLabels}
        compactMode={compactMode}
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
        workflowExecutionStatus={executionStatus}
        onExecute={handleExecuteNode}
        onRetry={handleRetryNode}
      />

      {/* Render custom content or NodeContent with icon, or default header */}
      {customContent ? (
        customContent
      ) : nodeConfig ? (
        <div className="relative h-full flex items-center">
          <div className={`flex items-center w-full ${containerClasses}`}>
            <NodeIcon
              config={nodeConfig}
              isExecuting={nodeExecutionState.isExecuting}
              size={iconSize}
            />
            <NodeLabel
              label={data.label}
              small={small}
              compactMode={compactMode}
              labelClass={labelClass}
            />
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
            hideLabel={compactMode && isServiceNode}
          />

          {/* Optional collapsed content */}
          {collapsedContent && <div>{collapsedContent}</div>}
        </>
      )}

      {/* Bottom Expand Button */}
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
  )
}

CollapsedNodeContent.displayName = 'CollapsedNodeContent'
