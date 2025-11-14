import { clsx } from 'clsx'
import { Plus } from 'lucide-react'
import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { calculateHandlePosition } from '../utils/handlePositioning'

interface NodeHandlesProps {
  inputs?: string[]
  outputs?: string[]
  disabled: boolean
  isTrigger: boolean
  hoveredOutput: string | null
  onOutputMouseEnter: (output: string) => void
  onOutputMouseLeave: () => void
  onOutputClick: (event: React.MouseEvent<HTMLDivElement>, output: string) => void
  readOnly?: boolean
  showOutputLabels?: boolean
}

export const NodeHandles = memo(function NodeHandles({
  inputs,
  outputs,
  disabled,
  isTrigger,
  hoveredOutput,
  onOutputMouseEnter,
  onOutputMouseLeave,
  onOutputClick,
  readOnly = false,
  showOutputLabels = false
}: NodeHandlesProps) {
  return (
    <>
      {/* Input Handles */}
      {inputs && inputs.length > 0 && (
        <>
          {inputs.map((input, index) => {
            const top = calculateHandlePosition(index, inputs.length)

            return (
              <Handle
                key={`input-${input}-${index}`}
                id={input}
                type="target"
                position={Position.Left}
                style={{
                  top,
                  transform: 'translateY(-50%)',
                  left: '-6px'
                }}
                className={clsx(
                  "w-3 h-3 border-2 border-white dark:border-background",
                  disabled ? "!bg-muted" : "!bg-muted-foreground"
                )}
              />
            )
          })}
        </>
      )}

      {/* Output Handles */}
      {outputs && outputs.length > 0 && (
        <>
          {outputs.map((output, index) => {
            const top = calculateHandlePosition(index, outputs.length)
            const isHovered = hoveredOutput === output

            return (
              <OutputHandle
                key={`output-${output}-${index}`}
                output={output}
                top={top}
                isHovered={isHovered}
                disabled={disabled}
                isTrigger={isTrigger}
                readOnly={readOnly}
                showLabel={showOutputLabels}
                onMouseEnter={() => onOutputMouseEnter(output)}
                onMouseLeave={onOutputMouseLeave}
                onClick={(e) => onOutputClick(e, output)}
              />
            )
          })}
        </>
      )}
    </>
  )
})

interface OutputHandleProps {
  output: string
  top: string
  isHovered: boolean
  disabled: boolean
  isTrigger: boolean
  readOnly: boolean
  showLabel?: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void
}

const OutputHandle = memo(function OutputHandle({
  output,
  top,
  isHovered,
  disabled,
  isTrigger,
  readOnly,
  showLabel = false,
  onMouseEnter,
  onMouseLeave,
  onClick
}: OutputHandleProps) {
  return (
    <div
      className="absolute flex items-center gap-1.5"
      style={{
        top,
        right: '-6px',
        transform: 'translateY(-50%)',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Label */}
      {showLabel && (
        <span className="text-[9px] font-medium text-muted-foreground bg-background/80 px-1 py-0.5 rounded whitespace-nowrap pointer-events-none select-none">
          {output}
        </span>
      )}

      {/* Handle wrapper for proper plus icon positioning */}
      <div className="relative">
        <Handle
          id={output}
          type="source"
          position={Position.Right}
          style={{
            position: 'relative',
            top: 0,
            left: 0,
            right: 'auto',
            transform: 'none',
          }}
          className={clsx(
            "w-3 h-3 border-2 border-white dark:border-background cursor-pointer transition-all duration-200",
            isTrigger ? "rounded-full" : "",
            disabled ? "!bg-muted" : "!bg-muted-foreground hover:!bg-primary hover:scale-125"
          )}
          onClick={onClick}
        />

        {/* Plus icon on hover */}
        {isHovered && !disabled && !readOnly && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ zIndex: 10 }}
          >
            <div className="bg-primary rounded-full p-0.5 shadow-lg animate-in fade-in zoom-in duration-150">
              <Plus className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

