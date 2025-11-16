import { useWorkflowStore } from '@/stores'
import { NodeType, WorkflowConnection, WorkflowNode } from '@/types'
import { isTemplateNodeType } from '@/utils/templateExpansion'
import { useCallback } from 'react'

/**
 * Hook for handling template node expansion
 * Provides utilities to check if a node is a template and expand it
 */
export function useTemplateExpansion() {
  /**
   * Check if a node type is a template
   */
  const isTemplateNode = useCallback((nodeType: NodeType & { isTemplate?: boolean; templateData?: any }): boolean => {
    return isTemplateNodeType(nodeType)
  }, [])

  /**
   * Handle template expansion - either show variable dialog or expand immediately
   */
  const handleTemplateExpansion = useCallback((
    nodeType: NodeType & { isTemplate?: boolean; templateData?: any },
    position: { x: number; y: number },
    onComplete?: () => void
  ) => {
    if (!isTemplateNode(nodeType)) {
      console.warn('⚠️ Attempted to expand non-template node:', nodeType)
      return
    }

    console.log('📦 Template selected:', nodeType)

    const { nodes: templateNodes, connections: templateConnections, variables } = nodeType.templateData

    // Check if template has variables
    if (variables && variables.length > 0) {
      console.log('📦 Template has variables, showing configuration dialog')
      // Open variable configuration dialog
      useWorkflowStore.getState().openTemplateVariableDialog(nodeType, position)
      onComplete?.()
      return
    }

    // No variables, expand immediately
    import('@/utils/templateExpansion').then(({ expandTemplate }) => {
      console.log('📦 Expanding template:', {
        nodesCount: templateNodes?.length || 0,
        connectionsCount: templateConnections?.length || 0,
        position
      })

      if (!templateNodes || templateNodes.length === 0) {
        console.error('❌ Template has no nodes!')
        return
      }

      // Expand template into individual nodes and connections
      const { nodes: expandedNodes, connections: expandedConnections } = expandTemplate(
        templateNodes,
        templateConnections,
        position
      )

      console.log('✅ Template expanded:', {
        expandedNodesCount: expandedNodes.length,
        expandedConnectionsCount: expandedConnections.length
      })

      // Add all expanded nodes
      const { addNodes, addNode, addConnections, addConnection } = useWorkflowStore.getState()

      if (addNodes) {
        addNodes(expandedNodes)
      } else {
        // Fallback: add nodes one by one
        expandedNodes.forEach((node: WorkflowNode) => addNode(node))
      }

      // Add all connections
      if (addConnections) {
        addConnections(expandedConnections)
      } else {
        // Fallback: add connections one by one
        expandedConnections.forEach((conn: WorkflowConnection) => addConnection(conn))
      }

      console.log('✅ Template expansion complete!')
      onComplete?.()
    }).catch(error => {
      console.error('❌ Failed to expand template:', error)
    })
  }, [isTemplateNode])

  return {
    isTemplateNode,
    handleTemplateExpansion
  }
}
