

interface NodeLabelProps {
  label: string
  small?: boolean
  compactMode?: boolean
  labelClass?: string
}

/**
 * NodeLabel - Renders node label with appropriate styling based on size and mode
 */
export function NodeLabel({ label, small, compactMode, labelClass }: NodeLabelProps) {
  // Don't render label in compact mode
  if (compactMode) return null
  
  // Small node label
  if (small) {
    return (
      <div className="flex flex-col min-w-0 flex-1">
        <span className={labelClass || 'text-[8px] font-medium truncate leading-tight'}>
          {label}
        </span>
      </div>
    )
  }
  
  // Regular node label
  return (
    <div className="flex flex-col min-w-0 flex-1">
      <span className={labelClass || 'text-sm font-medium truncate'}>
        {label}
      </span>
    </div>
  )
}

NodeLabel.displayName = 'NodeLabel'
