import { WorkflowNode } from '@/types'

/**
 * Replace template variables in a string
 * Supports {{VARIABLE_NAME}} syntax
 * Also supports complex names like {{$local.variable_name}}
 */
export function replaceVariables(
  text: string,
  values: Record<string, any>
): string {
  return text.replace(/\{\{([\w.$]+)\}\}/g, (match, variableName) => {
    const value = values[variableName]
    return value !== undefined ? String(value) : match
  })
}

/**
 * Replace variables in node parameters recursively
 */
export function replaceVariablesInObject(
  obj: any,
  values: Record<string, any>
): any {
  if (typeof obj === 'string') {
    return replaceVariables(obj, values)
  }

  if (Array.isArray(obj)) {
    return obj.map(item => replaceVariablesInObject(item, values))
  }

  if (obj && typeof obj === 'object') {
    const result: any = {}
    for (const key in obj) {
      result[key] = replaceVariablesInObject(obj[key], values)
    }
    return result
  }

  return obj
}

/**
 * Replace variables in template nodes
 */
export function replaceVariablesInNodes(
  nodes: WorkflowNode[],
  values: Record<string, any>
): WorkflowNode[] {
  return nodes.map(node => ({
    ...node,
    name: replaceVariables(node.name, values),
    description: node.description ? replaceVariables(node.description, values) : undefined,
    parameters: replaceVariablesInObject(node.parameters, values),
  }))
}

/**
 * Detect variables in template nodes
 * Returns a Set of variable names found
 * Supports complex variable names like $local.variable_name
 */
export function detectVariablesInNodes(nodes: WorkflowNode[]): Set<string> {
  const variables = new Set<string>()
  
  const findVariables = (obj: any) => {
    if (typeof obj === 'string') {
      const matches = obj.matchAll(/\{\{([\w.$]+)\}\}/g)
      for (const match of matches) {
        variables.add(match[1])
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(findVariables)
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(findVariables)
    }
  }

  nodes.forEach(node => {
    findVariables(node.name)
    findVariables(node.description)
    findVariables(node.parameters)
  })

  return variables
}

/**
 * Check if template has variables
 */
export function hasVariables(nodes: WorkflowNode[]): boolean {
  return detectVariablesInNodes(nodes).size > 0
}

/**
 * Detect credentials used in template nodes
 * Returns a Set of node names that use credentials
 */
export function detectCredentialsInNodes(nodes: WorkflowNode[]): Set<string> {
  const nodesWithCredentials = new Set<string>()
  
  nodes.forEach(node => {
    if (node.credentials && node.credentials.length > 0) {
      nodesWithCredentials.add(node.name)
    }
  })

  return nodesWithCredentials
}
