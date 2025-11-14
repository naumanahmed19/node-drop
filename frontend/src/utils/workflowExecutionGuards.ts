import { toast } from 'sonner'
import { useWorkflowStore } from '@/stores/workflow'

/**
 * Check if workflow can be executed
 * Only requires saving for NEW workflows (id === 'new')
 * Existing workflows can execute even with unsaved changes
 * @returns true if workflow can be executed, false otherwise
 */
export function canExecuteWorkflow(): boolean {
  const { workflow } = useWorkflowStore.getState()
  
  // Only block execution if workflow is new (not yet saved)
  if (workflow?.id === 'new') {
    toast.error("Please save the workflow before executing it.")
    return false
  }
  
  return true
}

/**
 * Check if workflow execution is currently running
 * @returns true if workflow is running, false otherwise
 */
export function isWorkflowRunning(): boolean {
  const { executionState } = useWorkflowStore.getState()
  return executionState?.status === 'running'
}

/**
 * Perform all pre-execution checks
 * @returns true if execution can proceed, false otherwise
 */
export function canProceedWithExecution(): boolean {
  if (isWorkflowRunning()) {
    console.warn("Cannot execute while workflow is running")
    return false
  }
  
  return canExecuteWorkflow()
}
