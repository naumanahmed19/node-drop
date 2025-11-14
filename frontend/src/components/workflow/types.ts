/**
 * Types for toolbar button components
 */

import type { NodeExecutionError } from '@/types/execution';

// Re-export for convenience
export type { NodeExecutionError };

export interface ToolbarButtonBaseProps {
  nodeId: string
  className?: string
}

export interface ExecuteToolbarButtonProps extends ToolbarButtonBaseProps {
  nodeType: string
  isExecuting: boolean
  canExecute: boolean
  hasError?: boolean
  hasSuccess?: boolean
  executionError?: NodeExecutionError
  onExecute: (nodeId: string) => void
  onRetry?: (nodeId: string) => void
}

export interface DisableToggleToolbarButtonProps extends ToolbarButtonBaseProps {
  nodeLabel: string
  disabled: boolean
  onToggle: (nodeId: string, disabled: boolean) => void
}

export type NodeExecutionCapability = 'trigger' | 'action' | 'transform' | 'condition'

export interface NodeTypeMetadata {
  type: string
  group: string[]
  executionCapability: NodeExecutionCapability
  canExecuteIndividually: boolean
  canBeDisabled: boolean
}
