import { toast } from 'sonner'
import { useWorkflowStore } from '@/stores/workflow'

/**
 * Check if workflow can be executed (must be saved first)
 * Shows a toast error if workflow has unsaved changes
 * @returns true if workflow can be executed, false otherwise
 */
export function canExecuteWorkflow(): boolean {
  const { isDirty, workflow } = useWorkflowStore.getState()
  
  if (isDirty || workflow?.id === 'new') {
    toast.error("Please save the workflow before executing it.")
    return false
  }
  
  return true
}
