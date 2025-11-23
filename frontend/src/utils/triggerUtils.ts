/**
 * Utility functions for working with trigger nodes in the frontend
 */

import { NodeType, WorkflowNode } from '../types/workflow'

/**
 * Check if a node type is a trigger
 * Uses nodeCategory (all trigger nodes should have this)
 */
export function isTriggerNodeType(nodeType: NodeType | undefined): boolean {
  if (!nodeType) return false
  
  // Check nodeCategory (all trigger nodes have this now)
  if (nodeType.nodeCategory === 'trigger') return true
  
  // Legacy fallback: check triggerType for older nodes
  return nodeType.triggerType !== undefined
}

/**
 * Check if a workflow node is a trigger using available node types
 */
export function isTriggerNode(node: WorkflowNode, nodeTypes: NodeType[]): boolean {
  const nodeType = nodeTypes.find(nt => nt.identifier === node.type)
  return isTriggerNodeType(nodeType)
}

/**
 * Get trigger type from a node
 */
export function getTriggerType(node: WorkflowNode, nodeTypes: NodeType[]): string | undefined {
  const nodeType = nodeTypes.find(nt => nt.identifier === node.type)
  return nodeType?.triggerType
}

/**
 * Get all trigger nodes from a workflow
 */
export function getTriggerNodes(nodes: WorkflowNode[], nodeTypes: NodeType[]): WorkflowNode[] {
  return nodes.filter(node => isTriggerNode(node, nodeTypes))
}

/**
 * Extract triggers from workflow nodes (for saving to backend)
 * Uses node types to determine trigger type from node definitions
 * Converts simple/datetime schedules to cron expressions
 */
export function extractTriggersFromNodes(nodes: WorkflowNode[], nodeTypes?: NodeType[]): any[] {
  if (!Array.isArray(nodes)) {
    return []
  }

  // If nodeTypes are provided, use them for accurate trigger detection
  if (nodeTypes && nodeTypes.length > 0) {
    return nodes
      .filter((node) => {
        const nodeType = nodeTypes.find(nt => nt.identifier === node.type)
        return nodeType?.triggerType !== undefined
      })
      .map((node) => {
        const nodeType = nodeTypes.find(nt => nt.identifier === node.type)
        const triggerType = nodeType?.triggerType || 'manual'
        
        return {
          id: `trigger-${node.id}`,
          type: triggerType,
          nodeId: node.id,
          active: !node.disabled,
          settings: {
            description: node.parameters?.description || `${node.name} trigger`,
            ...node.parameters,
          },
        }
      })
  }

  // Fallback: Simple extraction based on node type naming patterns
  // This ensures backward compatibility if nodeTypes are not provided
  return nodes
    .filter((node) => {
      // Check if node type includes 'trigger' in its identifier
      return node.type.toLowerCase().includes('trigger')
    })
    .map((node) => {
      // Try to infer trigger type from node type identifier
      const nodeTypeId = node.type.toLowerCase()
      let triggerType = 'manual' // default
      
      if (nodeTypeId.includes('webhook')) triggerType = 'webhook'
      else if (nodeTypeId.includes('schedule') || nodeTypeId.includes('cron')) triggerType = 'schedule'
      else if (nodeTypeId.includes('polling')) triggerType = 'polling'
      else if (nodeTypeId.includes('manual')) triggerType = 'manual'
      
      return {
        id: `trigger-${node.id}`,
        type: triggerType,
        nodeId: node.id,
        active: !node.disabled,
        settings: {
          description: node.parameters?.description || `${node.name} trigger`,
          ...node.parameters,
        },
      }
    })
}
