"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Braces, Maximize2, ChevronDown, X, ChevronsUpDown, Type } from "lucide-react"
import { cn } from "@/lib/utils"
import { evaluateExpression } from "./expression-evaluator"
import { ExpressionEditor } from "./index"
import { ExpressionInput } from "./expression-input"
import { ResultPreview } from "./result-preview"
import { AutocompleteDropdown } from "./autocomplete-dropdown"
import { renderHighlightedText } from "./utils"
import type { VariableCategory, AutocompleteItem } from "./types"
import { inferTypeFromPath, getPropertiesFromPath } from "./expression-utils"

interface SelectOption {
  label: string
  value: string
}

interface MiniExpressionEditorProps {
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  mockData?: Record<string, unknown>
  variableCategories?: VariableCategory[]
  label?: string
  error?: string
  className?: string
  fieldType?: "input" | "select"
  options?: SelectOption[]
  nodeId?: string
  id?: string
  name?: string
}

const defaultMockData = {
  $json: [
    [
      {
        id: 1,
        name: "Item 1",
        title: "First Item",
        userId: 100,
        body: "This is the body of item 1",
      },
      {
        id: 2,
        name: "Item 2",
        title: "Second Item",
        userId: 101,
        body: "This is the body of item 2",
      },
    ],
    [
      {
        id: 3,
        name: "Item 3",
        title: "Third Item",
        userId: 102,
        body: "This is the body of item 3",
      },
    ],
  ],
  $now: new Date().toISOString(),
  $today: new Date().toISOString().split("T")[0],
  $node: {} as Record<string, unknown>, // Node outputs for $node["NodeName"].field expressions
}

const stringMethods: AutocompleteItem[] = [
  { label: ".toUpperCase()", type: "method", description: "Convert to uppercase", insertText: ".toUpperCase()" },
  { label: ".toLowerCase()", type: "method", description: "Convert to lowercase", insertText: ".toLowerCase()" },
  { label: ".trim()", type: "method", description: "Remove whitespace", insertText: ".trim()" },
  { label: ".length", type: "property", description: "String length", insertText: ".length" },
  { label: ".split()", type: "method", description: "Split into array", insertText: ".split()" },
  { label: ".slice()", type: "method", description: "Extract portion", insertText: ".slice()" },
  { label: ".replace()", type: "method", description: "Replace text", insertText: ".replace()" },
  { label: ".substring()", type: "method", description: "Extract substring", insertText: ".substring()" },
  { label: ".charAt()", type: "method", description: "Get character at index", insertText: ".charAt()" },
  { label: ".includes()", type: "method", description: "Check if contains", insertText: ".includes()" },
  { label: ".startsWith()", type: "method", description: "Check if starts with", insertText: ".startsWith()" },
  { label: ".endsWith()", type: "method", description: "Check if ends with", insertText: ".endsWith()" },
  { label: ".padStart()", type: "method", description: "Pad start of string", insertText: ".padStart()" },
  { label: ".padEnd()", type: "method", description: "Pad end of string", insertText: ".padEnd()" },
  { label: ".repeat()", type: "method", description: "Repeat string", insertText: ".repeat()" },
]

const arrayMethods: AutocompleteItem[] = [
  { label: ".length", type: "property", description: "Array length", insertText: ".length" },
  { label: ".join()", type: "method", description: "Join to string", insertText: ".join()" },
  { label: ".map()", type: "method", description: "Transform items", insertText: ".map()" },
  { label: ".filter()", type: "method", description: "Filter items", insertText: ".filter()" },
  { label: ".find()", type: "method", description: "Find item", insertText: ".find()" },
  { label: ".findIndex()", type: "method", description: "Find item index", insertText: ".findIndex()" },
  { label: ".includes()", type: "method", description: "Check if includes", insertText: ".includes()" },
  { label: ".indexOf()", type: "method", description: "Get index of item", insertText: ".indexOf()" },
  { label: ".reduce()", type: "method", description: "Reduce to value", insertText: ".reduce()" },
  { label: ".every()", type: "method", description: "Test all items", insertText: ".every()" },
  { label: ".some()", type: "method", description: "Test some items", insertText: ".some()" },
  { label: ".slice()", type: "method", description: "Extract portion", insertText: ".slice()" },
  { label: ".concat()", type: "method", description: "Merge arrays", insertText: ".concat()" },
  { label: ".flat()", type: "method", description: "Flatten array", insertText: ".flat()" },
  { label: ".reverse()", type: "method", description: "Reverse array", insertText: ".reverse()" },
  { label: ".sort()", type: "method", description: "Sort array", insertText: ".sort()" },
]

