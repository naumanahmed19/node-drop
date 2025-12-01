import { NodeType, Workflow, WorkflowNode } from '@/types'
import { NodeValidator } from './nodeValidation'

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
 * Validate a node using the shared NodeValidator
 * Returns array of error messages
 */
function validateNodeWithType(
  node: WorkflowNode,
  nodeType: NodeType | undefined
): string[] {
  if (!nodeType) return []

  // Use the existing NodeValidator for consistent validation
  const result = NodeValidator.validateNode(node, nodeType.properties)
  
  // Convert ValidationError[] to string[]
  const errors = result.errors.map(e => e.message)

  // Also check credential selector if required
  if (nodeType.credentialSelector?.required) {
    const hasCredential = node.credentials && node.credentials.length > 0
    if (!hasCredential) {
      errors.push(`${nodeType.credentialSelector.displayName} is required`)
    }
  }

  return errors
}

/**
 * Validates a workflow and returns detailed error information
 * 
 * OPTIMIZATION: 
 * - Pre-builds connection lookup maps to avoid O(n*m) filtering
 * - Uses for loops instead of forEach for better performance
 * - Minimizes object creation
 */
export function validateWorkflowDetailed(
  workflow: Workflow | null,
  nodeTypes?: NodeType[]
): ValidationResult {
  const nodeErrors = new Map<string, string[]>()
  const connectionErrors = new Map<string, string[]>()

  if (!workflow) {
    return { isValid: true, nodeErrors, connectionErrors }
  }

  const { nodes, connections } = workflow

  // Create lookup maps once
  const nodeMap = new Map(nodes.map(node => [node.id, node]))
  const nodeTypeMap = nodeTypes 
    ? new Map(nodeTypes.map(nt => [nt.identifier, nt]))
    : null

  // Pre-build connection lookup maps for O(1) access
  const incomingConnectionsMap = new Map<string, typeof connections>()
  const outgoingConnectionsMap = new Map<string, typeof connections>()
  
  for (let i = 0; i < connections.length; i++) {
    const conn = connections[i]
    
    // Build incoming connections map
    const incoming = incomingConnectionsMap.get(conn.targetNodeId) || []
    incoming.push(conn)
    incomingConnectionsMap.set(conn.targetNodeId, incoming)
    
    // Build outgoing connections map
    const outgoing = outgoingConnectionsMap.get(conn.sourceNodeId) || []
    outgoing.push(conn)
    outgoingConnectionsMap.set(conn.sourceNodeId, outgoing)
  }

  // Validate connections
  for (let i = 0; i < connections.length; i++) {
    const connection = connections[i]
    const errors: string[] = []
    const sourceNode = nodeMap.get(connection.sourceNodeId)
    const targetNode = nodeMap.get(connection.targetNodeId)

    if (!sourceNode) {
      errors.push(`Source node not found`)
    }

    if (!targetNode) {
      errors.push(`Target node not found`)
    }

    if (!connection.sourceOutput) {
      errors.push(`Missing output handle`)
      if (sourceNode) {
        const list = nodeErrors.get(connection.sourceNodeId) || []
        list.push(`Connection: Missing output handle`)
        nodeErrors.set(connection.sourceNodeId, list)
      }
    }

    if (!connection.targetInput) {
      errors.push(`Missing input handle`)
      if (targetNode) {
        const list = nodeErrors.get(connection.targetNodeId) || []
        list.push(`Connection: Missing input handle`)
        nodeErrors.set(connection.targetNodeId, list)
      }
    }

    if (errors.length > 0) {
      connectionErrors.set(connection.id, errors)
    }
  }

  // Validate nodes
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    let errors = nodeErrors.get(node.id) || []

    // Check basic node properties (type only - name is checked by NodeValidator)
    if (!node.type) {
      errors.push('Missing node type')
    }

    // Validate using NodeValidator (same as ConfigTab - includes name check)
    if (nodeTypeMap && node.type) {
      const nodeType = nodeTypeMap.get(node.type)
      if (nodeType) {
        const nodeValidationErrors = validateNodeWithType(node, nodeType)
        if (nodeValidationErrors.length > 0) {
          errors = errors.concat(nodeValidationErrors)
        }
      }
    }

    // Add connection errors using pre-built maps (O(1) lookup)
    const incoming = incomingConnectionsMap.get(node.id)
    if (incoming) {
      for (let j = 0; j < incoming.length; j++) {
        const connErrors = connectionErrors.get(incoming[j].id)
        if (connErrors) {
          for (let k = 0; k < connErrors.length; k++) {
            const err = `Incoming: ${connErrors[k]}`
            if (!errors.includes(err)) errors.push(err)
          }
        }
      }
    }

    const outgoing = outgoingConnectionsMap.get(node.id)
    if (outgoing) {
      for (let j = 0; j < outgoing.length; j++) {
        const connErrors = connectionErrors.get(outgoing[j].id)
        if (connErrors) {
          for (let k = 0; k < connErrors.length; k++) {
            const err = `Outgoing: ${connErrors[k]}`
            if (!errors.includes(err)) errors.push(err)
          }
        }
      }
    }

    if (errors.length > 0) {
      nodeErrors.set(node.id, errors)
    }
  }

  return {
    isValid: nodeErrors.size === 0 && connectionErrors.size === 0,
    nodeErrors,
    connectionErrors,
  }
}

/**
 * Get validation errors for a specific node
 */
export function getNodeValidationErrors(
  workflow: Workflow | null,
  nodeId: string,
  nodeTypes?: NodeType[]
): string[] {
  const validation = validateWorkflowDetailed(workflow, nodeTypes)
  return validation.nodeErrors.get(nodeId) || []
}
