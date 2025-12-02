import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { variableService } from '@/services'
import { useWorkflowStore } from '@/stores'
import type { Variable } from '@/types/variable'
import { validateExpression } from '@/utils/expressionValidator'
import { fuzzyFilter } from '@/utils/fuzzySearch'
import {
    AlertCircle,
    Code2,
    Eye,
    Sparkles,
    Type
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ExpressionFieldProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  error?: boolean
  nodeId?: string
  className?: string
  singleLine?: boolean
  hideHelperText?: boolean
}

interface AutocompleteItem {
  type: 'variable' | 'function' | 'property' | 'method' | 'constant'
  label: string
  value: string
  description?: string
  category?: string
  icon?: React.ReactNode
  insertText?: string // What to insert when selected (if different from value)
}

interface ExpressionPreviewData {
  resolved: any
  error?: string
  type?: string
}

// ============================================================================
// Autocomplete Data
// ============================================================================

const FUNCTION_ITEMS: AutocompleteItem[] = [
  // String Functions
  {
    type: 'method',
    label: 'toUpperCase()',
    value: 'toUpperCase()',
    description: 'Convert string to uppercase',
    category: 'String',
  },
  {
    type: 'method',
    label: 'toLowerCase()',
    value: 'toLowerCase()',
    description: 'Convert string to lowercase',
    category: 'String',
  },
  {
    type: 'method',
    label: 'trim()',
    value: 'trim()',
    description: 'Remove whitespace from both ends',
    category: 'String',
  },
  {
    type: 'method',
    label: 'split(separator)',
    value: 'split("")',
    insertText: 'split("")',
    description: 'Split string into array',
    category: 'String',
  },
  {
    type: 'method',
    label: 'replace(search, replace)',
    value: 'replace("", "")',
    insertText: 'replace("", "")',
    description: 'Replace text in string',
    category: 'String',
  },
  {
    type: 'method',
    label: 'substring(start, end)',
    value: 'substring(0, 0)',
    insertText: 'substring(0, 0)',
    description: 'Extract part of string',
    category: 'String',
  },
  {
    type: 'method',
    label: 'includes(search)',
    value: 'includes("")',
    insertText: 'includes("")',
    description: 'Check if string contains text',
    category: 'String',
  },
  {
    type: 'method',
    label: 'startsWith(search)',
    value: 'startsWith("")',
    insertText: 'startsWith("")',
    description: 'Check if string starts with text',
    category: 'String',
  },
  {
    type: 'method',
    label: 'endsWith(search)',
    value: 'endsWith("")',
    insertText: 'endsWith("")',
    description: 'Check if string ends with text',
    category: 'String',
  },
  // Array Functions
  {
    type: 'method',
    label: 'length',
    value: 'length',
    description: 'Get array/string length',
    category: 'Array',
  },
  {
    type: 'method',
    label: 'join(separator)',
    value: 'join(", ")',
    insertText: 'join(", ")',
    description: 'Join array elements into string',
    category: 'Array',
  },
  {
    type: 'method',
    label: 'map(fn)',
    value: 'map(item => item)',
    insertText: 'map(item => item)',
    description: 'Transform each array element',
    category: 'Array',
  },
  {
    type: 'method',
    label: 'filter(fn)',
    value: 'filter(item => item)',
    insertText: 'filter(item => item)',
    description: 'Filter array elements',
    category: 'Array',
  },
  {
    type: 'method',
    label: 'find(fn)',
    value: 'find(item => item)',
    insertText: 'find(item => item)',
    description: 'Find first matching element',
    category: 'Array',
  },
  {
    type: 'method',
    label: 'slice(start, end)',
    value: 'slice(0, 0)',
    insertText: 'slice(0, 0)',
    description: 'Extract portion of array',
    category: 'Array',
  },
  {
    type: 'method',
    label: 'reverse()',
    value: 'reverse()',
    description: 'Reverse array order',
    category: 'Array',
  },
  {
    type: 'method',
    label: 'sort()',
    value: 'sort()',
    description: 'Sort array elements',
    category: 'Array',
  },
  // Math Functions
  {
    type: 'function',
    label: 'Math.round()',
    value: 'Math.round()',
    insertText: 'Math.round()',
    description: 'Round to nearest integer',
    category: 'Math',
  },
  {
    type: 'function',
    label: 'Math.floor()',
    value: 'Math.floor()',
    insertText: 'Math.floor()',
    description: 'Round down to integer',
    category: 'Math',
  },
  {
    type: 'function',
    label: 'Math.ceil()',
    value: 'Math.ceil()',
    insertText: 'Math.ceil()',
    description: 'Round up to integer',
    category: 'Math',
  },
  {
    type: 'function',
    label: 'Math.abs()',
    value: 'Math.abs()',
    insertText: 'Math.abs()',
    description: 'Get absolute value',
    category: 'Math',
  },
  {
    type: 'function',
    label: 'Math.max()',
    value: 'Math.max()',
    insertText: 'Math.max()',
    description: 'Get maximum value',
    category: 'Math',
  },
  {
    type: 'function',
    label: 'Math.min()',
    value: 'Math.min()',
    insertText: 'Math.min()',
    description: 'Get minimum value',
    category: 'Math',
  },
  {
    type: 'function',
    label: 'Math.random()',
    value: 'Math.random()',
    description: 'Generate random number (0-1)',
    category: 'Math',
  },
  // Date Functions
  {
    type: 'function',
    label: 'new Date()',
    value: 'new Date()',
    description: 'Create new date object',
    category: 'Date',
  },
  {
    type: 'function',
    label: 'Date.now()',
    value: 'Date.now()',
    description: 'Get current timestamp',
    category: 'Date',
  },
  // Object Functions
  {
    type: 'function',
    label: 'Object.keys()',
    value: 'Object.keys()',
    insertText: 'Object.keys()',
    description: 'Get object keys as array',
    category: 'Object',
  },
  {
    type: 'function',
    label: 'Object.values()',
    value: 'Object.values()',
    insertText: 'Object.values()',
    description: 'Get object values as array',
    category: 'Object',
  },
  {
    type: 'function',
    label: 'Object.entries()',
    value: 'Object.entries()',
    insertText: 'Object.entries()',
    description: 'Get object entries as array',
    category: 'Object',
  },
  // JSON Functions
  {
    type: 'function',
    label: 'JSON.parse()',
    value: 'JSON.parse()',
    insertText: 'JSON.parse()',
    description: 'Parse JSON string',
    category: 'JSON',
  },
  {
    type: 'function',
    label: 'JSON.stringify()',
    value: 'JSON.stringify()',
    insertText: 'JSON.stringify()',
    description: 'Convert to JSON string',
    category: 'JSON',
  },
]

