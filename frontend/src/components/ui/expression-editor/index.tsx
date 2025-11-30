"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { ExpressionInput } from "./expression-input"
import { AutocompleteDropdown } from "./autocomplete-dropdown"
import { ResultPreview } from "./result-preview"
import { VariableSelector } from "./variable-selector"
import { evaluateExpression } from "./expression-evaluator"
import type { AutocompleteItem, VariableCategory, ExpressionEditorProps } from "./types"
import { defaultVariableCategories } from "./default-categories"
import { inferTypeFromPath, getPropertiesFromPath } from "./expression-utils"


// Default mock data - will be overridden by actual workflow data when nodeId is provided
const defaultMockData = {
  $json: [
    [
      {
        id: 1,
        name: "Item 1",
        title: "First Item",
        userId: 100,
        email: "user1@example.com",
        body: "This is the body of item 1",
      },
      {
        id: 2,
        name: "Item 2",
        title: "Second Item",
        userId: 101,
        email: "user2@example.com",
        body: "This is the body of item 2",
      },
    ],
    [
      {
        id: 3,
        name: "Item 3",
        title: "Third Item",
        userId: 102,
        email: "user3@example.com",
        body: "This is the body of item 3",
      },
    ],
  ],
  $input: {},
  $now: new Date().toISOString(),
  $today: new Date().toISOString().split("T")[0],
  $workflow: {},
  $execution: {},
  $vars: {},
  $node: {},
}

const getMethodsForType = (
  type: "string" | "array" | "number" | "object" | "any",
  categories: VariableCategory[],
): AutocompleteItem[] => {
  const stringMethods = categories.find((c) => c.name === "String Methods")?.items || []
  const arrayMethods = categories.find((c) => c.name === "Array Methods")?.items || []
  const numberMethods = categories.find((c) => c.name === "Number & Math")?.items || []

  switch (type) {
    case "string":
      return stringMethods
    case "array":
      return arrayMethods
    case "number":
      return numberMethods.filter((m) => m.label.startsWith("."))
    case "object":
      return []
    default:
      return [...stringMethods, ...arrayMethods, ...numberMethods.filter((m) => m.label.startsWith("."))]
  }
}

// getPropertiesFromPath and inferTypeFromPath are imported from expression-utils.ts

