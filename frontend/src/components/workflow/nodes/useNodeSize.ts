import { useMemo } from 'react'
import { NODE_SIZE_CONFIG, NodeSize } from './nodeSizeConfig'

interface UseNodeSizeProps {
  small?: boolean
  dynamicHeight?: string
  compactMode?: boolean
  isServiceNode?: boolean
}

/**
 * Custom hook for calculating node size configuration
 * Determines the appropriate size (small/medium/large) and returns styling properties
 */
export function useNodeSize({ 
  small, 
  dynamicHeight, 
  compactMode,
  isServiceNode 
}: UseNodeSizeProps) {
  return useMemo(() => {
    // Determine node size
    let size: NodeSize = 'medium'
    if (small) {
      size = 'small'
    } else if (dynamicHeight && dynamicHeight !== '60px') {
      size = 'large'
    }
    
    const config = NODE_SIZE_CONFIG[size]
    
    // Get container classes based on size and compact mode
    const containerClasses = compactMode || isServiceNode
      ? config.padding.compact
      : config.padding.normal
    
    return {
      size,
      minHeight: dynamicHeight || config.minHeight,
      iconSize: config.iconSize,
      labelClass: config.labelClass,
      containerClasses,
      config
    }
  }, [small, dynamicHeight, compactMode, isServiceNode])
}