// ============================================================================
// Main Component
// ============================================================================

export function ExpressionField({
  value,
  onChange,
  onBlur,
  placeholder = 'Enter value or expression...',
  disabled = false,
  error = false,
  nodeId,
  className,
  singleLine = false,
  hideHelperText = false,
}: ExpressionFieldProps) {
  // ============================================================================
  // State
  // ============================================================================
  
  const [mode, setMode] = useState<'fixed' | 'expression'>(
    value?.includes('{{') ? 'expression' : 'fixed'
  )
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [variables, setVariables] = useState<Variable[]>([])
  const [preview, setPreview] = useState<ExpressionPreviewData | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autocompleteRef = useRef<HTMLDivElement>(null)
  const workflowStore = useWorkflowStore()

  // ============================================================================
  // Load Variables
  // ============================================================================

  useEffect(() => {
    const fetchVariables = async () => {
      try {
        const vars = await variableService.getVariables()
        setVariables(vars)
      } catch (error) {
        console.error('Failed to fetch variables:', error)
      }
    }
    fetchVariables()
  }, [])

  // ============================================================================
  // Extract Input Data Fields
  // ============================================================================

  const inputDataFields = useMemo(() => {
    const fields: AutocompleteItem[] = []

    if (!nodeId || !workflowStore.workflow) return fields

    try {
      const { workflow } = workflowStore
      const inputConnections = workflow.connections.filter(
        (conn) => conn.targetNodeId === nodeId
      )

      inputConnections.forEach((connection, index) => {
        const sourceNode = workflow.nodes.find((n) => n.id === connection.sourceNodeId)
        if (!sourceNode) return

        const nodeResult = workflowStore.getNodeExecutionResult(connection.sourceNodeId)
        if (!nodeResult?.data) return

        let sourceData: any[] = []
        if (nodeResult.data.main && Array.isArray(nodeResult.data.main)) {
          sourceData = nodeResult.data.main
        }

        if (sourceData.length === 0) return

        const basePath = inputConnections.length > 1 ? `json[${index}]` : 'json'
        const categoryName = `${sourceNode.name}`

        const extractFields = (obj: any, path: string, depth = 0) => {
          if (depth > 2 || !obj || typeof obj !== 'object') return

          Object.keys(obj).forEach((key) => {
            const fieldPath = `${path}.${key}`
            const fieldValue = obj[key]

            let valuePreview = ''
            if (fieldValue !== null && fieldValue !== undefined) {
              if (typeof fieldValue === 'string') {
                valuePreview = fieldValue.length > 30 
                  ? `"${fieldValue.substring(0, 30)}..."` 
                  : `"${fieldValue}"`
              } else if (typeof fieldValue === 'number' || typeof fieldValue === 'boolean') {
                valuePreview = String(fieldValue)
              } else if (Array.isArray(fieldValue)) {
                valuePreview = `array[${fieldValue.length}]`
              } else if (typeof fieldValue === 'object') {
                valuePreview = 'object'
              }
            }

            fields.push({
              type: 'property',
              label: key,
              value: fieldPath,
              description: valuePreview || `Type: ${typeof fieldValue}`,
              category: categoryName,
            })

            if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue) && depth < 2) {
              extractFields(fieldValue, fieldPath, depth + 1)
            }
          })
        }

        const firstItem = sourceData[0]?.json || sourceData[0]
        if (firstItem) {
          extractFields(firstItem, basePath, 0)
        }
      })
    } catch (error) {
      console.error('Error extracting input fields:', error)
    }

    return fields
  }, [nodeId, workflowStore])

  // ============================================================================
  // Variable Items
  // ============================================================================

  const variableItems = useMemo(() => {
    const items: AutocompleteItem[] = []

    items.push({
      type: 'variable',
      label: '$vars',
      value: '$vars',
      description: 'Global variables',
      category: 'Variables',
    })

    items.push({
      type: 'variable',
      label: '$local',
      value: '$local',
      description: 'Local workflow variables',
      category: 'Variables',
    })

    variables
      .filter((v) => v.scope === 'GLOBAL')
      .forEach((variable) => {
        items.push({
          type: 'variable',
          label: variable.key,
          value: `$vars.${variable.key}`,
          description: variable.description || `Global: ${String(variable.value).substring(0, 50)}`,
          category: 'Global Variables',
        })
      })

    variables
      .filter((v) => v.scope === 'LOCAL')
      .forEach((variable) => {
        items.push({
          type: 'variable',
          label: variable.key,
          value: `$local.${variable.key}`,
          description: variable.description || `Local: ${String(variable.value).substring(0, 50)}`,
          category: 'Local Variables',
        })
      })

    return items
  }, [variables])

  // ============================================================================
  // All Autocomplete Items
  // ============================================================================

  const allAutocompleteItems = useMemo(() => {
    return [...variableItems, ...inputDataFields, ...FUNCTION_ITEMS]
  }, [variableItems, inputDataFields])

  // ============================================================================
  // Auto-resize Textarea
  // ============================================================================

  useEffect(() => {
    if (textareaRef.current && !singleLine) {
      const textarea = textareaRef.current
      textarea.style.height = 'auto'
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 200)
      textarea.style.height = `${newHeight}px`
    }
  }, [value, singleLine])

  // ============================================================================
  // Autocomplete Logic
  // ============================================================================

  const updateAutocomplete = useCallback(() => {
    if (mode !== 'expression' || !value) {
      setShowAutocomplete(false)
      return
    }

    const textBeforeCursor = value.substring(0, cursorPosition)
    const lastOpenBraces = textBeforeCursor.lastIndexOf('{{')
    const lastCloseBraces = textBeforeCursor.lastIndexOf('}}')

    // Check if we're inside {{ }}
    if (lastOpenBraces > lastCloseBraces) {
      const expressionContent = textBeforeCursor.substring(lastOpenBraces + 2)
      
      // Check for method completion (e.g., "json.title.")
      const methodPattern = /^([\w$]+(?:\.[\w]+|\[\d+\])*)\.\s*(\w*)$/
      const methodMatch = expressionContent.match(methodPattern)

      let itemsToShow: AutocompleteItem[] = []
      let searchText = ''

      if (methodMatch) {
        // Show methods for the field
        searchText = methodMatch[2].toLowerCase()
        itemsToShow = FUNCTION_ITEMS.filter((item) => item.type === 'method')
      } else {
        // Show all items
        searchText = expressionContent.toLowerCase()
        itemsToShow = allAutocompleteItems
      }

      const filtered = fuzzyFilter(
        itemsToShow,
        searchText,
        (item) => [item.label, item.value, item.description || '']
      )

      if (filtered.length > 0) {
        setAutocompleteItems(filtered.slice(0, 10))
        setSelectedIndex(0)
        setShowAutocomplete(true)
      } else {
        setShowAutocomplete(false)
      }
    } else {
      setShowAutocomplete(false)
    }
  }, [mode, value, cursorPosition, allAutocompleteItems])

  useEffect(() => {
    updateAutocomplete()
  }, [updateAutocomplete])

  // ============================================================================
  // Expression Preview - Resolve Expression
  // ============================================================================

  const resolveExpression = useCallback((expression: string): any => {
    try {
      // Handle built-in expressions
      if (expression === '$now') {
        return new Date().toISOString()
      }
      
      if (expression === '$today') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return today.toISOString()
      }
      
      // Handle $now with methods
      if (expression.startsWith('$now.')) {
        const methodMatch = expression.match(/^\$now\.(\w+)\(([^)]*)\)$/)
        if (methodMatch) {
          const method = methodMatch[1]
          const args = methodMatch[2]
          
          if (method === 'format') {
            const format = args.replace(/['"]/g, '')
            const now = new Date()
            
            let formatted = format
              .replace('YYYY', now.getFullYear().toString())
              .replace('MM', String(now.getMonth() + 1).padStart(2, '0'))
              .replace('DD', String(now.getDate()).padStart(2, '0'))
              .replace('HH', String(now.getHours()).padStart(2, '0'))
              .replace('mm', String(now.getMinutes()).padStart(2, '0'))
              .replace('ss', String(now.getSeconds()).padStart(2, '0'))
            
            return formatted
          }
        }
        
        return new Date().toISOString()
      }
      
      // Handle variable expressions
      const varsMatch = expression.match(/^\$vars\.(.+)$/)
      const localMatch = expression.match(/^\$local\.(.+)$/)
      
      if (varsMatch) {
        const varKey = varsMatch[1]
        const variable = variables.find(v => v.key === varKey && v.scope === 'GLOBAL')
        if (variable) {
          return variable.value
        }
        return `[Variable not found: $vars.${varKey}]`
      }
      
      if (localMatch) {
        const varKey = localMatch[1]
        const variable = variables.find(v => v.key === varKey && v.scope === 'LOCAL')
        if (variable) {
          return variable.value
        }
        return `[Variable not found: $local.${varKey}]`
      }

      // Handle json.* expressions from connected nodes
      if (!nodeId || !workflowStore.workflow) {
        return expression
      }

      const { workflow } = workflowStore
      const inputConnections = workflow.connections.filter(
        (conn) => conn.targetNodeId === nodeId
      )

      if (inputConnections.length === 0) {
        return '[No input data available]'
      }

      // Get data from first connected node
      const connection = inputConnections[0]
      const sourceNodeResult = workflowStore.getNodeExecutionResult(connection.sourceNodeId)
      
      if (!sourceNodeResult?.data) {
        return '[No data from input]'
      }

      let sourceData: any[] = []
      if (sourceNodeResult.data.main && Array.isArray(sourceNodeResult.data.main)) {
        sourceData = sourceNodeResult.data.main
      }

      if (sourceData.length === 0) {
        return '[No data from input]'
      }

      const firstItem = sourceData[0]?.json || sourceData[0]
      
      if (!firstItem) {
        return '[No data from input]'
      }

      // Handle json.field expressions
      if (expression.startsWith('json.')) {
        const fieldPath = expression.substring(5) // Remove 'json.'
        const value = fieldPath.split('.').reduce((obj, key) => obj?.[key], firstItem)
        return value !== undefined ? value : `[Field not found: ${expression}]`
      }

      return expression
    } catch (error) {
      return `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
    }
  }, [nodeId, variables, workflowStore])

  // ============================================================================
  // Expression Preview
  // ============================================================================

  useEffect(() => {
    if (mode === 'expression' && value && value.includes('{{')) {
      try {
        const validation = validateExpression(value)
        if (validation.isValid) {
          // Extract expressions from {{ }}
          const expressionMatches = value.matchAll(/\{\{(.+?)\}\}/g)
          let resolvedValue = value
          
          for (const match of expressionMatches) {
            const expr = match[1].trim()
            const resolved = resolveExpression(expr)
            resolvedValue = resolvedValue.replace(match[0], String(resolved))
          }
          
          setPreview({
            resolved: resolvedValue,
            type: typeof resolvedValue,
          })
        } else {
          setPreview({
            resolved: null,
            error: validation.errors[0]?.message || 'Invalid expression',
          })
        }
      } catch (error) {
        setPreview({
          resolved: null,
          error: 'Failed to evaluate expression',
        })
      }
    } else {
      setPreview(null)
    }
  }, [mode, value, resolveExpression])

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    setCursorPosition(e.target.selectionStart || 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, autocompleteItems.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          insertAutocompleteItem(autocompleteItems[selectedIndex])
          break
        case 'Escape':
          e.preventDefault()
          setShowAutocomplete(false)
          break
      }
    } else if (e.key === ' ' && (e.ctrlKey || e.metaKey)) {
      // Ctrl/Cmd + Space to trigger autocomplete
      e.preventDefault()
      setAutocompleteItems(allAutocompleteItems.slice(0, 10))
      setSelectedIndex(0)
      setShowAutocomplete(true)
    }
  }

  const insertAutocompleteItem = (item: AutocompleteItem) => {
    const textBeforeCursor = value.substring(0, cursorPosition)
    const textAfterCursor = value.substring(cursorPosition)
    const lastOpenBraces = textBeforeCursor.lastIndexOf('{{')

    const insertValue = item.insertText || item.value
    const newValue = value.substring(0, lastOpenBraces + 2) + insertValue + textAfterCursor
    const newCursorPos = lastOpenBraces + 2 + insertValue.length

    onChange(newValue)
    setShowAutocomplete(false)

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        textareaRef.current.focus()
      }
    }, 0)
  }

  const handleModeToggle = (newMode: 'fixed' | 'expression') => {
    setMode(newMode)
    setShowAutocomplete(false)
    
    if (newMode === 'expression' && !value.includes('{{')) {
      onChange(`{{ ${value} }}`)
      setTimeout(() => {
        if (textareaRef.current) {
          const newPos = value.length + 3
          textareaRef.current.setSelectionRange(newPos, newPos)
          textareaRef.current.focus()
        }
      }, 0)
    } else if (newMode === 'fixed' && value.includes('{{')) {
      // Extract content from {{ }}
      const match = value.match(/\{\{(.+?)\}\}/)
      if (match) {
        onChange(match[1].trim())
      }
    }
  }

  const handleClick = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart || 0)
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className={cn('relative w-full', className)}>
      {/* Mode Toggle */}
      <div className="flex items-center gap-1 mb-1.5">
        <div className="inline-flex items-center rounded-md bg-muted p-0.5">
          <Button
            type="button"
            variant={mode === 'fixed' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleModeToggle('fixed')}
            disabled={disabled}
            className={cn(
              'h-5 px-1.5 text-[10px] font-medium transition-all',
              mode === 'fixed' && 'bg-background shadow-sm'
            )}
          >
            <Type className="w-2.5 h-2.5 mr-0.5" />
            Fixed
          </Button>
          <Button
            type="button"
            variant={mode === 'expression' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleModeToggle('expression')}
            disabled={disabled}
            className={cn(
              'h-5 px-1.5 text-[10px] font-medium transition-all',
              mode === 'expression' && 'bg-background shadow-sm'
            )}
          >
            <Code2 className="w-2.5 h-2.5 mr-0.5" />
            Expr
          </Button>
        </div>

        {mode === 'expression' && preview && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="h-5 px-1.5 text-[10px]"
          >
            <Eye className="w-2.5 h-2.5 mr-0.5" />
            {showPreview ? 'Hide' : 'Show'}
          </Button>
        )}
      </div>

      {/* Input Container */}
      <div
        className={cn(
          'relative rounded-lg border bg-background transition-all',
          isFocused && 'ring-2 ring-ring ring-offset-2',
          error && 'border-destructive',
          disabled && 'opacity-50 cursor-not-allowed',
          mode === 'expression' && 'border-blue-500/50 bg-blue-50/5'
        )}
      >
        {/* Expression Badge */}
        {mode === 'expression' && (
          <div className="absolute top-2 right-2 z-10">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
              <Sparkles className="w-3 h-3" />
              Expression
            </div>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false)
            onBlur?.()
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={singleLine ? 1 : undefined}
          className={cn(
            'w-full px-3 py-2 bg-transparent resize-none outline-none',
            'font-mono text-sm',
            mode === 'expression' && 'pr-24',
            singleLine && 'overflow-hidden'
          )}
          style={{
            minHeight: singleLine ? '40px' : '60px',
            maxHeight: singleLine ? '40px' : '200px',
          }}
        />

        {/* Autocomplete Dropdown */}
        {showAutocomplete && (
          <div
            ref={autocompleteRef}
            className="absolute left-0 right-0 top-full mt-1 z-50 max-h-64 overflow-auto rounded-lg border bg-popover shadow-lg"
          >
            {autocompleteItems.map((item, index) => (
              <button
                key={`${item.value}-${index}`}
                type="button"
                onClick={() => insertAutocompleteItem(item)}
                className={cn(
                  'w-full px-3 py-2 text-left transition-colors',
                  'hover:bg-accent',
                  index === selectedIndex && 'bg-accent'
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium truncate">
                        {item.label}
                      </span>
                      {item.category && (
                        <span className="text-xs text-muted-foreground">
                          {item.category}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className={cn(
                    'px-1.5 py-0.5 rounded text-xs font-medium',
                    item.type === 'variable' && 'bg-purple-500/10 text-purple-600',
                    item.type === 'function' && 'bg-blue-500/10 text-blue-600',
                    item.type === 'property' && 'bg-green-500/10 text-green-600',
                    item.type === 'method' && 'bg-orange-500/10 text-orange-600',
                  )}>
                    {item.type}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preview Panel */}
      {mode === 'expression' && showPreview && preview && (
        <div className="mt-2 rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Expression Preview
            </span>
          </div>
          {preview.error ? (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{preview.error}</span>
            </div>
          ) : (
            <div className="font-mono text-sm">
              <span className="text-muted-foreground">Result: </span>
              <span className="text-foreground">
                {typeof preview.resolved === 'object'
                  ? JSON.stringify(preview.resolved, null, 2)
                  : String(preview.resolved)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Helper Text */}
      {!hideHelperText && mode === 'expression' && (
        <p className="mt-2 text-xs text-muted-foreground">
          Use <code className="px-1 py-0.5 rounded bg-muted">{'{{ }}'}</code> for expressions.
          Press <code className="px-1 py-0.5 rounded bg-muted">Ctrl+Space</code> for suggestions.
        </p>
      )}
    </div>
  )
}