export function ExpressionEditor({
  initialValue = "{{ $json.name.toUpperCase() }}",
  placeholder = "Enter expression...",
  mockData: providedMockData,
  variableCategories = defaultVariableCategories,
  onChange,
  onResultChange,
  title = "Edit Expression",
  showVariableSelector = true,
  showResultPreview = true,
  className = "",
  nodeId,
}: ExpressionEditorProps = {}) {
  const [expression, setExpression] = useState(initialValue)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 40, left: 12 })
  
  // Infer mode from value - if it contains {{ }}, start in expression mode
  const [isExpressionMode, setIsExpressionMode] = useState(() => {
    return initialValue.includes("{{") ? true : false
  })
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  // Flatten all autocomplete items from categories
  const allAutocompleteItems: AutocompleteItem[] = variableCategories.flatMap((cat) => cat.items)

  // Use provided mock data or default
  const mockData = providedMockData || defaultMockData

  // Evaluate the expression only in expression mode
  const result = isExpressionMode 
    ? evaluateExpression(expression, mockData)
    : { success: true, value: expression, type: "string" }

  useEffect(() => {
    onResultChange?.(result)
  }, [result, onResultChange])

  useEffect(() => {
    // Update mode based on expression content
    setIsExpressionMode(expression.includes("{{"))
  }, [expression])

  useEffect(() => {
    // Auto-focus the textarea when component mounts
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const getCurrentWord = useCallback(
    (
      text: string,
      position: number,
    ): { word: string; context: string; endsWithDot: boolean; partialProperty: string } => {
      const beforeCursor = text.slice(0, position)
      const afterLastBrace = beforeCursor.lastIndexOf("{{")
      if (afterLastBrace === -1) return { word: "", context: "", endsWithDot: false, partialProperty: "" }

      const expressionPart = beforeCursor.slice(afterLastBrace + 2).trim()
      const endsWithDot = expressionPart.endsWith(".")
      const tokens = expressionPart.split(/[\s()+\-*/,]/)
      const lastToken = tokens[tokens.length - 1] || ""
      const lastDotIndex = lastToken.lastIndexOf(".")

      if (endsWithDot) {
        const context = lastToken.slice(0, -1)
        return { word: "", context, endsWithDot: true, partialProperty: "" }
      }

      if (lastDotIndex !== -1) {
        const beforeDot = lastToken.slice(0, lastDotIndex)
        const afterDot = lastToken.slice(lastDotIndex + 1)
        return {
          word: lastToken,
          context: beforeDot,
          endsWithDot: false,
          partialProperty: afterDot,
        }
      }

      return { word: lastToken, context: "", endsWithDot: false, partialProperty: "" }
    },
    [],
  )

  const filterAutocomplete = useCallback(
    (searchTerm: string, context: string, endsWithDot: boolean, partialProperty: string) => {
      if (endsWithDot && context) {
        const type = inferTypeFromPath(context, mockData)

        if (type === "object") {
          const properties = getPropertiesFromPath(context, mockData)
          if (properties.length > 0) {
            return properties
          }
        }

        const methods = getMethodsForType(type, variableCategories)
        return methods.slice(0, 15)
      }

      if (context && partialProperty) {
        const type = inferTypeFromPath(context, mockData)
        const partialLower = partialProperty.toLowerCase()

        if (type === "object") {
          const properties = getPropertiesFromPath(context, mockData)
          const filtered = properties.filter((item) => item.label.toLowerCase().includes(partialLower))
          if (filtered.length > 0) {
            return filtered.slice(0, 15)
          }
        }

        const methods = getMethodsForType(type, variableCategories)
        const filteredMethods = methods.filter((item) => {
          const methodName = item.label.startsWith(".") ? item.label.slice(1) : item.label
          return methodName.toLowerCase().includes(partialLower)
        })

        if (filteredMethods.length > 0) {
          return filteredMethods.slice(0, 15)
        }

        if (type === "object") {
          const properties = getPropertiesFromPath(context, mockData)
          return properties.slice(0, 15)
        }
      }

      if (searchTerm.startsWith(".")) {
        const term = searchTerm.toLowerCase()
        if (context) {
          const type = inferTypeFromPath(context, mockData)
          const methods = getMethodsForType(type, variableCategories)
          return methods.filter((item) => item.label.toLowerCase().includes(term)).slice(0, 15)
        }
        return allAutocompleteItems
          .filter((item) => item.label.startsWith(".") && item.label.toLowerCase().includes(term))
          .slice(0, 15)
      }

      if (!searchTerm) {
        return allAutocompleteItems
          .filter(
            (item) =>
              item.label.startsWith("$json") ||
              item.label.startsWith("$input") ||
              item.label.startsWith("$now") ||
              item.label.startsWith("$node"),
          )
          .slice(0, 12)
      }

      const term = searchTerm.toLowerCase()
      return allAutocompleteItems.filter((item) => item.label.toLowerCase().includes(term)).slice(0, 12)
    },
    [mockData, variableCategories, allAutocompleteItems],
  )

  const handleExpressionChange = useCallback(
    (value: string, position?: number) => {
      setExpression(value)
      if (position !== undefined) {
        setCursorPosition(position)
      }
      onChange?.(value)

      const cursorPos = position ?? cursorPosition
      const beforeCursor = value.slice(0, cursorPos)
      const afterCursor = value.slice(cursorPos)
      const isInsideExpression =
        beforeCursor.includes("{{") &&
        (afterCursor.includes("}}") || !beforeCursor.slice(beforeCursor.lastIndexOf("{{")).includes("}}"))

      // Only show autocomplete if in expression mode and inside expression
      if (isExpressionMode && isInsideExpression) {
        const { word, context, endsWithDot, partialProperty } = getCurrentWord(value, cursorPos)
        const filtered = filterAutocomplete(word, context, endsWithDot, partialProperty)
        setAutocompleteItems(filtered)
        setShowAutocomplete(filtered.length > 0)
        setSelectedIndex(0)
      } else {
        setShowAutocomplete(false)
      }
    },
    [getCurrentWord, filterAutocomplete, onChange, cursorPosition, isExpressionMode],
  )

  const handleCursorPositionChange = useCallback((position: { top: number; left: number }) => {
    setDropdownPosition(position)
  }, [])

  const handleAutocompleteSelect = useCallback(
    (item: AutocompleteItem) => {
      const { word, context, endsWithDot, partialProperty } = getCurrentWord(expression, cursorPosition)

      let newExpression: string
      let newCursorPosition: number

      if (item.label.startsWith(".")) {
        if (endsWithDot) {
          const replaceStart = cursorPosition
          newExpression = expression.slice(0, replaceStart) + item.insertText.slice(1) + expression.slice(replaceStart)
          newCursorPosition = replaceStart + item.insertText.length - 1
        } else if (partialProperty) {
          const replaceStart = cursorPosition - partialProperty.length
          newExpression =
            expression.slice(0, replaceStart) + item.insertText.slice(1) + expression.slice(cursorPosition)
          newCursorPosition = replaceStart + item.insertText.length - 1
        } else {
          newExpression = expression.slice(0, cursorPosition) + item.insertText + expression.slice(cursorPosition)
          newCursorPosition = cursorPosition + item.insertText.length
        }
      } else if (context && partialProperty) {
        const replaceStart = cursorPosition - partialProperty.length
        newExpression = expression.slice(0, replaceStart) + item.insertText + expression.slice(cursorPosition)
        newCursorPosition = replaceStart + item.insertText.length
      } else if (endsWithDot) {
        newExpression = expression.slice(0, cursorPosition) + item.insertText + expression.slice(cursorPosition)
        newCursorPosition = cursorPosition + item.insertText.length
      } else {
        const replaceStart = cursorPosition - word.length
        newExpression = expression.slice(0, replaceStart) + item.insertText + expression.slice(cursorPosition)
        newCursorPosition = replaceStart + item.insertText.length
      }

      setExpression(newExpression)
      setCursorPosition(newCursorPosition)
      setShowAutocomplete(false)
      onChange?.(newExpression)

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition)
        }
      }, 0)
    },
    [expression, cursorPosition, getCurrentWord, onChange],
  )

  const handleVariableSelect = useCallback(
    (item: AutocompleteItem) => {
      const insertText = `{{ ${item.insertText} }}`

      if (inputRef.current) {
        const start = inputRef.current.selectionStart || 0
        const end = inputRef.current.selectionEnd || 0
        const newExpression = expression.slice(0, start) + insertText + expression.slice(end)
        setExpression(newExpression)
        onChange?.(newExpression)

        setTimeout(() => {
          inputRef.current?.focus()
          const newPosition = start + insertText.length
          inputRef.current?.setSelectionRange(newPosition, newPosition)
        }, 0)
      } else {
        const newExpression = expression + insertText
        setExpression(newExpression)
        onChange?.(newExpression)
      }
    },
    [expression, onChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showAutocomplete) {
        return
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, autocompleteItems.length - 1))
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case "Enter":
        case "Tab":
          e.preventDefault()
          if (autocompleteItems[selectedIndex]) {
            handleAutocompleteSelect(autocompleteItems[selectedIndex])
          }
          break
        case "Escape":
          setShowAutocomplete(false)
          break
        case "ArrowLeft":
        case "ArrowRight":
          setShowAutocomplete(false)
          break
      }
    },
    [showAutocomplete, autocompleteItems, selectedIndex, handleAutocompleteSelect],
  )

  return (
    <div className={`flex h-full ${className}`}>
      {/* Variable Selector Sidebar */}
      {showVariableSelector && <VariableSelector categories={variableCategories} onSelect={handleVariableSelect} />}

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Expression Type Toggle */}
        <div className="bg-muted px-4 py-2 border-b">
          <div className="flex items-center gap-1 bg-background rounded-md p-0.5 w-fit">
            <button
              onClick={() => setIsExpressionMode(false)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                !isExpressionMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Fixed
            </button>
            <button
              onClick={() => setIsExpressionMode(true)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                isExpressionMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Expression
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor Area */}
          <div ref={editorRef} className="relative flex-1 bg-background pointer-events-auto">
            <ExpressionInput
              ref={inputRef}
              value={expression}
              onChange={handleExpressionChange}
              onKeyDown={handleKeyDown}
              onCursorPositionChange={handleCursorPositionChange}
              placeholder={placeholder}
            />

            {showAutocomplete && (
              <AutocompleteDropdown
                items={autocompleteItems}
                selectedIndex={selectedIndex}
                onSelect={handleAutocompleteSelect}
                onHover={setSelectedIndex}
                position={dropdownPosition}
              />
            )}
          </div>

          {/* Result Preview */}
          {showResultPreview && <ResultPreview result={result} />}
        </div>
      </div>
    </div>
  )
}

export { MiniExpressionEditor } from "./mini-expression-editor"
export { inferTypeFromPath, getPropertiesFromPath } from "./expression-utils"
export type { ExpressionEditorProps, AutocompleteItem, VariableCategory } from "./types"
