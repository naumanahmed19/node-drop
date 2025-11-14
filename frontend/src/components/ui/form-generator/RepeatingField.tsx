import { Button } from '@/components/ui/button'
import { Copy, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { FormGenerator } from './FormGenerator'
import { FormFieldConfig } from './types'

export interface RepeatingFieldItem {
  id: string
  values: Record<string, any>
}

export interface RepeatingFieldProps {
  /**
   * Display name for the repeating field group
   */
  displayName: string

  /**
   * Field configuration for each item in the repeating group
   */
  fields: FormFieldConfig[]

  /**
   * Current values - array of objects
   */
  value: RepeatingFieldItem[]

  /**
   * Change handler
   */
  onChange: (value: RepeatingFieldItem[]) => void

  /**
   * Minimum number of items (default: 0)
   */
  minItems?: number

  /**
   * Maximum number of items (default: unlimited)
   */
  maxItems?: number

  /**
   * Text for the "Add" button (default: "Add Item")
   */
  addButtonText?: string

  /**
   * Field name to use as the item title (e.g., "name", "label")
   * If specified, the value of this field will be shown instead of "Item 1", "Item 2"
   */
  titleField?: string

  /**
   * Whether to show drag handle for reordering (default: true)
   */
  allowReorder?: boolean

  /**
   * Whether to show duplicate button (default: true)
   */
  allowDuplicate?: boolean

  /**
   * Whether to show delete button (default: true)
   */
  allowDelete?: boolean

  /**
   * Default values for new items
   */
  defaultItemValues?: Record<string, any>

  /**
   * Custom item header renderer
   */
  itemHeaderRenderer?: (item: RepeatingFieldItem, index: number) => React.ReactNode

  /**
   * Validation errors for specific items and fields
   */
  errors?: Record<string, Record<string, string>> // { [itemId]: { [fieldName]: errorMessage } }

  /**
   * Whether the field is disabled
   */
  disabled?: boolean

  /**
   * Custom CSS class for the container
   */
  className?: string

  /**
   * Show item numbers (default: true)
   */
  showItemNumbers?: boolean

  /**
   * Collapsed by default (default: false)
   */
  collapsedByDefault?: boolean

  /**
   * Compact mode - no collapse/expand, always show fields inline (default: false)
   */
  compact?: boolean

  /**
   * Optional: node ID for dynamic field suggestions in ExpressionInput
   */
  nodeId?: string

  /**
   * Optional: node type for loadOptions API calls
   */
  nodeType?: string
}

export function RepeatingField({
  displayName,
  fields,
  value = [],
  onChange,
  minItems = 0,
  maxItems,
  addButtonText = 'Add Item',
  titleField,
  allowReorder = true,
  allowDuplicate = true,
  allowDelete = true,
  defaultItemValues = {},
  itemHeaderRenderer,
  errors = {},
  disabled = false,
  className = '',
  showItemNumbers = true,
  collapsedByDefault = false,
  compact = false,
  nodeId,
  nodeType,
}: RepeatingFieldProps) {
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(
    collapsedByDefault ? new Set(value.map((item) => item.id)) : new Set()
  )
  const [draggedItem, setDraggedItem] = useState<string | null>(null)

  // Generate unique ID
  const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  // Get item title
  const getItemTitle = (item: RepeatingFieldItem, index: number): string => {
    if (titleField && item.values[titleField]) {
      const titleValue = item.values[titleField]
      // Handle different types of values
      if (typeof titleValue === 'string' && titleValue.trim()) {
        return titleValue.trim()
      }
      if (typeof titleValue === 'number') {
        return String(titleValue)
      }
    }
    // Fallback to default title
    return `Item ${index + 1}`
  }

  // Add new item
  const handleAdd = () => {
    if (maxItems && value.length >= maxItems) return

    const newItem: RepeatingFieldItem = {
      id: generateId(),
      values: { ...defaultItemValues },
    }

    onChange([...value, newItem])
  }

  // Delete item
  const handleDelete = (itemId: string) => {
    if (value.length <= minItems) return
    onChange(value.filter((item) => item.id !== itemId))
  }

  // Duplicate item
  const handleDuplicate = (item: RepeatingFieldItem) => {
    if (maxItems && value.length >= maxItems) return

    const duplicatedItem: RepeatingFieldItem = {
      id: generateId(),
      values: { ...item.values },
    }

    const index = value.findIndex((i) => i.id === item.id)
    const newValue = [...value]
    newValue.splice(index + 1, 0, duplicatedItem)
    onChange(newValue)
  }

  // Update item field value
  const handleFieldChange = (itemId: string, fieldName: string, fieldValue: any) => {
    const newValue = value.map((item) =>
      item.id === itemId
        ? { ...item, values: { ...item.values, [fieldName]: fieldValue } }
        : item
    )
    onChange(newValue)
  }

  // Toggle collapse
  const toggleCollapse = (itemId: string) => {
    const newCollapsed = new Set(collapsedItems)
    if (newCollapsed.has(itemId)) {
      newCollapsed.delete(itemId)
    } else {
      newCollapsed.add(itemId)
    }
    setCollapsedItems(newCollapsed)
  }

  // Drag and drop handlers
  const handleDragStart = (itemId: string) => {
    setDraggedItem(itemId)
  }

  const handleDragOver = (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault()
    if (!draggedItem || draggedItem === targetItemId) return

    const draggedIndex = value.findIndex((item) => item.id === draggedItem)
    const targetIndex = value.findIndex((item) => item.id === targetItemId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newValue = [...value]
    const [removed] = newValue.splice(draggedIndex, 1)
    newValue.splice(targetIndex, 0, removed)

    onChange(newValue)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  const canAdd = !maxItems || value.length < maxItems
  const canDelete = allowDelete && value.length > minItems

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{displayName}</label>
        {canAdd && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            disabled={disabled}
            className="h-7 px-2 text-xs hover:bg-gray-100"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            {addButtonText}
          </Button>
        )}
      </div>

      {/* Items List */}
      {value.length === 0 ? (
        <div className="text-xs text-gray-500 py-2">
          No items added yet.
        </div>
      ) : compact ? (
        // Compact mode - no collapse, inline display, no container
        <div className="space-y-2">
          {value.map((item) => {
            const itemErrors = errors[item.id] || {}

            return (
              <div key={item.id} className="flex gap-2 items-start">
                <div className="flex-1">
                  <FormGenerator
                    fields={fields}
                    values={item.values}
                    errors={itemErrors}
                    onChange={(fieldName, fieldValue) =>
                      handleFieldChange(item.id, fieldName, fieldValue)
                    }
                    disabled={disabled}
                    disableAutoValidation={true}
                    showRequiredIndicator={true}
                    nodeId={nodeId}
                    nodeType={nodeType}
                  />
                </div>
                <div className="flex items-start gap-1 pt-2">
                  {/* Duplicate */}
                  {allowDuplicate && !disabled && canAdd && (
                    <button
                      type="button"
                      onClick={() => handleDuplicate(item)}
                      className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Duplicate"
                      aria-label="Duplicate item"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {/* Delete */}
                  {canDelete && !disabled && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                      aria-label="Delete item"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {value.map((item, index) => {
            const isCollapsed = collapsedItems.has(item.id)
            const itemErrors = errors[item.id] || {}
            const hasErrors = Object.keys(itemErrors).length > 0

            return (
              <div
                key={item.id}
                className={`relative bg-white border rounded ${
                  draggedItem === item.id ? 'opacity-50' : ''
                } ${
                  hasErrors ? 'border-red-300' : 'border-gray-200'
                }`}
                draggable={allowReorder && !disabled}
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={(e: React.DragEvent) => handleDragOver(e, item.id)}
                onDragEnd={handleDragEnd}
              >
                {/* Header Row */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  {/* Item Label */}
                  <div
                    className="flex-1 cursor-pointer select-none"
                    onClick={() => toggleCollapse(item.id)}
                  >
                    {itemHeaderRenderer ? (
                      itemHeaderRenderer(item, index)
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {showItemNumbers && (
                          <span className="text-xs font-medium text-gray-500">
                            {index + 1}.
                          </span>
                        )}
                        <span className="text-xs font-medium text-gray-700">
                          {getItemTitle(item, index)}
                        </span>
                        {hasErrors && (
                          <span className="text-xs text-red-500">
                            ({Object.keys(itemErrors).length} error
                            {Object.keys(itemErrors).length > 1 ? 's' : ''})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-0.5">
                    {/* Collapse/Expand */}
                    <button
                      type="button"
                      onClick={() => toggleCollapse(item.id)}
                      className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                      <span className="text-xs">{isCollapsed ? '▼' : '▲'}</span>
                    </button>

                    {/* Duplicate */}
                    {allowDuplicate && !disabled && canAdd && (
                      <button
                        type="button"
                        onClick={() => handleDuplicate(item)}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Duplicate"
                        aria-label="Duplicate item"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete */}
                    {canDelete && !disabled && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                        aria-label="Delete item"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Fields */}
                {!isCollapsed && (
                  <div className="p-3">
                    <FormGenerator
                      fields={fields}
                      values={item.values}
                      errors={itemErrors}
                      onChange={(fieldName, fieldValue) =>
                        handleFieldChange(item.id, fieldName, fieldValue)
                      }
                      disabled={disabled}
                      disableAutoValidation={true}
                      showRequiredIndicator={true}
                      nodeId={nodeId}
                      nodeType={nodeType}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Info text */}
      {(minItems > 0 || maxItems) && (
        <p className="text-xs text-gray-500 mt-1">
          {minItems > 0 && `Min: ${minItems}`}
          {minItems > 0 && maxItems && ' • '}
          {maxItems && `Max: ${maxItems}`}
        </p>
      )}
    </div>
  )
}
