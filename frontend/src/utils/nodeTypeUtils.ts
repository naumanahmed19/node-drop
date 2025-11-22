/**
 * Node Type Utilities
 * 
 * Utilities for checking node types and determining their execution capabilities.
 * Service and tool nodes are not directly executable - they are called by other nodes.
 */

import type { NodeType } from '@/types'

/**
 * Check if a node type is a service node
 * Service nodes (like AI models) are not directly executable
 * 
 * @param nodeType - The node type string or NodeType object
 * @returns true if the node is a service type
 */
export function isServiceNode(nodeType: string | NodeType): boolean {
  if (typeof nodeType === 'object' && nodeType !== null) {
    // Check the nodeCategory property (new approach)
    return (nodeType as any).nodeCategory === 'service'
  }
  return false
}

/**
 * Check if a node type is a tool node
 * Tool nodes are not directly executable - they are called by AI agents
 * 
 * @param nodeType - The node type string or NodeType object
 * @returns true if the node is a tool type
 */
export function isToolNode(nodeType: string | NodeType): boolean {
  if (typeof nodeType === 'object' && nodeType !== null) {
    // Check the nodeCategory property (new approach)
    return (nodeType as any).nodeCategory === 'tool'
  }
  return false
}

/**
 * Check if a node type is executable
 * Service and tool nodes are not directly executable
 * 
 * @param nodeType - The node type string or NodeType object
 * @returns true if the node can be executed directly
 */
export function isNodeExecutable(nodeType: string | NodeType): boolean {
  return !isServiceNode(nodeType) && !isToolNode(nodeType)
}

/**
 * Check if a node type is a service or tool node
 * These nodes are not directly executable
 * 
 * @param nodeType - The node type string or NodeType object
 * @returns true if the node is a service or tool type
 */
export function isServiceOrToolNode(nodeType: string | NodeType): boolean {
  return isServiceNode(nodeType) || isToolNode(nodeType)
}
