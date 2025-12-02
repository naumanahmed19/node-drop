import { useNodeTypes, useWorkflowStore } from '@/stores'
import { validateWorkflowDetailed, ValidationResult } from '@/utils/workflowValidation'
import { useMemo } from 'react'
import { NodeType, Workflow } from '@/types'

// Module-level cache for validation results
let cachedValidation: ValidationResult | null = null
let cachedWorkflowRef: Workflow | null = null
let cachedNodeTypesLength: number = 0

// Empty array constant to avoid creating new arrays
const EMPTY_ERRORS: string[] = []

/**
 * Get cached validation result or compute new one
 * Uses workflow object reference for cache invalidation
 * (Zustand creates new object on every state change)
 */
function getCachedValidation(
  workflow: Workflow | null,
  nodeTypes: NodeType[]
): ValidationResult {
  if (!workflow) {
    return {
      isValid: true,
      nodeErrors: new Map(),
      connectionErrors: new Map(),
    }
  }

  // Fast cache check - workflow reference changes on every modification in Zustand
  const isCacheValid = 
    cachedValidation &&
    cachedWorkflowRef === workflow &&
    cachedNodeTypesLength === nodeTypes.length

  if (isCacheValid) {
    return cachedValidation!
  }

  // Compute new validation and cache it
  cachedValidation = validateWorkflowDetailed(workflow, nodeTypes)
  cachedWorkflowRef = workflow
  cachedNodeTypesLength = nodeTypes.length

  return cachedValidation
}

/**
 * Hook to get validation errors for a specific node
 * 
 * OPTIMIZATION: 
 * - Uses module-level caching with workflow reference for invalidation
 * - Zustand creates new workflow object on every change, so reference check works
 * - Validation computed once per workflow change, shared across all nodes
 * 
 * Validates:
 * - Missing node type/name
 * - Missing required parameters
 * - Missing required credentials
 * - Connection issues
 */
export function useNodeValidation(nodeId: string) {
  const workflow = useWorkflowStore(state => state.workflow)
  const { nodeTypes } = useNodeTypes()

  // Memoize validation lookup
  // workflow reference changes on every Zustand update
  const validationErrors = useMemo(() => {
    if (!workflow) return EMPTY_ERRORS
    
    const validation = getCachedValidation(workflow, nodeTypes)
    return validation.nodeErrors.get(nodeId) || EMPTY_ERRORS
  }, [workflow, nodeTypes, nodeId])

  return {
    hasErrors: validationErrors.length > 0,
    errors: validationErrors,
  }
}

/**
 * Invalidate the validation cache
 */
export function invalidateValidationCache() {
  cachedValidation = null
  cachedWorkflowRef = null
  cachedNodeTypesLength = 0
}
