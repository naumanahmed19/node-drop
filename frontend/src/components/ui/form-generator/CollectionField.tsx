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
    <div className="w-full space-y-2.5">
      {/* Unified Collection Card */}
      <div className="rounded-md border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            {selectedFields.length > 0 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                disabled={disabled}
                className="p-0 hover:bg-accent/50 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            )}
            <span className="text-xs font-semibold">
              {displayName}
              {selectedFields.length > 0 && (
                <span className="text-muted-foreground ml-1">({selectedFields.length})</span>
              )}
            </span>
          </div>

          {/* Add option selector in header */}
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
              <SelectTrigger className="w-auto h-6 text-[11px] gap-1 px-2">
                <Plus className="h-3 w-3" />
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.map(field => (
                  <SelectItem key={field.name} value={field.name}>
                    <div className="flex flex-col">
                      <span className="font-medium text-xs">{field.displayName}</span>
                      {field.description && (
                        <span className="text-[10px] text-muted-foreground">
                          {field.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Content */}
        {selectedFields.length > 0 && (
          <div className="p-3 space-y-2.5">
            {/* Selected fields */}
            {isExpanded && (
              <div className="space-y-2.5">
                {selectedFields.map(field => (
                  <div key={field.name} className="space-y-1.5 p-2.5 border border-border rounded-md bg-muted/20">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium">
                        {field.displayName}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(field.name)}
                        disabled={disabled}
                        className="h-5 px-2 text-[10px] text-muted-foreground hover:text-destructive"
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
                      <p className="text-[10px] text-muted-foreground">{field.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Show message when all options are selected */}
            {availableOptions.length === 0 && selectedFields.length === fields.length && (
              <p className="text-[10px] text-muted-foreground italic">
                All options have been added
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
