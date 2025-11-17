import { clsx } from 'clsx'
import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'

interface ServiceInput {
  name: string
  displayName: string
  required?: boolean
  description?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

interface ServiceHandlesProps {
  serviceInputs?: ServiceInput[]
  disabled: boolean
}

/**
 * Calculate position for service handles distributed across an edge
 */
function calculateServiceHandlePosition(index: number, total: number): string {
  if (total === 1) {
    return '50%'
  }
  
  // Distribute handles evenly with padding
  const padding = 25 // percentage padding on each side (increased to avoid icon overlap)
  const availableWidth = 100 - (padding * 2)
  const step = availableWidth / (total - 1)
  const position = padding + (step * index)
  
  return `${position}%`
}

export const ServiceHandles = memo(function ServiceHandles({
  serviceInputs,
  disabled
}: ServiceHandlesProps) {
  if (!serviceInputs || serviceInputs.length === 0) {
    return null
  }

  // Group service inputs by position
  const groupedByPosition = serviceInputs.reduce((acc, input) => {
    const pos = input.position || 'bottom'
    if (!acc[pos]) acc[pos] = []
    acc[pos].push(input)
    return acc
  }, {} as Record<string, ServiceInput[]>)

  return (
    <>
      {Object.entries(groupedByPosition).map(([position, inputs]) => {
        return inputs.map((serviceInput, index) => {
          const offset = calculateServiceHandlePosition(index, inputs.length)
          
          return (
            <ServiceHandle
              key={`service-${serviceInput.name}-${index}`}
              serviceInput={serviceInput}
              disabled={disabled}
              offset={offset}
              position={position as 'top' | 'bottom' | 'left' | 'right'}
            />
          )
        })
      })}
    </>
  )
})

interface ServiceHandleProps {
  serviceInput: ServiceInput
  disabled: boolean
  offset: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const ServiceHandle = memo(function ServiceHandle({
  serviceInput,
  disabled,
  offset,
  position
}: ServiceHandleProps) {
  // Calculate label and handle positions based on edge
  const getLabelStyle = () => {
    if (position === 'bottom') {
      return { bottom: '4px', left: offset, transform: 'translateX(-50%)' }
    } else if (position === 'top') {
      return { top: '4px', left: offset, transform: 'translateX(-50%)' }
    } else if (position === 'left') {
      return { left: '4px', top: offset, transform: 'translateY(-50%)' }
    } else { // right
      return { right: '4px', top: offset, transform: 'translateY(-50%)' }
    }
  }

  const getHandleStyle = () => {
    if (position === 'bottom') {
      return { bottom: '-6px', left: offset, transform: 'translateX(-50%)' }
    } else if (position === 'top') {
      return { top: '-6px', left: offset, transform: 'translateX(-50%)' }
    } else if (position === 'left') {
      return { left: '-6px', top: offset, transform: 'translateY(-50%)' }
    } else { // right
      return { right: '-6px', top: offset, transform: 'translateY(-50%)' }
    }
  }

  const getReactFlowPosition = () => {
    switch (position) {
      case 'top': return Position.Top
      case 'bottom': return Position.Bottom
      case 'left': return Position.Left
      case 'right': return Position.Right
    }
  }

  return (
    <>
      {/* Label inside node */}
      <div
        className="absolute flex items-center justify-center"
        style={getLabelStyle()}
      >
        <span className="text-[6px] font-medium text-muted-foreground whitespace-nowrap pointer-events-none select-none">
          {serviceInput.displayName}
          {serviceInput.required && (
            <span className="text-destructive ml-0.5">*</span>
          )}
        </span>
      </div>

      {/* Handle at edge */}
      <div
        className="absolute group"
        style={getHandleStyle()}
      >
        <Handle
          id={serviceInput.name}
          type="target"
          position={getReactFlowPosition()}
          style={{
            position: 'relative',
            top: 0,
            left: 0,
            right: 'auto',
            bottom: 'auto',
            transform: 'none',
          }}
          className={clsx(
            "w-3 h-3 border-2 border-white dark:border-background rounded-full transition-all",
            disabled ? "!bg-muted" : "!bg-purple-500 hover:scale-125",
            serviceInput.required && "ring-2 ring-purple-500/30"
          )}
        />
      </div>
    </>
  )
})
