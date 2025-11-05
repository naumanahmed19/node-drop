import { cn } from '@/lib/utils'
import { ExpressionInput } from './ExpressionInput'

export interface KeyValueRowValue {
  key: string
  value: string
}

export interface KeyValueRowProps {
  value: KeyValueRowValue
  onChange: (value: KeyValueRowValue) => void
  onBlur?: () => void
  disabled?: boolean
  error?: string
  nodeId?: string
  keyPlaceholder?: string
  valuePlaceholder?: string
}

export function KeyValueRow({
  value = { key: '', value: '' },
  onChange,
  onBlur,
  disabled = false,
  error,
  nodeId,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
}: KeyValueRowProps) {
  const handleKeyChange = (newKey: string) => {
    onChange({ ...value, key: newKey })
  }

  const handleValueChange = (newValue: string) => {
    onChange({ ...value, value: newValue })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <div className={cn(
          'flex-1 flex items-center border rounded-md bg-background overflow-visible focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          error && 'border-destructive'
        )}>
          {/* Key Field */}
          <div className="flex-1 relative [&_textarea]:border-0 [&_textarea]:focus-visible:ring-0 [&_textarea]:focus-visible:ring-offset-0 [&_textarea]:rounded-none [&>div]:space-y-0 [&>div]:overflow-visible">
            <ExpressionInput
              value={value.key || ''}
              onChange={handleKeyChange}
              onBlur={onBlur}
              placeholder={keyPlaceholder}
              disabled={disabled}
              error={false}
              nodeId={nodeId}
              singleLine={true}
              hideHelperText={true}
            />
          </div>

          <div className="h-6 w-px bg-border shrink-0" />

          {/* Value Field */}
          <div className="flex-1 relative [&_textarea]:border-0 [&_textarea]:focus-visible:ring-0 [&_textarea]:focus-visible:ring-offset-0 [&_textarea]:rounded-none [&>div]:space-y-0 [&>div]:overflow-visible">
            <ExpressionInput
              value={value.value || ''}
              onChange={handleValueChange}
              onBlur={onBlur}
              placeholder={valuePlaceholder}
              disabled={disabled}
              error={false}
              nodeId={nodeId}
              singleLine={true}
              hideHelperText={true}
            />
          </div>
        </div>
      </div>
      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}
    </div>
  )
}
