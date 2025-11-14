import { Workflow } from '@/types'

export interface NodeValidationError {
  nodeId: string
  errors: string[]
}

export interface ValidationResult {
  isValid: boolean
  nodeErrors: Map<string, string[]>
  connectionErrors: Map<string, string[]>
}

/**
 * Validates a workflow and returns detailed error information
 */
export function validateWorkflowDetailed(workflow: Workflow | null): ValidationResult {
  const nodeErrors = new Map<string, string[]>()
  const connectionErrors = new Map<string, string[]>()

  if (!workflow) {
    return {
      isValid: true,
      nodeErrors,
      connectionErrors,
    }
  }

  // Create a map of nodes for quick lookup
  const nodeMap = new Map(workflow.nodes.map(node => [node.id, node]))

  // Validate connections
  workflow.connections.forEach((connection, index) => {
    const errors: string[] = []
    const sourceNode = nodeMap.get(connection.sourceNodeId)
    const targetNode = nodeMap.get(connection.targetNodeId)

    // Check if source node exists
    if (!sourceNode) {
      errors.push(`Source node "${connection.sourceNodeId}" not found`)
    }

    // Check if target node exists
    if (!targetNode) {
      errors.push(`Target node "${connection.targetNodeId}" not found`)
    }

    // Check if sourceOutput is defined
    if (!connection.sourceOutput) {
      errors.push(`Missing sourceOutput handle`)
      
      // Add error to source node
      if (sourceNode) {
        const nodeErrorList = nodeErrors.get(connection.sourceNodeId) || []
        nodeErrorList.push(`Connection #${index + 1}: Missing output handle`)
        nodeErrors.set(connection.sourceNodeId, nodeErrorList)
      }
    }

    // Check if targetInput is defined
    if (!connection.targetInput) {
      errors.push(`Missing targetInput handle`)
      
      // Add error to target node
      if (targetNode) {
        const nodeErrorList = nodeErrors.get(connection.targetNodeId) || []
        nodeErrorList.push(`Connection #${index + 1}: Missing input handle`)
        nodeErrors.set(connection.targetNodeId, nodeErrorList)
      }
    }

    if (errors.length > 0) {
      connectionErrors.set(connection.id, errors)
    }
  })

  // Validate nodes
  workflow.nodes.forEach(node => {
    const errors: string[] = []

    // Check if node has a type
    if (!node.type) {
      errors.push('Missing node type')
    }

    // Check if node has a name
    if (!node.name || node.name.trim() === '') {
      errors.push('Missing node name')
    }

    // Check for orphaned connections (connections referencing this node that have errors)
    const incomingConnections = workflow.connections.filter(
      conn => conn.targetNodeId === node.id
    )
    const outgoingConnections = workflow.connections.filter(
      conn => conn.sourceNodeId === node.id
    )

    incomingConnections.forEach(conn => {
      if (connectionErrors.has(conn.id)) {
        const connErrors = connectionErrors.get(conn.id)!
        connErrors.forEach(err => {
          if (!errors.includes(err)) {
            errors.push(`Incoming connection: ${err}`)
          }
        })
      }
    })

    outgoingConnections.forEach(conn => {
      if (connectionErrors.has(conn.id)) {
        const connErrors = connectionErrors.get(conn.id)!
        connErrors.forEach(err => {
          if (!errors.includes(err)) {
            errors.push(`Outgoing connection: ${err}`)
          }
        })
      }
    })

    if (errors.length > 0) {
      nodeErrors.set(node.id, errors)
    }
  })

  const isValid = nodeErrors.size === 0 && connectionErrors.size === 0

  return {
    isValid,
    nodeErrors,
    connectionErrors,
  }
}

/**
 * Get validation errors for a specific node
 */
export function getNodeValidationErrors(
  workflow: Workflow | null,
  nodeId: string
): string[] {
  const validation = validateWorkflowDetailed(workflow)
  return validation.nodeErrors.get(nodeId) || []
}
