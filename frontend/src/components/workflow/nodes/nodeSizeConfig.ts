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
}

export const NODE_SIZE_CONFIG: Record<NodeSize, NodeSizeConfig> = {
  small: {
    minHeight: '40px',
    iconSize: 'sm',
    labelClass: 'text-[8px]',
    padding: {
      compact: 'justify-center gap-1 p-1.5',
      normal: 'justify-center gap-1.5 p-1.5'
    }
  },
  medium: {
    minHeight: '',
    iconSize: 'md',
    labelClass: 'text-sm',
    padding: {
      compact: 'justify-center gap-0 p-2',
      normal: 'gap-2 p-2'
    }
  },
  large: {
    minHeight: '80px',
    iconSize: 'md',
    labelClass: 'text-sm',
    padding: {
      compact: 'justify-center gap-0 p-2',
      normal: 'gap-2 p-3'
    }
  }
}
