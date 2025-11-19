import { useReactFlowUIStore } from '@/stores'
import { ChevronDown, ChevronUp, LucideIcon } from 'lucide-react'
import { memo } from 'react'
import { NodeIcon } from './NodeIcon'

interface NodeHeaderProps {
  /** Node label text */
  label: string
  /** Optional additional info (e.g., "5 messages") */
  headerInfo?: string
  /** Icon configuration */
  icon?: {
    /** Lucide icon component */
    Icon?: LucideIcon
    /** Icon background color */
    iconColor?: string
    /** Node config for icon rendering */
    config?: {
      icon?: string
      color?: string
      isTrigger?: boolean
      imageUrl?: string
    }
  }
  /** Whether the node is in expanded state */
  isExpanded?: boolean
  /** Whether the node can be expanded/collapsed */
  canExpand?: boolean
  /** Callback when expand/collapse is clicked */
  onToggleExpand?: () => void
  /** Whether to show a border at the bottom */
  showBorder?: boolean
  /** Whether the node is currently executing */
  isExecuting?: boolean
  /** Force hide label (for service nodes in compact mode) */
  hideLabel?: boolean
}

/**
 * NodeHeader - A reusable header component for nodes
 * 
 * Displays the node icon, label, optional info, and expand/collapse button.
 * Can be used in both collapsed and expanded states.
 * 
 * @example
 * ```tsx
 * <NodeHeader
 *   label="My Node"
 *   headerInfo="5 items"
 *   icon={{ Icon: MessageCircle, iconColor: 'bg-blue-500' }}
 *   isExpanded={true}
 *   canExpand={true}
 *   onToggleExpand={() => setExpanded(!expanded)}
 *   showBorder={true}
 * />
 * ```
 */
export const NodeHeader = memo(function NodeHeader({
  label,
  headerInfo,
  icon,
  isExpanded = false,
  canExpand = true,
  onToggleExpand,
  showBorder = false,
  isExecuting = false,
  hideLabel = false
}: NodeHeaderProps) {
  const { compactMode } = useReactFlowUIStore()
  
  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpand?.()
  }
  
  return (
    <div className={`flex items-center ${compactMode && !isExpanded && (!canExpand || !onToggleExpand) ? 'justify-center' : 'justify-between'} ${compactMode && !isExpanded ? 'p-2' : 'p-3'} ${showBorder ? 'border-b border-border' : ''}`}>
      <div className={`flex items-center ${compactMode && !isExpanded ? 'gap-0' : 'gap-2'} ${!compactMode || isExpanded ? 'flex-1' : ''} min-w-0`}>
        {/* Icon Component */}
        {icon && (
          <NodeIcon 
            Icon={icon.Icon}
            iconColor={icon.iconColor}
            config={icon.config}
            isExecuting={isExecuting}
          />
        )}
        
        {/* Label Section - Hidden in compact mode ONLY when collapsed, or when hideLabel is true */}
        {(!compactMode || isExpanded) && !hideLabel && (
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium truncate">{label}</span>
            {headerInfo && (
              <span className="text-xs text-muted-foreground truncate">
                {headerInfo}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Expand/Collapse Button - Hide in compact mode when collapsed, show in normal mode or when expanded */}
      {canExpand && onToggleExpand && (!compactMode || isExpanded) && (
        <button
          onClick={handleToggleClick}
          className={`flex items-center justify-center ${compactMode ? 'h-6 w-6' : 'h-8 w-8'} rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex-shrink-0`}
          aria-label={isExpanded ? 'Collapse node' : 'Expand node'}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  )
})

