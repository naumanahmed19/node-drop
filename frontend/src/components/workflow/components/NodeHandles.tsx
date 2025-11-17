import { clsx } from 'clsx'
import { Plus } from 'lucide-react'
import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { calculateHandlePosition } from '../utils/handlePositioning'

interface NodeHandlesProps {
  inputs?: string[]
  outputs?: string[]
  inputNames?: string[]
  outputNames?: string[]
  disabled: boolean
  isTrigger: boolean
  hoveredOutput: string | null
  onOutputMouseEnter: (output: string) => void
  onOutputMouseLeave: () => void
  onOutputClick: (event: React.MouseEvent<HTMLDivElement>, output: string) => void
  readOnly?: boolean
  showInputLabels?: boolean
  showOutputLabels?: boolean
}

export const NodeHandles = memo(function NodeHandles({
  inputs,
  outputs,
  inputNames,
  outputNames,
  disabled,
  isTrigger,
  hoveredOutput,
  onOutputMouseEnter,
  onOutputMouseLeave,
  onOutputClick,
  readOnly = false,
  showInputLabels = false,
  showOutputLabels = false
}: NodeHandlesProps) {
  return (
    <>
      {/* Input Handles */}
      {inputs && inputs.length > 0 && (
        <>
          {inputs.map((input, index) => {
            const top = calculateHandlePosition(index, inputs.length)
            const inputLabel = inputNames?.[index] || input

            return (
              <div
                key={`input-${input}-${index}`}
                className="absolute flex items-center gap-1.5"
                style={{
                  top,
                  left: '-6px',
                  transform: 'translateY(-50%)',
                }}
              >
                <Handle
                  id={input}
                  type="target"
                  position={Position.Left}
                  style={{
                    position: 'relative',
                    top: 0,
                    left: 0,
                    right: 'auto',
                    transform: 'none',
                  }}
                  className={clsx(
                    "w-3 h-3 border-2 border-white dark:border-background",
                    disabled ? "!bg-muted" : "!bg-muted-foreground"
                  )}
                />
                
                {/* Label */}
                {showInputLabels && (
                  <span className="text-[9px] font-medium text-muted-foreground bg-background/80 px-1 py-0.5 rounded whitespace-nowrap pointer-events-none select-none">
                    {inputLabel}
                  </span>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* Output Handles */}
      {outputs && outputs.length > 0 && (
        <>
          {outputs.map((output, index) => {
            // Check if this is a service output (tool, memory, model) - position at top instead of right
            const isServiceOutput = output === 'tool' || output === 'memory' || output === 'model'
            const top = calculateHandlePosition(index, outputs.length)
            const isHovered = hoveredOutput === output
            const outputLabel = outputNames?.[index] || output

            return (
              <OutputHandle
                key={`output-${output}-${index}`}
                output={output}
                outputLabel={outputLabel}
                top={top}
                isHovered={isHovered}
                disabled={disabled}
                isTrigger={isTrigger}
                readOnly={readOnly}
                showLabel={showOutputLabels}
                isServiceOutput={isServiceOutput}
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
  outputLabel: string
  top: string
  isHovered: boolean
  disabled: boolean
  isTrigger: boolean
  readOnly: boolean
  showLabel?: boolean
  isServiceOutput?: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void
}

const OutputHandle = memo(function OutputHandle({
  output,
  outputLabel,
  top,
  isHovered,
  disabled,
  isTrigger,
  readOnly,
  showLabel = false,
  isServiceOutput = false,
  onMouseEnter,
  onMouseLeave,
  onClick
}: OutputHandleProps) {
  // Service outputs (tool, memory, model) are positioned at the top
  if (isServiceOutput) {
    return (
      <div
        className="absolute flex flex-col items-center gap-1"
        style={{
          top: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Handle wrapper for proper plus icon positioning */}
        <div className="relative">
          <Handle
            id={output}
            type="source"
            position={Position.Top}
            style={{
              position: 'relative',
              top: 0,
              left: 0,
              right: 'auto',
              bottom: 'auto',
              transform: 'none',
            }}
            className={clsx(
              "w-3 h-3 border-2 border-white dark:border-background cursor-pointer transition-all duration-200 rounded-full",
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
        
        {/* Label below handle */}
        {showLabel && (
          <span className="text-[9px] font-medium text-muted-foreground bg-background/80 px-1 py-0.5 rounded whitespace-nowrap pointer-events-none select-none">
            {outputLabel}
          </span>
        )}
      </div>
    )
  }

  // Regular outputs on the right side
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
          {outputLabel}
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

