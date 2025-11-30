// Simple expression evaluator for demo purposes
export function evaluateExpression(
  expression: string,
  context: Record<string, unknown>,
): { success: boolean; value: string; type: string; error?: string } {
  const regex = /\{\{\s*(.+?)\s*\}\}/g
  const matches = [...expression.matchAll(regex)]

  // If no expressions, return the original text
  if (matches.length === 0) {
    return {
      success: true,
      value: expression,
      type: "string",
    }
  }

  try {
    // Create safe evaluation context
    // $node data is stored directly (not wrapped in .json) for cleaner expressions
    const safeContext: Record<string, unknown> = {
      $json: context.$json,
      $input: context.$input,
      $now: context.$now,
      $today: context.$today,
      $workflow: context.$workflow,
      $execution: context.$execution,
      $vars: context.$vars,
      $node: context.$node,
      $itemIndex: context.$itemIndex ?? 0, // Current item index (0-based)
    }

    const evaluate = createSafeEvaluator(safeContext)

    // Format a single value
    const formatValue = (val: unknown): string => {
      if (val === undefined) return "undefined"
      if (val === null) return "null"
      if (typeof val === "object") {
        return JSON.stringify(val, null, 2)
      }
      return String(val)
    }

    let resultText = expression
    let lastEvaluatedValue: unknown = null

    for (const match of matches) {
      const fullMatch = match[0]
      const expr = match[1].trim()

      const result = evaluate(expr)
      lastEvaluatedValue = result
      resultText = resultText.replace(fullMatch, formatValue(result))
    }

    const getType = (): string => {
      // If there's text outside expressions, it's a string
      if (matches.length === 1 && expression.trim() === matches[0][0]) {
        // Only one expression and it's the whole input
        if (lastEvaluatedValue === null) return "null"
        if (lastEvaluatedValue === undefined) return "undefined"
        if (Array.isArray(lastEvaluatedValue)) return "Array"
        if (typeof lastEvaluatedValue === "object") return "Object"
        return typeof lastEvaluatedValue
      }
      return "string"
    }

    return {
      success: true,
      value: resultText,
      type: getType(),
    }
  } catch (error) {
    return {
      success: false,
      value: "",
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Expression evaluator with full JavaScript method support
// Uses safe evaluation with a restricted scope

type SafeContext = Record<string, unknown>

function createSafeEvaluator(context: SafeContext) {
  // Create a restricted scope with only allowed globals
  const allowedGlobals = {
    // Constructors
    String,
    Number,
    Boolean,
    Array,
    Object,
    Date,
    Math,
    JSON,
    RegExp,
    // Utilities
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    // DateTime helper (n8n style)
    DateTime: {
      now: () => new Date().toISOString(),
      fromISO: (str: string) => (str ? new Date(str).toISOString() : new Date().toISOString()),
      fromFormat: (str: string, _format: string) => new Date(str).toISOString(),
      fromMillis: (millis: number) => new Date(millis).toISOString(),
      local: () => new Date().toLocaleString(),
    },
    // Context variables
    ...context,
  }

  return (expr: string): unknown => {
    // Build the function parameter names and values
    const paramNames = Object.keys(allowedGlobals)
    const paramValues = Object.values(allowedGlobals)

    try {
      // Create function with restricted scope
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function(...paramNames, `"use strict"; return (${expr});`)
      return fn(...paramValues)
    } catch (error) {
      throw error
    }
  }
}
