export interface AutocompleteItem {
  label: string
  type: "variable" | "method" | "property" | "object" | "array" | "function"
  description?: string
  insertText: string
}

export interface VariableCategory {
  name: string
  icon: string
  items: AutocompleteItem[]
}

export interface ExpressionResult {
  success: boolean
  value: string
  type: string
  error?: string
}
