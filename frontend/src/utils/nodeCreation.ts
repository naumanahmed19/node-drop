import { NodeType, WorkflowNode } from '@/types'

export function createWorkflowNode(
  nodeType: NodeType,
  position: { x: number; y: number },
  parentGroupId?: string
): WorkflowNode {
  // Initialize parameters with defaults from node type
  const parameters: Record<string, any> = { ...nodeType.defaults }

  // Add default values from properties
  nodeType.properties.forEach((property) => {
    if (property.default !== undefined && parameters[property.name] === undefined) {
      parameters[property.name] = property.default
    }
  })

  const newNode: WorkflowNode = {
    id: `node-${Date.now()}`,
    type: nodeType.identifier,
    name: nodeType.displayName,
    parameters,
    position,
    credentials: [],
    disabled: false,
    icon: nodeType.icon,
    color: nodeType.color,
    ...(parentGroupId && {
      parentId: parentGroupId,
      extent: 'parent' as const,
    }),
  }

  return newNode
}
