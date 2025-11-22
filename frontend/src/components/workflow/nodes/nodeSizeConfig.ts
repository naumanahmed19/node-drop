/**
 * Node Size Configuration
 * Centralized configuration for node sizes in the workflow canvas
 */

export type NodeSize = 'small' | 'medium' | 'large'

export interface NodeSizeConfig {
  minHeight: string
  iconSize: 'sm' | 'md'
  labelClass: string
  padding: {
    compact: string
    normal: string
  }
  width: {
    collapsed: string
    expanded: string
  }
}

export const NODE_SIZE_CONFIG: Record<NodeSize, NodeSizeConfig> = {
  small: {
    minHeight: '40px',
    iconSize: 'sm',
    labelClass: 'text-[8px]',
    padding: {
      compact: 'justify-center gap-1 p-1.5',
      normal: 'justify-center gap-1.5 p-1.5'
    },
    width: {
      collapsed: '160px',
      expanded: '280px'
    }
  },
  medium: {
    minHeight: '',
    iconSize: 'md',
    labelClass: 'text-sm',
    padding: {
      compact: 'justify-center gap-0 p-2',
      normal: 'gap-2 p-2'
    },
    width: {
      collapsed: '180px',
      expanded: '320px'
    }
  },
  large: {
    minHeight: '80px',
    iconSize: 'md',
    labelClass: 'text-sm',
    padding: {
      compact: 'justify-center gap-0 p-2',
      normal: 'gap-2 p-3'
    },
    width: {
      collapsed: '200px',
      expanded: '360px'
    }
  }
}
