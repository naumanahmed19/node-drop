import { useCredentialStore, useNodeConfigDialogStore } from '@/stores'
import { NodeType, WorkflowNode } from '@/types'
import { ValidationError } from '@/utils/nodeValidation'
import { NodeConfigTab } from '@/components/workflow/shared/NodeConfigTab'
import { useCallback } from 'react'

interface ConfigTabProps {
  node: WorkflowNode
  nodeType: NodeType
  readOnly?: boolean
}

export function ConfigTab({ node, nodeType, readOnly = false }: ConfigTabProps) {
  const {
    parameters,
    credentials,
    setValidationErrors,
    updateParameters,
    updateCredentials,
  } = useNodeConfigDialogStore()

  // Handle validation changes from NodeConfigTab
  const handleValidationChange = useCallback((errors: ValidationError[]) => {
    setValidationErrors(errors)
  }, [setValidationErrors])

  // Handle node updates from NodeConfigTab - sync with dialog store
  const handleNodeUpdate = useCallback((updates: { parameters?: Record<string, any>; credentials?: string[] }) => {
    if (updates.parameters) {
      // Update each parameter individually to work with dialog store
      Object.entries(updates.parameters).forEach(([key, value]) => {
        updateParameters(key, value)
      })
    }
    
    if (updates.credentials) {
      // Clear existing credentials and set new ones
      // Find which credentials were added/removed by comparing with current
      const currentCredIds = Object.values(credentials).filter(Boolean) as string[]
      const newCredIds = updates.credentials
      
      // For each new credential, find its type and update
      newCredIds.forEach(credId => {
        if (!currentCredIds.includes(credId)) {
          const cred = useCredentialStore.getState().credentials.find(c => c.id === credId)
          if (cred) {
            updateCredentials(cred.type, credId)
          }
        }
      })
      
      // Remove credentials that are no longer present
      currentCredIds.forEach(credId => {
        if (!newCredIds.includes(credId)) {
          const cred = useCredentialStore.getState().credentials.find(c => c.id === credId)
          if (cred) {
            updateCredentials(cred.type, undefined)
          }
        }
      })
    }
  }, [credentials, updateParameters, updateCredentials])

  // Create a node object with dialog store state for the shared component
  const nodeWithDialogState: WorkflowNode = {
    ...node,
    parameters,
    credentials: Object.values(credentials).filter(Boolean) as string[],
  }

  return (
    <div className="h-[calc(100dvh-222px)] overflow-y-auto p-4 pb-8 bg-muted/30">
      <div className="space-y-6 max-w-lg mb-8">
        <NodeConfigTab
          node={nodeWithDialogState}
          nodeType={nodeType}
          onNodeUpdate={handleNodeUpdate}
          disabled={readOnly}
          onValidationChange={handleValidationChange}
        />
      </div>
    </div>
  )
}
