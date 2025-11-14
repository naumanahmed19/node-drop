import { Textarea } from '@/components/ui/textarea'
import type { QuickAction } from '@/data/quickActions'
import { quickActions, searchQuickActions } from '@/data/quickActions'
import { cn } from '@/lib/utils'
import { variableService } from '@/services'
import { useWorkflowStore } from '@/stores'
import type { Variable } from '@/types/variable'
import { validateExpression, type ValidationResult } from '@/utils/expressionValidator'
import { fuzzyFilter } from '@/utils/fuzzySearch'
import { AlertCircle, Code2, Type } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AutocompleteItem } from './ExpressionAutocomplete'
import { ExpressionAutocomplete, defaultAutocompleteItems } from './ExpressionAutocomplete'
import { ExpressionBackgroundHighlight } from './ExpressionBackgroundHighlight'
import { ExpressionPreview } from './ExpressionPreview'
import { QuickActionsMenu } from './QuickActionsMenu'

interface ExpressionInputProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  error?: boolean
  nodeId?: string // Optional: node ID to fetch input data from connected nodes
  className?: string // Optional: additional CSS classes
  singleLine?: boolean // Optional: disable auto-expanding and keep single line
  hideHelperText?: boolean // Optional: hide the helper text below the input
}

export function ExpressionInput({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  error,
  nodeId,
  className,
  singleLine = false,
  hideHelperText = false,
}: ExpressionInputProps) {
  // Determine initial mode: if value contains {{...}}, start in expression mode
  const hasExpression = typeof value === 'string' && value.includes('{{')
  const [mode, setMode] = useState<'fixed' | 'expression'>(
    hasExpression ? 'expression' : 'fixed'
  )
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 })
  const [filteredItems, setFilteredItems] = useState<AutocompleteItem[]>([])
  const [selectedItemIndex, setSelectedItemIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [autoHeight, setAutoHeight] = useState<number | undefined>(undefined)
  const [variables, setVariables] = useState<Variable[]>([])
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: [], warnings: [] })

  // Quick Actions Menu state
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [quickActionsQuery, setQuickActionsQuery] = useState('')
  const [quickActionsPosition, setQuickActionsPosition] = useState({ top: 0, left: 0 })
  const [selectedActionIndex, setSelectedActionIndex] = useState(0)

  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  // Use textarea for auto-expanding input unless singleLine is true
  const isMultiline = !singleLine

  // Fetch variables on mount
  useEffect(() => {
    const fetchVariables = async () => {
      try {
        const fetchedVariables = await variableService.getVariables()
        setVariables(fetchedVariables)
      } catch (error) {
        console.error('Error fetching variables:', error)
      }
    }
    fetchVariables()
  }, [])

  // Validate expression syntax when value changes in expression mode
  useEffect(() => {
    if (mode === 'expression' && value) {
      const result = validateExpression(value)
      setValidation(result)
    } else {
      setValidation({ isValid: true, errors: [], warnings: [] })
    }
  }, [value, mode])

  // Extract available fields from input data with node information
  const extractFieldsFromData = (nodeId: string | undefined): AutocompleteItem[] => {
    const fields: AutocompleteItem[] = []

    if (!nodeId) return fields

    try {
      const { workflow } = workflowStore
      if (!workflow) return fields

      // Find all connections where the current node is the target
      const inputConnections = workflow.connections.filter(
        (conn) => conn.targetNodeId === nodeId
      )

      if (inputConnections.length === 0) return fields

      // Determine if we have multiple inputs (array access needed)
      const hasMultipleInputs = inputConnections.length > 1

      // Process each connected source node
      inputConnections.forEach((connection, connectionIndex) => {
        const sourceNodeId = connection.sourceNodeId

        // Get the source node to get its name
        const sourceNode = workflow.nodes.find(n => n.id === sourceNodeId)
        if (!sourceNode) return

        const nodeName = sourceNode.name
        const categoryName = `${nodeName} (input ${connectionIndex})`

        // Track fields per node to avoid duplicates within the same node
        const seenFieldsForNode = new Set<string>()

        // Get execution result for this source node
        const sourceNodeResult = workflowStore.getNodeExecutionResult(sourceNodeId)

        if (!sourceNodeResult?.data) return

        // Extract data structure
        let sourceData: any[] = []
        if (sourceNodeResult.data.main && Array.isArray(sourceNodeResult.data.main)) {
          sourceData = sourceNodeResult.data.main
        } else if (sourceNodeResult.status === 'skipped') {
          sourceData = [{ json: sourceNodeResult.data }]
        }

        if (sourceData.length === 0) return

        // Extract all items from this source node
        const allItems: any[] = sourceData
          .map((item: any) => {
            if (item && item.json) {
              return item.json
            } else if (item) {
              return item
            }
            return null
          })
          .filter((item: any) => item !== null)

        if (allItems.length === 0) return

        // Determine the base path for this input
        // If multiple inputs: json[0], json[1], etc.
        // If single input: json
        const basePath = hasMultipleInputs ? `json[${connectionIndex}]` : 'json'

        // Extract field names recursively from all items of this node
        const extractFields = (obj: any, path: string, depth = 0, sampleValue?: any) => {
          if (depth > 3 || !obj || typeof obj !== 'object') return

          Object.keys(obj).forEach(key => {
            const value = sampleValue?.[key] ?? obj[key]
            const fieldPath = `${path}.${key}`
            const fieldValue = fieldPath // Raw value without {{}}

            // Add the field itself if not already added for this node
            if (!seenFieldsForNode.has(fieldValue)) {
              seenFieldsForNode.add(fieldValue)

              // Create a preview of the value for better context
              let valuePreview = ''
              if (value !== null && value !== undefined) {
                if (typeof value === 'string') {
                  valuePreview = value.length > 30 ? `"${value.substring(0, 30)}..."` : `"${value}"`
                } else if (typeof value === 'number' || typeof value === 'boolean') {
                  valuePreview = String(value)
                } else if (Array.isArray(value)) {
                  valuePreview = `array[${value.length}]`
                } else if (typeof value === 'object') {
                  valuePreview = 'object'
                }
              }

              fields.push({
                type: 'property',
                label: key,
                value: fieldValue,
                description: valuePreview ? `${valuePreview}` : `Type: ${Array.isArray(value) ? 'array' : typeof value}`,
                category: categoryName,
              })
            }

            // If value is an object, add nested fields (limited depth)
            if (value && typeof value === 'object' && !Array.isArray(value) && depth < 2) {
              extractFields(value, fieldPath, depth + 1, value)
            }

            // If value is an array with objects, show array accessor patterns
            if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
              const arrayAccessor = `${fieldPath}[0]` // Raw value without {{}}
              if (!seenFieldsForNode.has(arrayAccessor)) {
                seenFieldsForNode.add(arrayAccessor)
                fields.push({
                  type: 'property',
                  label: `${key}[0] (first item)`,
                  value: arrayAccessor,
                  description: 'Access first array element',
                  category: categoryName,
                })
              }

              // Add nested fields of first array item
              if (depth < 2) {
                Object.keys(value[0]).forEach(nestedKey => {
                  const nestedAccessor = `${fieldPath}[0].${nestedKey}` // Raw value without {{}}
                  if (!seenFieldsForNode.has(nestedAccessor)) {
                    seenFieldsForNode.add(nestedAccessor)
                    fields.push({
                      type: 'property',
                      label: `${key}[0].${nestedKey}`,
                      value: nestedAccessor,
                      description: `Access ${nestedKey} in first array item`,
                      category: categoryName,
                    })
                  }
                })
              }
            }
          })
        }

        // Use the first item as a sample to extract field structure
        if (allItems.length > 0) {
          extractFields(allItems[0], basePath, 0, allItems[0])
        }
      })
    } catch (error) {
      console.error('Error extracting fields from input data:', error)
    }

    return fields
  }

  // Get input data from workflow store if nodeId is provided
  const workflowStore = useWorkflowStore()

  // Convert variables to autocomplete items
  const getVariableAutocompleteItems = (): AutocompleteItem[] => {
    const items: AutocompleteItem[] = []

    // Add $vars and $local base items
    items.push({
      type: 'variable',
      label: 'Global Variables',
      value: '$vars',
      description: 'Access global variables',
      category: 'Variables',
    })
    items.push({
      type: 'variable',
      label: 'Local Variables',
      value: '$local',
      description: 'Access workflow-local variables',
      category: 'Variables',
    })

    // Group variables by scope
    const globalVars = variables.filter(v => v.scope === 'GLOBAL')
    const localVars = variables.filter(v => v.scope === 'LOCAL')

    // Add global variables
    globalVars.forEach(variable => {
      items.push({
        type: 'variable',
        label: variable.key,
        value: `$vars.${variable.key}`,
        description: variable.description || `Global: ${variable.value.substring(0, 50)}${variable.value.length > 50 ? '...' : ''}`,
        category: 'Variables (Global)',
      })
    })

    // Add local variables
    localVars.forEach(variable => {
      items.push({
        type: 'variable',
        label: variable.key,
        value: `$local.${variable.key}`,
        description: variable.description || `Local: ${variable.value.substring(0, 50)}${variable.value.length > 50 ? '...' : ''}`,
        category: 'Variables (Local)',
      })
    })

    return items
  }

  // Generate dynamic autocomplete items based on available input data
  const dynamicAutocompleteItems = useMemo(() => {
    // Extract fields from connected nodes (categorized by node name)
    const inputFields = extractFieldsFromData(nodeId)

    // Get variable items
    const variableItems = getVariableAutocompleteItems()

    // Combine all items: variables first, then input fields, then default items
    return [...variableItems, ...inputFields, ...defaultAutocompleteItems]
  }, [nodeId, workflowStore, variables])

  // Detect when to show autocomplete
  useEffect(() => {
    if (mode !== 'expression' || !value) {
      setShowAutocomplete(false)
      return
    }

    const textBeforeCursor = value.substring(0, cursorPosition)

    // Check if user typed {{ or $ for variables
    const lastOpenBraces = textBeforeCursor.lastIndexOf('{{')
    const lastCloseBraces = textBeforeCursor.lastIndexOf('}}')
    const lastDollarSign = textBeforeCursor.lastIndexOf('$')

    let shouldShowAutocomplete = false
    let searchText = ''
    let contextPath = '' // The field path for method completion (e.g., "json.title")

    // Show autocomplete if inside {{ }}
    if (lastOpenBraces > lastCloseBraces) {
      const expressionContent = textBeforeCursor.substring(lastOpenBraces + 2)
      searchText = expressionContent.toLowerCase()

      // Check if user is trying to access methods on a field (e.g., "json.title.")
      // Pattern: word characters, dots, and array accessors, ending with a dot
      const methodAccessPattern = /^([\w$]+(?:\.[\w]+|\[\d+\])*)\.\s*(\w*)$/
      const methodMatch = expressionContent.match(methodAccessPattern)

      if (methodMatch) {
        // User is typing methods/properties on a field
        contextPath = methodMatch[1] // e.g., "json.title" or "json.items[0]"
        searchText = methodMatch[2].toLowerCase() // What they're typing after the dot
        shouldShowAutocomplete = true
      } else {
        // Regular autocomplete (field names, variables, etc.)
        shouldShowAutocomplete = true
      }
    }
    // Show autocomplete if user typed $ for variables (and not inside completed expression)
    else if (lastDollarSign !== -1 && lastDollarSign > lastCloseBraces) {
      // Check if there's a space after the last word boundary (indicating start of new expression)
      const textBeforeDollar = textBeforeCursor.substring(0, lastDollarSign)
      const lastSpace = textBeforeDollar.lastIndexOf(' ')
      const lastNewline = textBeforeDollar.lastIndexOf('\n')
      const lastBoundary = Math.max(lastSpace, lastNewline, -1)

      // Only show if $ is at start or after whitespace, and no {{ before it
      if (lastBoundary === lastDollarSign - 1 || lastDollarSign === 0 ||
        (lastOpenBraces === -1 || lastOpenBraces < lastBoundary)) {
        searchText = textBeforeCursor.substring(lastDollarSign).toLowerCase()
        shouldShowAutocomplete = true
      }
    }

    if (shouldShowAutocomplete) {
      let itemsToFilter = dynamicAutocompleteItems

      // If we're in method completion context, filter and adapt the items
      if (contextPath) {
        // Get method/property suggestions
        itemsToFilter = dynamicAutocompleteItems
          .filter(item => {
            // Show string methods for any field access
            if (item.category === 'String Functions') return true
            // Show array methods for array accessors
            if (item.category === 'Array Functions' && contextPath.includes('[')) return true
            // Show math methods if it might be numeric
            if (item.category === 'Math Functions') return true
            return false
          })
          .map(item => {
            // Replace the placeholder "json.field" with the actual field path
            const adaptedValue = item.value.replace(/json\.field|json\.array|json\.value/g, contextPath)
            return {
              ...item,
              value: adaptedValue,
              // Show just the method name in the label for clarity
              label: item.label,
            }
          })
      }

      // Use fuzzy search for better autocomplete matching
      const filtered = fuzzyFilter(
        itemsToFilter,
        searchText,
        (item) => [item.label, item.value, item.description || '']
      )

      setFilteredItems(filtered)
      setSelectedItemIndex(0)

      if (filtered.length > 0) {
        // Calculate position for autocomplete dropdown
        updateAutocompletePosition()
        setShowAutocomplete(true)
      } else {
        setShowAutocomplete(false)
      }
    } else {
      setShowAutocomplete(false)
    }
  }, [value, cursorPosition, mode, dynamicAutocompleteItems])

  // Detect slash commands for Quick Actions Menu
  useEffect(() => {
    if (mode !== 'expression' || !value || showAutocomplete) {
      setShowQuickActions(false)
      return
    }

    const textBeforeCursor = value.substring(0, cursorPosition)

    // Find the last / that could be a command trigger
    const lastSlash = textBeforeCursor.lastIndexOf('/')

    if (lastSlash === -1) {
      setShowQuickActions(false)
      return
    }

    // Check if the / is inside {{ }} or after {{
    const lastOpenBraces = textBeforeCursor.lastIndexOf('{{')
    const lastCloseBraces = textBeforeCursor.lastIndexOf('}}')

    // Only show quick actions if we're inside {{ }} or at the start of an expression
    const isInsideExpression = lastOpenBraces > lastCloseBraces
    const textFromSlash = textBeforeCursor.substring(lastSlash + 1)

    // Check if there are any spaces or special characters after / (would indicate it's not a command)
    const hasInvalidChars = /[\s{}]/.test(textFromSlash)

    if (isInsideExpression && !hasInvalidChars) {
      // Extract the query (text after /)
      setQuickActionsQuery(textFromSlash)
      setSelectedActionIndex(0)

      // Calculate position
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect()
        setQuickActionsPosition({
          top: rect.height + 4,
          left: 0,
        })
      }

      setShowQuickActions(true)
    } else {
      setShowQuickActions(false)
    }
  }, [value, cursorPosition, mode, showAutocomplete])

  // Update autocomplete position
  const updateAutocompletePosition = () => {
    if (!inputRef.current) return

    const rect = inputRef.current.getBoundingClientRect()

    setAutocompletePosition({
      top: rect.height + 4,
      left: 0,
    })
  }

  // Handle keyboard navigation in autocomplete and quick actions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Space or Cmd+Space to manually trigger autocomplete
    if (e.key === ' ' && (e.ctrlKey || e.metaKey) && mode === 'expression') {
      e.preventDefault()

      // Get all items without filtering
      setFilteredItems(dynamicAutocompleteItems)
      setSelectedItemIndex(0)
      updateAutocompletePosition()
      setShowAutocomplete(true)
      return
    }

    // Handle quick actions keyboard events when quick actions menu is visible
    if (showQuickActions) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedActionIndex(prev => prev + 1) // Menu component handles limit
          return
        case 'ArrowUp':
          e.preventDefault()
          setSelectedActionIndex(prev => Math.max(0, prev - 1))
          return
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          // Get the selected action from the search results or top-level actions
          const actions = quickActionsQuery
            ? searchQuickActions(quickActionsQuery).slice(0, 10)
            : quickActions
          const selectedAction = actions[selectedActionIndex]
          if (selectedAction) {
            handleQuickActionSelect(selectedAction)
          }
          return
        case 'Escape':
          e.preventDefault()
          setShowQuickActions(false)
          return
      }
    }

    // Only handle autocomplete keyboard events when autocomplete is visible
    if (showAutocomplete) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedItemIndex(prev =>
            prev < filteredItems.length - 1 ? prev + 1 : prev
          )
          return
        case 'ArrowUp':
          e.preventDefault()
          setSelectedItemIndex(prev => prev > 0 ? prev - 1 : 0)
          return
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          if (filteredItems[selectedItemIndex]) {
            insertAutocompleteItem(filteredItems[selectedItemIndex])
          }
          return
        case 'Escape':
          e.preventDefault()
          setShowAutocomplete(false)
          return
      }
    }

    // Trigger autocomplete when user types {{
    if (e.key === '{' && mode === 'expression') {
      const textBeforeCursor = value.substring(0, cursorPosition)
      if (textBeforeCursor.endsWith('{')) {
        setTimeout(() => {
          const newCursor = cursorPosition + 1
          setCursorPosition(newCursor)
        }, 0)
      }
    }
  }

  // Insert selected autocomplete item
  const insertAutocompleteItem = (item: AutocompleteItem) => {
    const textBeforeCursor = value.substring(0, cursorPosition)
    const textAfterCursor = value.substring(cursorPosition)

    // Find the {{ before cursor or $ sign
    const lastOpenBraces = textBeforeCursor.lastIndexOf('{{')
    const lastCloseBraces = textBeforeCursor.lastIndexOf('}}')
    const lastDollarSign = textBeforeCursor.lastIndexOf('$')

    // Determine insertion strategy
    let newValue: string
    let newCursorPos: number

    // If we're inside {{, just insert the raw value (no wrapping)
    if (lastOpenBraces !== -1 && lastOpenBraces > lastCloseBraces) {
      const expressionContent = textBeforeCursor.substring(lastOpenBraces + 2)

      // Check if we're in method completion context (e.g., "json.title." with cursor after dot)
      // Pattern: word characters, dots, and array accessors, ending with a dot
      const methodAccessPattern = /^([\w$]+(?:\.[\w]+|\[\d+\])*)\.\s*(\w*)$/
      const methodMatch = expressionContent.match(methodAccessPattern)

      if (methodMatch && (item.category === 'String Functions' || item.category === 'Array Functions' || item.category === 'Math Functions')) {
        // We're completing a method on a field path
        // The item.value already has the full path with method (e.g., "json.title.toUpperCase()")
        // So we replace from {{ onwards
        newValue =
          value.substring(0, lastOpenBraces + 2) +
          item.value +
          textAfterCursor
        newCursorPos = lastOpenBraces + 2 + item.value.length
      }
      // Check if we're completing a partial variable name (e.g., {{$vars.api}} or {{$vars.}})
      else if (item.type === 'variable') {
        // Find where to replace from (either from $vars. or $local.)
        const textInsideBraces = textBeforeCursor.substring(lastOpenBraces + 2)
        const lastVarPrefix = Math.max(
          textInsideBraces.lastIndexOf('$vars.'),
          textInsideBraces.lastIndexOf('$local.')
        )

        if (lastVarPrefix !== -1) {
          // Replace from the $vars. or $local. position
          const replaceFrom = lastOpenBraces + 2 + lastVarPrefix
          newValue =
            value.substring(0, replaceFrom) +
            item.value +
            textAfterCursor
          newCursorPos = replaceFrom + item.value.length
        } else {
          // No prefix found, just insert the value
          newValue =
            value.substring(0, lastOpenBraces + 2) +
            item.value +
            textAfterCursor
          newCursorPos = lastOpenBraces + 2 + item.value.length
        }
      } else {
        // For non-variables (fields, functions), replace from {{ onwards
        newValue =
          value.substring(0, lastOpenBraces + 2) +
          item.value +
          textAfterCursor
        newCursorPos = lastOpenBraces + 2 + item.value.length
      }
    }
    // If user typed $ (not inside {{), just replace from $ onwards (no wrapping)
    else if (lastDollarSign !== -1 && lastDollarSign > lastCloseBraces && item.type === 'variable') {
      newValue =
        value.substring(0, lastDollarSign) +
        item.value +
        textAfterCursor
      newCursorPos = lastDollarSign + item.value.length
    }
    // Otherwise, just insert the raw value (no wrapping)
    else {
      newValue = textBeforeCursor + item.value + textAfterCursor
      newCursorPos = textBeforeCursor.length + item.value.length
    }

    onChange(newValue)
    setShowAutocomplete(false)

    // Set cursor position after inserted value
    setTimeout(() => {
      setCursorPosition(newCursorPos)
      if (inputRef.current) {
        if ('setSelectionRange' in inputRef.current) {
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
        }
        inputRef.current.focus()
      }
    }, 0)
  }

  // Handle quick action selection
  const handleQuickActionSelect = (action: QuickAction) => {
    console.log('[QuickAction] Selected:', action.trigger, action.insert)

    // If action has no insert template (e.g., category), do nothing
    if (!action.insert) {
      console.log('[QuickAction] No insert template, skipping')
      return
    }

    const textBeforeCursor = value.substring(0, cursorPosition)
    const textAfterCursor = value.substring(cursorPosition)

    console.log('[QuickAction] Text before cursor:', textBeforeCursor)
    console.log('[QuickAction] Cursor position:', cursorPosition)

    // Find the / before cursor
    const lastSlash = textBeforeCursor.lastIndexOf('/')

    console.log('[QuickAction] Last slash position:', lastSlash)

    if (lastSlash === -1) {
      console.log('[QuickAction] No slash found, skipping')
      return
    }

    // Replace from / onwards with the action's insert template
    const newValue =
      value.substring(0, lastSlash) +
      action.insert +
      textAfterCursor

    console.log('[QuickAction] New value:', newValue)

    // Calculate new cursor position
    // If there are placeholders, position cursor at first placeholder
    let newCursorPos: number
    if (action.placeholders && action.placeholders.length > 0) {
      // Find the first placeholder in the inserted text
      const firstPlaceholder = action.placeholders[0]
      const placeholderStart = action.insert.indexOf(firstPlaceholder)
      if (placeholderStart !== -1) {
        newCursorPos = lastSlash + placeholderStart

        console.log('[QuickAction] First placeholder:', firstPlaceholder, 'at position:', newCursorPos)

        // Select the placeholder text for easy replacement
        onChange(newValue)
        setShowQuickActions(false)

        setTimeout(() => {
          if (inputRef.current && 'setSelectionRange' in inputRef.current) {
            const selectionStart = newCursorPos
            const selectionEnd = newCursorPos + firstPlaceholder.length
            inputRef.current.setSelectionRange(selectionStart, selectionEnd)
            inputRef.current.focus()
          }
        }, 0)
        return
      }
    }

    // No placeholders, just position cursor at end of inserted text
    newCursorPos = lastSlash + action.insert.length

    console.log('[QuickAction] No placeholders, cursor at:', newCursorPos)

    onChange(newValue)
    setShowQuickActions(false)

    setTimeout(() => {
      setCursorPosition(newCursorPos)
      if (inputRef.current && 'setSelectionRange' in inputRef.current) {
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
        inputRef.current.focus()
      }
    }, 0)
  }

  // Handle input change
  const handleInputChange = (newValue: string) => {
    onChange(newValue)

    // Update cursor position
    if (inputRef.current) {
      const element = inputRef.current as HTMLTextAreaElement | HTMLInputElement
      setTimeout(() => {
        setCursorPosition(element.selectionStart || 0)
      }, 0)
    }
  }

  // Auto-resize textarea based on content (up to 120px)
  useEffect(() => {
    if (inputRef.current && isMultiline) {
      const element = inputRef.current as HTMLTextAreaElement
      // Reset height to auto to get the correct scrollHeight
      element.style.height = 'auto'
      // Calculate new height (minimum 40px for single line, maximum 120px)
      const newHeight = Math.min(Math.max(element.scrollHeight, 40), 120)
      setAutoHeight(newHeight)
      element.style.height = `${newHeight}px`
    }
  }, [value, isMultiline])

  // Handle click to update cursor position and check for autocomplete
  const handleClick = () => {
    if (inputRef.current) {
      const element = inputRef.current as HTMLTextAreaElement | HTMLInputElement
      const newCursorPos = element.selectionStart || 0
      setCursorPosition(newCursorPos)

      // Check if cursor is inside an expression and show autocomplete
      if (mode === 'expression' && value) {
        const textBeforeCursor = value.substring(0, newCursorPos)
        const lastOpenBraces = textBeforeCursor.lastIndexOf('{{')
        const lastCloseBraces = textBeforeCursor.lastIndexOf('}}')

        // If cursor is inside {{ }}, show autocomplete
        if (lastOpenBraces > lastCloseBraces) {
          const searchText = textBeforeCursor.substring(lastOpenBraces + 2).toLowerCase()

          // Use fuzzy search for filtering
          const filtered = fuzzyFilter(
            dynamicAutocompleteItems,
            searchText,
            (item) => [item.label, item.value, item.description || '']
          )

          setFilteredItems(filtered)
          setSelectedItemIndex(0)

          if (filtered.length > 0) {
            updateAutocompletePosition()
            setShowAutocomplete(true)
          }
        }
      }
    }
  }

  const toggleMode = (newMode: 'fixed' | 'expression') => {
    setMode(newMode)
    setShowAutocomplete(false)
  }

  const inputClassName = cn(
    error ? 'border-destructive' : '',
    mode === 'expression' ? 'font-mono text-sm' : '',
    className
  )

  return (
    <div className="space-y-2">
      {/* Input Field with inline toggle button */}
      <div className="relative">
        <div className="relative bg-background">
          {/* Background highlighting overlay - behind the text */}
          {mode === 'expression' && value && value.includes('{{') && (
            <ExpressionBackgroundHighlight value={value} className="font-mono text-sm" />
          )}

          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value || ''}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={handleKeyDown}
            onClick={handleClick}
            placeholder={
              mode === 'expression'
                ? placeholder || 'Type {{ to see available variables and functions...'
                : placeholder
            }
            disabled={disabled}
            rows={1}
            style={{
              minHeight: singleLine ? '40px' : '40px',
              maxHeight: singleLine ? '40px' : '120px',
              overflow: singleLine ? 'hidden' : (autoHeight && autoHeight >= 120 ? 'auto' : 'hidden'),
              resize: 'none',
              background: 'transparent',
              position: 'relative',
              zIndex: 1,
              paddingRight: '40px' // Make room for the button
            }}
            className={inputClassName}
          />

          {/* Mode Toggle Button - Positioned inside input on the right */}
          <button
            type="button"
            onClick={() => toggleMode(mode === 'expression' ? 'fixed' : 'expression')}
            disabled={disabled}
            style={{ zIndex: 10 }}
            className={cn(
              'absolute right-2 top-2 flex items-center justify-center p-1 rounded transition-colors',
              mode === 'expression'
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
              disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
            )}
            title={mode === 'expression' ? 'Switch to Fixed mode' : 'Switch to Expression mode'}
          >
            {mode === 'expression' ? (
              <Code2 className="h-3.5 w-3.5" />
            ) : (
              <Type className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        <ExpressionAutocomplete
          visible={showAutocomplete}
          items={filteredItems}
          position={autocompletePosition}
          selectedIndex={selectedItemIndex}
          onSelect={insertAutocompleteItem}
          onClose={() => setShowAutocomplete(false)}
        />

        {/* Quick Actions Menu */}
        <QuickActionsMenu
          visible={showQuickActions}
          query={quickActionsQuery}
          position={quickActionsPosition}
          selectedIndex={selectedActionIndex}
          onSelect={handleQuickActionSelect}
          onClose={() => setShowQuickActions(false)}
        />
      </div>

      {/* Helper Text */}
      {mode === 'expression' && !hideHelperText && (
        <div className="mt-1 text-xs text-muted-foreground">
          Use <code className="px-1 py-0.5 bg-muted rounded">$local</code> or{' '}
          <code className="px-1 py-0.5 bg-muted rounded">$vars</code> for variables,{' '}
          <code className="px-1 py-0.5 bg-muted rounded">&#123;&#123;&#125;&#125;</code> for expressions.
          Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Space</kbd> or type{' '}
          <code className="px-1 py-0.5 bg-muted rounded">&#123;&#123;</code> for suggestions,{' '}
          <code className="px-1 py-0.5 bg-muted rounded">/</code> for quick actions
        </div>
      )}

      {/* Validation Errors */}
      {mode === 'expression' && !validation.isValid && validation.errors.length > 0 && (
        <div className="mt-2 space-y-1">
          {validation.errors.map((error, index) => (
            <div key={index} className="flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{error.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Validation Warnings */}
      {mode === 'expression' && validation.warnings.length > 0 && (
        <div className="mt-2 space-y-1">
          {validation.warnings.map((warning, index) => (
            <div key={index} className="flex items-start gap-2 text-xs text-yellow-600 dark:text-yellow-500">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expression Preview */}
      {mode === 'expression' && <ExpressionPreview value={value} nodeId={nodeId} />}
    </div>
  )
}
