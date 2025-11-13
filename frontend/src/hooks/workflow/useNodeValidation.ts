import { useWorkflowStore } from '@/stores'
import { validateWorkflowDetailed } from '@/utils/workflowValidation'
import { useMemo } from 'react'

/**
 * Hook to get validation errors for a specific node
 */
export function useNodeValidation(nodeId: string) {
  const workflow = useWorkflowStore(state => state.workflow)

  const validationErrors = useMemo(() => {
    if (!workflow) return []
    
    const validation = validateWorkflowDetailed(workflow)
    return validation.nodeErrors.get(nodeId) || []
  }, [workflow, nodeId])

  const hasErrors = validationErrors.length > 0

  return {
    hasErrors,
    errors: validationErrors,
  }
}