function InlineAutocompleteDropdown({
  items,
  selectedIndex,
  onSelect,
  onHover,
}: {
  items: AutocompleteItem[]
  selectedIndex: number
  onSelect: (item: AutocompleteItem) => void
  onHover: (index: number) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex]
    if (selectedItem && listRef.current) {
      const listRect = listRef.current.getBoundingClientRect()
      const itemRect = selectedItem.getBoundingClientRect()

      if (itemRect.top < listRect.top) {
        selectedItem.scrollIntoView({ block: "start" })
      } else if (itemRect.bottom > listRect.bottom) {
        selectedItem.scrollIntoView({ block: "end" })
      }
    }
  }, [selectedIndex])

  if (items.length === 0) return null

  return (
    <div className="bg-popover border border-border rounded-md shadow-lg overflow-hidden">
      <div ref={listRef} className="max-h-48 overflow-y-auto">
        {items.map((item, index) => (
          <button
            key={`${item.label}-${index}`}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onHover(index)}
            className={cn(
              "w-full px-3 py-1.5 flex items-center gap-2 text-left text-sm transition-colors",
              index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted text-foreground",
            )}
          >
            <span className="font-mono text-xs">{item.label}</span>
            {item.description && <span className="text-xs text-muted-foreground truncate ml-auto">{item.description}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

const getCollapsedResultDisplay = (value: unknown): string => {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (typeof value === "string") return value.length > 30 ? value.slice(0, 30) + "..." : value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return `Array(${value.length})`
  if (typeof value === "object") return `Object{...}`
  return String(value)
}

export function MiniExpressionEditor({
  value = "",
  onChange,
  onBlur,
  placeholder = "Enter value or {{ expression }}",
  mockData: providedMockData,
  variableCategories,
  error,
  className,
  fieldType = "input",
  options = [],
  nodeId,
  id,
  name,
}: MiniExpressionEditorProps) {
  // Use provided mock data or default
  const mockData = providedMockData || defaultMockData
  
  // Infer initial mode from value - if it contains {{ }}, start in expression mode
  const inferInitialMode = (val: string): "fixed" | "expression" => {
    return val.includes("{{") ? "expression" : "fixed"
  }
  
  const [inputMode, setInputMode] = useState<"fixed" | "expression">(() => inferInitialMode(value || ""))
  const [isExpanded, setIsExpanded] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const [result, setResult] = useState<any | null>(null)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [showSelectDropdown, setShowSelectDropdown] = useState(false)
  const [pendingCursorPosition, setPendingCursorPosition] = useState<number | null>(null)
  const [isTextareaFocused, setIsTextareaFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightInputRef = useRef<HTMLDivElement>(null)
  const expandedContainerRef = useRef<HTMLDivElement>(null)
  const selectRef = useRef<HTMLButtonElement>(null)

  const hasExpression = localValue.includes("{{")



  useEffect(() => {
    if (pendingCursorPosition !== null && isExpanded && textareaRef.current) {
      const textarea = textareaRef.current
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(pendingCursorPosition, pendingCursorPosition)
        setPendingCursorPosition(null)
      })
    }
  }, [pendingCursorPosition, isExpanded, localValue])



  const getSelectedLabel = useCallback(() => {
    if (hasExpression) {
      return localValue
    }
    const option = options.find((opt) => opt.value === localValue)
    return option?.label || localValue || placeholder
  }, [localValue, options, hasExpression, placeholder])

  const defaultCategories: VariableCategory[] = variableCategories || [
    {
      name: "Variables",
      icon: "variable",
      items: [
        { label: "$json", type: "variable", description: "Input data", insertText: "$json" },
        { label: "$json.name", type: "property", description: '"John Doe"', insertText: "$json.name" },
        { label: "$json.email", type: "property", description: '"john@example.com"', insertText: "$json.email" },
        { label: "$json.age", type: "property", description: "30", insertText: "$json.age" },
        { label: "$json.tags", type: "array", description: "Array[2]", insertText: "$json.tags" },
        { label: "$now", type: "variable", description: "Current timestamp", insertText: "$now" },
        { label: "$today", type: "variable", description: "Current date", insertText: "$today" },
      ],
    },
  ]

  // Use shared utility functions with current mockData
  const inferType = useCallback(
    (path: string): string => inferTypeFromPath(path, mockData || defaultMockData),
    [mockData]
  )

  const getProperties = useCallback(
    (path: string): AutocompleteItem[] => getPropertiesFromPath(path, mockData || defaultMockData),
    [mockData]
  )

  const updateAutocomplete = useCallback(
    (text: string, expanded: boolean) => {
      // Only show autocomplete in expression mode
      if (inputMode !== "expression") {
        setShowAutocomplete(false)
        return
      }

      const cursorPos = expanded
        ? textareaRef.current?.selectionStart || text.length
        : inputRef.current?.selectionStart || text.length

      const textBeforeCursor = text.slice(0, cursorPos)
      const expressionMatch = textBeforeCursor.match(/\{\{\s*([^}]*)$/)

      if (!expressionMatch) {
        setShowAutocomplete(false)
        return
      }

      const expressionContent = expressionMatch[1]
      const lastDotIndex = expressionContent.lastIndexOf(".")
      const endsWithDot = expressionContent.endsWith(".")

      let items: AutocompleteItem[] = []

      if (endsWithDot) {
        const context = expressionContent.slice(0, -1)
        const type = inferType(context)

        if (type === "object") {
          items = getProperties(context)
        } else if (type === "string") {
          items = stringMethods
        } else if (type === "array") {
          items = arrayMethods
        }
      } else if (lastDotIndex > -1) {
        const context = expressionContent.slice(0, lastDotIndex)
        const partial = expressionContent.slice(lastDotIndex + 1).toLowerCase()
        const type = inferType(context)

        let methodsOrProps: AutocompleteItem[] = []
        if (type === "object") {
          methodsOrProps = getProperties(context)
        } else if (type === "string") {
          methodsOrProps = stringMethods
        } else if (type === "array") {
          methodsOrProps = arrayMethods
        }

        items = methodsOrProps.filter((item) => item.label.toLowerCase().replace(/^\./, "").includes(partial))
      } else {
        const searchTerm = expressionContent.toLowerCase()
        const allItems = defaultCategories.flatMap((c) => c.items)
        items = allItems.filter(
          (item) =>
            item.label.toLowerCase().includes(searchTerm) || item.description?.toLowerCase().includes(searchTerm),
        )
      }

      if (items.length > 0) {
        setAutocompleteItems(items)
        setSelectedIndex(0)
        setShowAutocomplete(true)
      } else {
        setShowAutocomplete(false)
      }
    },
    [inferType, getProperties, defaultCategories, inputMode],
  )

  useEffect(() => {
    if (hasExpression) {
      const evalResult = evaluateExpression(localValue, mockData || defaultMockData)
      setResult(evalResult)
    } else {
      setResult(null)
    }
  }, [localValue, hasExpression, mockData])

  useEffect(() => {
    setLocalValue(value)
    // Update mode based on value content
    setInputMode(inferInitialMode(value || ""))
  }, [value])

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue)
      onChange?.(newValue)
      
      // If transitioning to expression mode, capture cursor position and switch mode
      if (!hasExpression && newValue.includes("{{") && inputMode === "fixed") {
        const cursorPos = inputRef.current?.selectionStart ?? newValue.length
        setPendingCursorPosition(cursorPos)
        setInputMode("expression")
        setIsExpanded(true)
      }
    },
    [onChange, hasExpression, inputMode],
  )

  const handleExpressionInputChange = useCallback(
    (newValue: string) => {
      handleChange(newValue)
      updateAutocomplete(newValue, isExpanded)
    },
    [handleChange, updateAutocomplete, isExpanded],
  )

  const handleCursorPositionChange = useCallback((position: { top: number; left: number }) => {
    setDropdownPosition(position)
  }, [])

  const handleAutocompleteSelect = (item: AutocompleteItem) => {
    const element = isExpanded ? textareaRef.current : inputRef.current
    if (!element) return

    const cursorPos = element.selectionStart || localValue.length
    const textBeforeCursor = localValue.slice(0, cursorPos)
    const textAfterCursor = localValue.slice(cursorPos)

    const expressionMatch = textBeforeCursor.match(/\{\{\s*([^}]*)$/)
    if (!expressionMatch) return

    const expressionStart = expressionMatch.index! + expressionMatch[0].length - expressionMatch[1].length
    const expressionContent = expressionMatch[1]
    const lastDotIndex = expressionContent.lastIndexOf(".")

    let newText: string
    let newCursorPos: number

    if (lastDotIndex > -1 && !expressionContent.endsWith(".")) {
      const beforePartial = localValue.slice(0, expressionStart + lastDotIndex + 1)
      const insertText = item.insertText.replace(/^\./, "")
      newText = beforePartial + insertText + textAfterCursor
      newCursorPos = beforePartial.length + insertText.length
    } else if (expressionContent.endsWith(".")) {
      const insertText = item.insertText.replace(/^\./, "")
      newText = textBeforeCursor + insertText + textAfterCursor
      newCursorPos = textBeforeCursor.length + insertText.length
    } else {
      const beforeExpression = localValue.slice(0, expressionStart)
      newText = beforeExpression + item.insertText + textAfterCursor
      newCursorPos = beforeExpression.length + item.insertText.length
    }

    setLocalValue(newText)
    onChange?.(newText)
    setShowAutocomplete(false)

    setTimeout(() => {
      element.focus()
      element.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleSelectOption = (option: SelectOption) => {
    setLocalValue(option.value)
    onChange?.(option.value)
    setShowSelectDropdown(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showAutocomplete) {
      if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false)
        } else if (isExpanded) {
          setIsExpanded(false)
        }
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % autocompleteItems.length)
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + autocompleteItems.length) % autocompleteItems.length)
        break
      case "Enter":
      case "Tab":
        e.preventDefault()
        handleAutocompleteSelect(autocompleteItems[selectedIndex])
        break
      case "Escape":
        setShowAutocomplete(false)
        break
    }
  }

  if (isFullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-5xl h-[90vh] bg-background rounded-lg border shadow-lg flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted">
            <span className="text-sm font-medium text-foreground">Expression Editor</span>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ExpressionEditor
              initialValue={localValue}
              mockData={mockData || defaultMockData}
              variableCategories={variableCategories}
              onChange={(newValue) => handleChange(newValue)}
              placeholder={placeholder}
              nodeId={nodeId}
            />
          </div>
        </div>
      </div>,
      document.documentElement
    )
  }

  return (
    <div className={cn("w-full space-y-1.5 relative", className)}>
      {/* Mode Toggle - Absolute positioned above the input */}
      <div className="absolute right-0 z-20" style={{ marginTop: "-32px" }}>
        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md w-fit">
          <button
            type="button"
            onClick={() => {
              setInputMode("fixed")
              setIsExpanded(false)
            }}
            className={cn(
              "h-6 px-2 text-xs font-medium rounded transition-colors",
              inputMode === "fixed" ? "bg-background shadow-sm" : "hover:bg-muted-foreground/10"
            )}
          >
            <Type className="w-3 h-3 inline" />
           
          </button>
          <button
            type="button"
            onClick={() => setInputMode("expression")}
            className={cn(
              "h-6 px-2 text-xs font-medium rounded transition-colors",
              inputMode === "expression" ? "bg-background shadow-sm" : "hover:bg-muted-foreground/10"
            )}
          >
            <Braces className="w-3 h-3 inline" />
          
          </button>
        </div>
      </div>

      <div
        className={cn(
          "relative rounded-md border bg-background transition-all duration-200",
          isExpanded && "ring-1 ring-ring",
          !isExpanded && "hover:border-muted-foreground/50",
          error && "border-destructive",
        )}
      >
        {inputMode === "fixed" ? (
          // Fixed mode - simple input or select
          <div className="relative">
            {fieldType === "select" ? (
              <>
                <button
                  ref={selectRef}
                  type="button"
                  onClick={() => setShowSelectDropdown(!showSelectDropdown)}
                  className="w-full h-9 pl-3 pr-8 text-sm text-left border-0 bg-transparent focus:outline-none flex items-center justify-between"
                >
                  <span className="truncate text-foreground">{getSelectedLabel()}</span>
                  <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>

                {showSelectDropdown && (
                  <div className="absolute z-50 w-full left-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
                    <div className="max-h-48 overflow-y-auto py-1">
                      {options.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleSelectOption(option)}
                          className={cn(
                            "w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                            localValue === option.value && "bg-accent",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <input
                ref={inputRef}
                type="text"
                value={localValue}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                className="w-full h-9 px-3 text-sm border-0 bg-transparent focus:outline-none"
              />
            )}
          </div>
        ) : (
          // Expression mode
          <>
            {!isExpanded ? (
              <div className="relative">
                <div
                  ref={highlightInputRef}
                  className="absolute inset-0 h-9 pl-3 pr-12 flex items-center text-sm font-mono overflow-hidden pointer-events-none"
                  aria-hidden="true"
                >
                  <span className="truncate">{renderHighlightedText(localValue, placeholder)}</span>
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  value={localValue}
                  onChange={(e) => handleChange(e.target.value)}
                  onFocus={() => {
                    setIsExpanded(true)
                    updateAutocomplete(localValue, false)
                  }}
                  onKeyDown={handleKeyDown}
                  onBlur={() => {
                    setTimeout(() => {
                      if (!showAutocomplete) {
                        onBlur?.()
                      }
                      setShowAutocomplete(false)
                    }, 150)
                  }}
                  placeholder=""
                  className="w-full h-9 pl-3 pr-12 text-sm font-mono border-0 bg-transparent focus:outline-none text-transparent caret-foreground"
                />

                {showAutocomplete && autocompleteItems.length > 0 && (
                  <div className="absolute z-50 w-full left-0 top-full mt-1">
                    <InlineAutocompleteDropdown
                      items={autocompleteItems}
                      selectedIndex={selectedIndex}
                      onSelect={handleAutocompleteSelect}
                      onHover={setSelectedIndex}
                    />
                  </div>
                )}

                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {hasExpression && result && (
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-xs rounded max-w-[80px] truncate",
                        result.success ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
                      )}
                    >
                      {result.success ? getCollapsedResultDisplay(result.value) : "Error"}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div 
                className="animate-in fade-in-0 duration-150"
                onMouseLeave={() => {
                  if (!textareaRef.current?.matches(':focus')) {
                    setIsTextareaFocused(false)
                  }
                }}
              >
                <div ref={expandedContainerRef} className="relative min-h-[56px]">
                  <ExpressionInput
                    ref={textareaRef}
                    value={localValue}
                    onChange={handleExpressionInputChange}
                    onKeyDown={handleKeyDown}
                    onCursorPositionChange={handleCursorPositionChange}
                    onFocus={() => {
                      setIsTextareaFocused(true)
                      updateAutocomplete(localValue, isExpanded)
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setIsTextareaFocused(false)
                        setShowAutocomplete(false)
                      }, 150)
                    }}
                    placeholder={placeholder}
                    size="compact"
                    minRows={2}
                    autoFocus
                    id={id}
                    name={name}
                  />

                  {showAutocomplete && autocompleteItems.length > 0 && (
                    <AutocompleteDropdown
                      items={autocompleteItems}
                      selectedIndex={selectedIndex}
                      onSelect={handleAutocompleteSelect}
                      onHover={setSelectedIndex}
                      position={dropdownPosition}
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 px-2 py-1.5 border-t border-border/50 bg-muted/30">
                  
                    <div className="flex-1 min-w-0">
                      <ResultPreview result={result} size="compact" onClickExpand={() => setIsFullscreen(true)} />
                    </div>
                

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(true)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Fullscreen"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsExpanded(false)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Collapse"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
