import { ReactNode } from 'react'

export interface NodeEnhancementContext {
  nodeId: string
  nodeType: string
  parameters: Record<string, any>
  isExecuting: boolean
  executionResult?: any
}

export interface NodeEnhancement {
  /** Which node types this enhancement applies to */
  nodeTypes: string[]
  
  /** Render additional UI for the node (e.g., badges, overlays) */
  renderOverlay?: (context: NodeEnhancementContext) => ReactNode | null
  
  /** Modify node config before rendering */
  enhanceConfig?: (config: any, context: NodeEnhancementContext) => any
}

class NodeEnhancementRegistry {
  private enhancements: NodeEnhancement[] = []

  register(enhancement: NodeEnhancement) {
    this.enhancements.push(enhancement)
  }

  getEnhancements(nodeType: string): NodeEnhancement[] {
    return this.enhancements.filter(e => e.nodeTypes.includes(nodeType))
  }

  renderOverlays(context: NodeEnhancementContext): ReactNode[] {
    const enhancements = this.getEnhancements(context.nodeType)
    return enhancements
      .map(e => e.renderOverlay?.(context))
      .filter(Boolean) as ReactNode[]
  }

  enhanceConfig(config: any, context: NodeEnhancementContext): any {
    const enhancements = this.getEnhancements(context.nodeType)
    return enhancements.reduce(
      (acc, e) => e.enhanceConfig?.(acc, context) || acc,
      config
    )
  }
}

export const nodeEnhancementRegistry = new NodeEnhancementRegistry()
