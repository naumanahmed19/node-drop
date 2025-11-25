import { clsx } from 'clsx'
import { Plus } from 'lucide-react'
import { memo, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { calculateHandlePosition } from '../utils/handlePositioning'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface NodeHandlesProps {
  inputs?: string[]
  outputs?: string[]
  inputNames?: string[]
  outputNames?: string[]
  inputsConfig?: Record<string, {
    position?: 'left' | 'right' | 'top' | 'bottom';
    displayName?: string;
    required?: boolean;
  }>
  disabled: boolean
  isTrigger: boolean
  hoveredOutput: string | null
  onOutputMouseEnter: (output: string) => void
  onOutputMouseLeave: () => void
  onOutputClick: (event: React.MouseEvent<HTMLDivElement>, output: string) => void
  onServiceInputClick?: (event: React.MouseEvent<HTMLDivElement>, input: string) => void
  readOnly?: boolean
  showInputLabels?: boolean
  showOutputLabels?: boolean
  compactMode?: boolean
}

export const NodeHandles = memo(function NodeHandles({
  inputs,
  outputs,
  inputNames,
  outputNames,
  inputsConfig,
  disabled,
  isTrigger,
  hoveredOutput,
  onOutputMouseEnter,
  onOutputMouseLeave,
  onOutputClick,
  onServiceInputClick,
  readOnly = false,
  showInputLabels = false,
  showOutputLabels = false,
  compactMode = false
}: NodeHandlesProps) {
  // Separate inputs by position - memoized to prevent recalculation
  const { leftInputs, bottomInputs } = useMemo(() => {
    const left: string[] = []
    const bottom: string[] = []
    
    inputs?.forEach(input => {
      const position = inputsConfig?.[input]?.position || 'left'
      if (position === 'bottom') {
        bottom.push(input)
      } else {
        left.push(input)
      }
    })
    
    return { leftInputs: left, bottomInputs: bottom }
  }, [inputs, inputsConfig])
  return (
    <>
      {/* Left Input Handles */}
      {leftInputs.length > 0 && (
        <>
          {leftInputs.map((input, index) => {
            const top = calculateHandlePosition(index, leftInputs.length)
            const inputLabel = inputsConfig?.[input]?.displayName || inputNames?.[inputs?.indexOf(input) || 0] || input

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

      {/* Bottom Input Handles (Service Inputs) */}
      {bottomInputs.length > 0 && (
        <>
          {bottomInputs.map((input, index) => {
            const left = calculateHandlePosition(index, bottomInputs.length)
            const inputLabel = inputsConfig?.[input]?.displayName || input
            const isRequired = inputsConfig?.[input]?.required
            const isHovered = hoveredOutput === input

            return (
              <>
                {/* Label inside node, above the handle - hidden in compact mode */}
                {!compactMode && (
                  <div
                    key={`input-bottom-label-${input}-${index}`}
                    className="absolute flex items-center justify-center"
                    style={{
                      bottom: '12px',
                      left,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <span className="text-[8px] font-medium text-muted-foreground whitespace-nowrap pointer-events-none select-none">
                      {inputLabel}
                      {isRequired && <span className="text-destructive ml-0.5">*</span>}
                    </span>
                  </div>
                )}

                {/* Handle at bottom edge with interactive behavior */}
                <TooltipProvider key={`input-bottom-${input}-${index}`} delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute"
                        style={{
                          bottom: '-6px',
                          left,
                          transform: 'translateX(-50%)',
                        }}
                        onMouseEnter={() => onOutputMouseEnter(input)}
                        onMouseLeave={onOutputMouseLeave}
                      >
                        <div className="relative">
                          <Handle
                            id={input}
                            type="target"
                            position={Position.Bottom}
                            style={{
                              position: 'relative',
                              top: 0,
                              left: 0,
                              right: 'auto',
                              bottom: 'auto',
                              transform: 'none',
                            }}
                            className={clsx(
                              "w-3 h-3 border-2 border-white dark:border-background rounded-full cursor-pointer transition-all duration-200",
                              disabled ? "!bg-muted" : "!bg-muted-foreground hover:!bg-primary hover:scale-125",
                              isRequired && "ring-2 ring-muted-foreground/30"
                            )}
                            onClick={(e) => onServiceInputClick ? onServiceInputClick(e, input) : onOutputClick(e, input)}
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
                    </TooltipTrigger>
                    {compactMode && (
                      <TooltipContent side="top" className="text-xs">
                        {inputLabel}
                        {isRequired && <span className="text-destructive ml-1">*</span>}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </>
            )
          })}
        </>
      )}

      {/* Output Handles */}
      {outputs && outputs.length > 0 && (
        <>
          {outputs.map((output, index) => {
            // Check if this is a service output (positioned at top of node)
            // Service outputs: any output ending with 'Service' (e.g., 'toolService', 'memoryService', 'embeddingsService')
            // To add a new service type, just name it with 'Service' suffix (e.g., outputs: ['myCustomService'])
            const isServiceOutput = output.endsWith('Service')
            
            // For service outputs at top, use horizontal positioning
            // For regular outputs on right, use vertical positioning
            const position = isServiceOutput 
              ? calculateHandlePosition(index, outputs.length) // horizontal position (left percentage)
              : calculateHandlePosition(index, outputs.length) // vertical position (top percentage)
            
            const isHovered = hoveredOutput === output
            const outputLabel = outputNames?.[index] || output

            return (
              <OutputHandle
                key={`output-${output}-${index}`}
                output={output}
                outputLabel={outputLabel}
                top={position}
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
  // Service outputs (tool, memory, model) are positioned at the top with standard color
  if (isServiceOutput) {
    return (
      <div
        className="absolute"
        style={{
          top: '-6px',
          left: top, // Use 'top' prop as horizontal position (left percentage)
          transform: 'translateX(-50%)',
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
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

