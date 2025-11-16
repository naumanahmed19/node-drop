import { WorkflowNode, WorkflowConnection } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { replaceVariablesInNodes } from './templateVariables'

export interface TemplateExpansionResult {
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
}

/**
 * Expand a template into individual nodes and connections
 * Generates new unique IDs and adjusts positions relative to drop point
 */
export function expandTemplate(
  templateNodes: WorkflowNode[],
  templateConnections: WorkflowConnection[],
  dropPosition: { x: number; y: number },
  variableValues?: Record<string, any>
): TemplateExpansionResult {
  console.log('🔧 expandTemplate called with:', {
    nodesCount: templateNodes.length,
    connectionsCount: templateConnections.length,
    dropPosition,
    templateNodes,
    templateConnections
  });

  if (templateNodes.length === 0) {
    console.warn('⚠️ No nodes to expand!');
    return { nodes: [], connections: [] }
  }

  // Replace variables in nodes if values provided
  const processedNodes = variableValues 
    ? replaceVariablesInNodes(templateNodes, variableValues)
    : templateNodes

  // Separate top-level nodes (no parent) from grouped nodes
  const topLevelNodes = processedNodes.filter(n => !n.parentId)
  const groupedNodes = processedNodes.filter(n => n.parentId)

  // Calculate the bounding box of top-level nodes only to find center
  const topLevelPositions = topLevelNodes.map(n => n.position)
  const minX = Math.min(...topLevelPositions.map(p => p.x))
  const minY = Math.min(...topLevelPositions.map(p => p.y))
  const maxX = Math.max(...topLevelPositions.map(p => p.x))
  const maxY = Math.max(...topLevelPositions.map(p => p.y))
  
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  console.log('📐 Template bounds:', { 
    minX, minY, maxX, maxY, centerX, centerY,
    topLevelCount: topLevelNodes.length,
    groupedCount: groupedNodes.length
  });

  // Create mapping from old IDs to new IDs (including group nodes)
  const idMapping = new Map<string, string>()
  processedNodes.forEach(node => {
    idMapping.set(node.id, `node-${Date.now()}-${uuidv4().slice(0, 8)}`)
  })

  // Create new nodes with updated IDs and positions
  const newNodes: WorkflowNode[] = processedNodes.map(node => {
    const newId = idMapping.get(node.id)!
    
    let newPosition: { x: number; y: number }
    
    if (node.parentId) {
      // For grouped nodes, keep their relative position to the parent unchanged
      newPosition = {
        x: node.position.x,
        y: node.position.y
      }
    } else {
      // For top-level nodes, calculate offset from template center
      const offsetX = node.position.x - centerX
      const offsetY = node.position.y - centerY
      
      // Apply offset to drop position
      newPosition = {
        x: dropPosition.x + offsetX,
        y: dropPosition.y + offsetY
      }
    }

    // If node has a parentId, map it to the new parent ID
    const newParentId = node.parentId ? idMapping.get(node.parentId) : undefined

    return {
      ...node,
      id: newId,
      position: newPosition,
      // Update parentId to new group ID if it exists
      ...(newParentId && { parentId: newParentId }),
      // Remove parentId if the original didn't have one
      ...(!node.parentId && { parentId: undefined }),
      // Remove any execution state
      disabled: false,
    }
  })

  // Create new connections with updated IDs
  const newConnections: WorkflowConnection[] = templateConnections.map(conn => {
    const newSourceId = idMapping.get(conn.sourceNodeId)
    const newTargetId = idMapping.get(conn.targetNodeId)

    if (!newSourceId || !newTargetId) {
      console.warn('Connection references non-existent node:', conn)
      return null
    }

    return {
      ...conn,
      id: `${newSourceId}-${newTargetId}-${Date.now()}`,
      sourceNodeId: newSourceId,
      targetNodeId: newTargetId,
    }
  }).filter((conn): conn is WorkflowConnection => conn !== null)

  console.log('✅ Template expansion result:', {
    nodesCount: newNodes.length,
    connectionsCount: newConnections.length,
    newNodes,
    newConnections
  });

  return {
    nodes: newNodes,
    connections: newConnections,
  }
}

/**
 * Check if a node type is a template
 */
export function isTemplateNodeType(nodeType: any): boolean {
  return nodeType?.isTemplate === true && nodeType?.templateData != null
}

/**
 * Get template data from a node type
 */
export function getTemplateData(nodeType: any): { nodes: WorkflowNode[]; connections: WorkflowConnection[] } | null {
  if (!isTemplateNodeType(nodeType)) {
    return null
  }

  return nodeType.templateData || null
}
