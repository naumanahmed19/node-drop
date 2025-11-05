import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ExpressionInput } from './ExpressionInput'

export interface ConditionRowValue {
  key: string
  expression: string
  value: string
}

export interface ConditionRowProps {
  value: ConditionRowValue
  onChange: (value: ConditionRowValue) => void
  onBlur?: () => void
  disabled?: boolean
  error?: string
  nodeId?: string
  expressionOptions?: Array<{ name: string; value: string }>
  expressionPlaceholder?: string
  keyPlaceholder?: string
  valuePlaceholder?: string
}

export function ConditionRow({
  value = { key: '', expression: '', value: '' },
  onChange,
  onBlur,
  disabled = false,
  error,
  nodeId,
  expressionOptions = [
    { name: 'Equal', value: 'equal' },
    { name: 'Not Equal', value: 'notEqual' },
    { name: 'Larger', value: 'larger' },
    { name: 'Larger Equal', value: 'largerEqual' },
    { name: 'Smaller', value: 'smaller' },
    { name: 'Smaller Equal', value: 'smallerEqual' },
    { name: 'Contains', value: 'contains' },
    { name: 'Not Contains', value: 'notContains' },
    { name: 'Starts With', value: 'startsWith' },
    { name: 'Ends With', value: 'endsWith' },
    { name: 'Is Empty', value: 'isEmpty' },
    { name: 'Is Not Empty', value: 'isNotEmpty' },
    { name: 'Regex', value: 'regex' },
  ],
  expressionPlaceholder = 'Select condition',
  keyPlaceholder = 'Field',
  valuePlaceholder = 'Value',
}: ConditionRowProps) {
  const handleKeyChange = (newKey: string) => {
    onChange({ ...value, key: newKey })
  }

  const handleExpressionChange = (newExpression: string) => {
    onChange({ ...value, expression: newExpression })
  }

  const handleValueChange = (newValue: string) => {
    onChange({ ...value, value: newValue })
  }

  // Check if value field should be hidden (for isEmpty/isNotEmpty operations)
  const shouldHideValue = value.expression === 'isEmpty' || value.expression === 'isNotEmpty'

  return (
    <div className="space-y-2">
      <div className={cn(
        'flex flex-col border rounded-md bg-background  focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 isolate',
        error && 'border-destructive'
      )}>
        {/* Key Field */}
        <div className="relative [&_textarea]:border-0 [&_textarea]:focus-visible:ring-0 [&_textarea]:focus-visible:ring-offset-0 [&_textarea]:rounded-none [&>div]:space-y-0 [&>div]:overflow-visible [&>div>div[class*='absolute']]:z-[100]">
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

        <div className="h-px bg-border" />

        {/* Expression/Operation Dropdown */}
        <Select
          value={value.expression || ''}
          onValueChange={handleExpressionChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full border-0 focus:ring-0 focus:ring-offset-0 rounded-none">
            <SelectValue placeholder={expressionPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {expressionOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value Field - Hidden for isEmpty/isNotEmpty */}
        {!shouldHideValue && (
          <>
            <div className="h-px bg-border" />
            <div className="relative [&_textarea]:border-0 [&_textarea]:focus-visible:ring-0 [&_textarea]:focus-visible:ring-offset-0 [&_textarea]:rounded-none [&>div]:space-y-0 [&>div]:overflow-visible [&>div>div[class*='absolute']]:z-[100]">
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
          </>
        )}
      </div>
      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}
    </div>
  )
}
