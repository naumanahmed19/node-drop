import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { FieldRenderer } from './FieldRenderer'
import { FormFieldConfig } from './types'

interface CollectionFieldProps {
  displayName: string
  fields: FormFieldConfig[]
  value: Record<string, any>
  onChange: (value: Record<string, any>) => void
  disabled?: boolean
  placeholder?: string
  allValues: Record<string, any>
  allFields: FormFieldConfig[]
  onFieldChange?: (fieldName: string, value: any) => void
  nodeId?: string
  nodeType?: string
}

/**
 * CollectionField - Renders a collapsible section with nested fields
 * Used for "collection" type without multipleValues (single object with multiple properties)
 */
export function CollectionField({
  displayName,
  fields,
  value = {},
  onChange,
  disabled,
  placeholder = 'Add Option',
  allValues,
  allFields,
  onFieldChange,
  nodeId,
  nodeType,
}: CollectionFieldProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(
    new Set(Object.keys(value).filter(key => value[key] !== undefined && value[key] !== ''))
  )

  // Get available options (fields that haven't been added yet)
  const availableOptions = fields.filter(field => !selectedOptions.has(field.name))

  const handleAddOption = (fieldName: string) => {
    const field = fields.find(f => f.name === fieldName)
    if (!field) return

    // Add to selected options
    setSelectedOptions(prev => new Set([...prev, fieldName]))

    // Initialize with default value
    const newValue = {
      ...value,
      [fieldName]: field.default ?? ''
    }
    onChange(newValue)

    // Expand the section
    setIsExpanded(true)
  }

  const handleRemoveOption = (fieldName: string) => {
    // Remove from selected options
    setSelectedOptions(prev => {
      const newSet = new Set(prev)
      newSet.delete(fieldName)
      return newSet
    })

    // Remove from value
    const newValue = { ...value }
    delete newValue[fieldName]
    onChange(newValue)
  }

  const handleFieldChange = (fieldName: string, fieldValue: any) => {
    const newValue = {
      ...value,
      [fieldName]: fieldValue
    }
    onChange(newValue)
  }

  const selectedFields = fields.filter(field => selectedOptions.has(field.name))

  return (
    <div className="space-y-3">
      {/* Header with expand/collapse */}
      {selectedFields.length > 0 && (
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 p-2 rounded-md transition-colors border border-border"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {displayName} ({selectedFields.length})
          </span>
        </div>
      )}

      {/* Selected fields */}
      {isExpanded && selectedFields.length > 0 && (
        <div className="space-y-3">
          {selectedFields.map(field => (
            <div key={field.name} className="space-y-2 p-3 border border-border rounded-md bg-background">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {field.displayName}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveOption(field.name)}
                  disabled={disabled}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </Button>
              </div>
              <FieldRenderer
                field={field}
                value={value[field.name]}
                onChange={(newValue) => handleFieldChange(field.name, newValue)}
                disabled={disabled}
                allValues={allValues}
                allFields={allFields}
                onFieldChange={onFieldChange}
                nodeId={nodeId}
                nodeType={nodeType}
              />
              {field.description && (
                <p className="text-sm text-muted-foreground">{field.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add option button */}
      {availableOptions.length > 0 && (
        <Select
          value=""
          onValueChange={(value) => {
            if (value) {
              handleAddOption(value)
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-full bg-primary text-primary-foreground hover:bg-primary/90 [&>svg]:text-primary-foreground">
            <div className="flex items-center gap-2 text-primary-foreground">
              <Plus className="h-4 w-4" />
              <SelectValue placeholder={placeholder} />
            </div>
          </SelectTrigger>
          <SelectContent>
            {availableOptions.map(field => (
              <SelectItem key={field.name} value={field.name}>
                <div className="flex flex-col">
                  <span className="font-medium">{field.displayName}</span>
                  {field.description && (
                    <span className="text-xs text-muted-foreground">
                      {field.description}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Show message when all options are selected */}
      {availableOptions.length === 0 && selectedFields.length === fields.length && (
        <p className="text-xs text-muted-foreground italic">
          All options have been added
        </p>
      )}
    </div>
  )
}
