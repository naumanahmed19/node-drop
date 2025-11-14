import { variableService } from '@/services'
import { useWorkflowStore } from '@/stores'
import type { Variable } from '@/types/variable'
import { Eye } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ExpressionPreviewProps {
  value: string
  nodeId?: string
}

// Helper function to parse string arguments (removes quotes)
function parseStringArg(arg: string): string {
  return arg.replace(/['"]/g, '').trim()
}

// Helper function to parse numeric arguments
function parseNumericArgs(args: string): number[] {
  return args.split(',').map(a => {
    const trimmed = a.trim()
    const num = Number.parseInt(trimmed)
    return Number.isNaN(num) ? 0 : num
  })
}

// Helper function to parse and evaluate simple argument values
function parseArgValue(arg: string): any {
  const trimmed = arg.trim()
  
  // Try to parse as JSON (handles strings, numbers, booleans, null)
  try {
    return JSON.parse(trimmed)
  } catch {
    // If JSON parse fails, try as number
    const num = Number(trimmed)
    if (!Number.isNaN(num)) {
      return num
    }
    
    // Otherwise return as string (remove quotes if present)
    return trimmed.replace(/^['"]|['"]$/g, '')
  }
}

export function ExpressionPreview({ value, nodeId }: ExpressionPreviewProps) {
  const workflowStore = useWorkflowStore()
  const [variables, setVariables] = useState<Variable[]>([])

  // Fetch variables on mount
  useEffect(() => {
    const fetchVariables = async () => {
      try {
        const fetchedVariables = await variableService.getVariables()
        setVariables(fetchedVariables)
      } catch (error) {
        console.error('Error fetching variables for preview:', error)
      }
    }
    fetchVariables()
  }, [])

  // Function to resolve expression values
  const resolveExpression = (expression: string): string => {
    try {
      // Handle built-in nodeDrop expressions
      if (expression === '$now') {
        return new Date().toISOString()
      }
      
      if (expression === '$today') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return today.toISOString()
      }
      
      // Handle $now with methods (e.g., $now.format("YYYY-MM-DD"))
      if (expression.startsWith('$now.')) {
        const methodMatch = expression.match(/^\$now\.(\w+)\(([^)]*)\)$/)
        if (methodMatch) {
          const method = methodMatch[1]
          const args = methodMatch[2]
          
          if (method === 'format') {
            const format = args.replace(/['"]/g, '') // Remove quotes
            const now = new Date()
            
            // Simple format implementation (you can expand this)
            let formatted = format
              .replace('YYYY', now.getFullYear().toString())
              .replace('MM', String(now.getMonth() + 1).padStart(2, '0'))
              .replace('DD', String(now.getDate()).padStart(2, '0'))
              .replace('HH', String(now.getHours()).padStart(2, '0'))
              .replace('mm', String(now.getMinutes()).padStart(2, '0'))
              .replace('ss', String(now.getSeconds()).padStart(2, '0'))
            
            return formatted
          }
          
          if (method === 'plus' || method === 'add') {
            // Simple implementation for adding time
            return `[${expression}] → Use for time calculations`
          }
          
          if (method === 'minus' || method === 'subtract') {
            // Simple implementation for subtracting time
            return `[${expression}] → Use for time calculations`
          }
        }
        
        return new Date().toISOString() // Default to current time
      }
      
      // First, check if it's a variable expression ($vars.* or $local.*)
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

      // If not a variable, check if it's a json.* or json[*].* expression (from connected nodes)
      if (!nodeId) return expression

      const { workflow } = workflowStore
      if (!workflow) return expression

      // Find all connections where the current node is the target
      const inputConnections = workflow.connections.filter(
        (conn) => conn.targetNodeId === nodeId
      )

      if (inputConnections.length === 0) return expression

      // Check if expression is array-based (json[0].field) or object-based (json.field)
      const arrayAccessMatch = expression.match(/^json\[(\d+)\]\.(.+)$/)
      const objectAccessMatch = expression.match(/^json\.(.+)$/)
      
      if (arrayAccessMatch) {
        // Array-based access: json[0].field
        const inputIndex = parseInt(arrayAccessMatch[1], 10)
        const fieldPath = arrayAccessMatch[2]
        
        // Get the specific input connection by index
        if (inputIndex >= inputConnections.length) {
          return `[Input ${inputIndex} not found - only ${inputConnections.length} input(s) available]`
        }
        
        const connection = inputConnections[inputIndex]
        const sourceNodeId = connection.sourceNodeId
        const sourceNodeResult = workflowStore.getNodeExecutionResult(sourceNodeId)
        
        if (!sourceNodeResult?.data) {
          return `[No data from input ${inputIndex}]`
        }

        // Extract data structure
        let sourceData: any[] = []
        if (sourceNodeResult.data.main && Array.isArray(sourceNodeResult.data.main)) {
          sourceData = sourceNodeResult.data.main
        } else if (sourceNodeResult.status === 'skipped') {
          sourceData = [{ json: sourceNodeResult.data }]
        }

        if (sourceData.length === 0) {
          return `[No data from input ${inputIndex}]`
        }

        // Get the first item's data
        const firstItem = sourceData[0]
        let itemData: any = null
        
        if (firstItem && firstItem.json) {
          itemData = firstItem.json
        } else if (firstItem) {
          itemData = firstItem
        }

        if (!itemData) {
          return `[No data from input ${inputIndex}]`
        }

        // Get the field value
        const value = getNestedValue(itemData, fieldPath)
        if (value !== undefined) {
          return formatValue(value)
        }
        
        return `[Field not found: json[${inputIndex}].${fieldPath}]`
      } else if (objectAccessMatch) {
        // Object-based access: json.field (single input)
        const fieldPath = objectAccessMatch[1]
        
        // Get data from the first connected node
        for (const connection of inputConnections) {
          const sourceNodeId = connection.sourceNodeId
          const sourceNodeResult = workflowStore.getNodeExecutionResult(sourceNodeId)
          
          if (!sourceNodeResult?.data) continue

          // Extract data structure
          let sourceData: any[] = []
          if (sourceNodeResult.data.main && Array.isArray(sourceNodeResult.data.main)) {
            sourceData = sourceNodeResult.data.main
          } else if (sourceNodeResult.status === 'skipped') {
            sourceData = [{ json: sourceNodeResult.data }]
          }

          if (sourceData.length === 0) continue

          // Get the first item's data
          const firstItem = sourceData[0]
          let itemData: any = null
          
          if (firstItem && firstItem.json) {
            itemData = firstItem.json
          } else if (firstItem) {
            itemData = firstItem
          }

          if (!itemData) continue

          // Get the field value
          const value = getNestedValue(itemData, fieldPath)
          if (value !== undefined) {
            return formatValue(value)
          }
        }
      }

      return expression
    } catch (error) {
      console.error('Error resolving expression:', error)
      return expression
    }
  }

  // Helper function to get nested value from object
  const getNestedValue = (obj: any, path: string): any => {
    const parts = path.split(/[.\[\]]/).filter(Boolean)
    let current = obj

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined
      }

      // Check if it's an array index
      const arrayIndex = parseInt(part, 10)
      if (!isNaN(arrayIndex) && Array.isArray(current)) {
        current = current[arrayIndex]
      } else {
        current = current[part]
      }
    }

    return current
  }

  // Helper function to format values for display
  const formatValue = (value: any): string => {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (Array.isArray(value)) return `[Array: ${value.length} items]`
    if (typeof value === 'object') return '[Object]'
    return String(value)
  }

  // Function to parse and resolve all expressions in the text
  const getPreviewText = (): string => {
    if (!value) return ''

    // Find all {{...}} expressions and replace them with actual values
    const resolvedText = value.replace(/\{\{([^}]+)\}\}/g, (_match, expression) => {
      const trimmedExpr = expression.trim()
      
      // Check if it's a direct json array method (e.g., json.filter(), json.map())
      const jsonArrayMethodMatch = trimmedExpr.match(/^json\.(\w+)\((.+?)\)$/)
      if (jsonArrayMethodMatch) {
        const method = jsonArrayMethodMatch[1]
        const methodArgs = jsonArrayMethodMatch[2]
        
        // Get json data from connected nodes
        if (!nodeId) return `[Preview not available - complex array method]`
        
        const { workflow } = workflowStore
        if (!workflow) return `[Preview not available - complex array method]`
        
        const inputConnections = workflow.connections.filter(
          (conn) => conn.targetNodeId === nodeId
        )
        
        if (inputConnections.length === 0) return `[Preview not available - complex array method]`
        
        // Get data from the first connected node
        for (const connection of inputConnections) {
          const sourceNodeId = connection.sourceNodeId
          const sourceNodeResult = workflowStore.getNodeExecutionResult(sourceNodeId)
          
          if (!sourceNodeResult?.data) continue
          
          // Extract data structure
          let sourceData: any[] = []
          if (sourceNodeResult.data.main && Array.isArray(sourceNodeResult.data.main)) {
            sourceData = sourceNodeResult.data.main
          } else if (sourceNodeResult.status === 'skipped') {
            sourceData = [{ json: sourceNodeResult.data }]
          }
          
          if (sourceData.length === 0) continue
          
          const firstItem = sourceData[0]
          let itemData: any = null
          
          if (firstItem && firstItem.json) {
            itemData = firstItem.json
          } else if (firstItem) {
            itemData = firstItem
          }
          
          if (!itemData) continue
          
          // Check if itemData is an array
          if (!Array.isArray(itemData)) {
            return `[json is not an array - it's ${typeof itemData}]`
          }
          
          // Handle different array methods
          try {
            switch (method) {
              case 'filter': {
                // Complex operation with arrow function - cannot safely eval
                return `[Will filter array of ${itemData.length} items - result available at execution]`
              }
              case 'map': {
                // Complex operation with arrow function - cannot safely eval
                return `[Will map array of ${itemData.length} items - result available at execution]`
              }
              case 'find': {
                // Complex operation with arrow function - cannot safely eval
                return `[Will find from array of ${itemData.length} items - result available at execution]`
              }
              case 'some': {
                // Complex operation with arrow function - cannot safely eval
                return `[Will check array of ${itemData.length} items - result available at execution]`
              }
              case 'every': {
                // Complex operation with arrow function - cannot safely eval
                return `[Will check array of ${itemData.length} items - result available at execution]`
              }
              case 'reduce': {
                // Complex operation with arrow function - cannot safely eval
                return `[Will reduce array of ${itemData.length} items - result available at execution]`
              }
              case 'length': {
                // Safe: property access
                return String(itemData.length)
              }
              case 'join': {
                // Safe: can evaluate join for simple arrays
                const separator = parseStringArg(methodArgs)
                
                // Check if all items are primitives (safe to join)
                if (itemData.every((item: any) => typeof item !== 'object' || item === null)) {
                  return itemData.join(separator)
                }
                
                // For object arrays, show info message
                return `[Array with ${itemData.length} objects - join result available at execution]`
              }
              case 'slice': {
                // Safe: can evaluate slice with numeric arguments
                const args = parseNumericArgs(methodArgs)
                
                if (args.length >= 1) {
                  const sliced = itemData.slice(args[0], args[1])
                  
                  // Show actual result for small slices
                  if (sliced.length <= 3 && sliced.every((item: any) => typeof item !== 'object')) {
                    return JSON.stringify(sliced)
                  }
                  
                  // Otherwise show info
                  return `[Array with ${sliced.length} items - full result available at execution]`
                }
                
                return `[Will slice array - result available at execution]`
              }
              case 'reverse': {
                // Safe: can show reversed array info
                return `[Will reverse array of ${itemData.length} items - result available at execution]`
              }
              case 'sort': {
                // Might have arrow function comparator - show info
                return `[Will sort array of ${itemData.length} items - result available at execution]`
              }
              case 'concat': {
                // Safe: can show info about concatenation
                return `[Will concatenate with array - result available at execution]`
              }
              case 'includes': {
                // Safe: can evaluate includes for simple values
                try {
                  const searchValue = parseArgValue(methodArgs)
                  if (typeof searchValue !== 'undefined') {
                    const result = itemData.includes(searchValue)
                    return String(result)
                  }
                } catch {}
                return `[Will check if array includes value - result available at execution]`
              }
              case 'indexOf': {
                // Safe: can evaluate indexOf for simple values
                try {
                  const searchValue = parseArgValue(methodArgs)
                  if (typeof searchValue !== 'undefined') {
                    const result = itemData.indexOf(searchValue)
                    return String(result)
                  }
                } catch {}
                return `[Will find index in array - result available at execution]`
              }
              default:
                return `[Array method '${method}' result available at execution]`
            }
          } catch (error) {
            return `[Error previewing array method: ${method}]`
          }
        }
        
        return `[Preview not available - complex array method]`
      }
      
      // Check if it's a json.* or json[*].* expression (with or without methods)
      // Match both json.field and json[0].field patterns
      const jsonArrayMatch = trimmedExpr.match(/^json\[(\d+)\]\.(.+?)(?:\.(\w+)\((.*?)\))?$/)
      const jsonObjectMatch = trimmedExpr.match(/^json\.(.+?)(?:\.(\w+)\((.*?)\))?$/)
      
      if (jsonArrayMatch || jsonObjectMatch) {
        let inputIndex: number | null = null
        let fieldPath: string
        let method: string | undefined
        let methodArgs: string | undefined
        
        if (jsonArrayMatch) {
          // Array-based: json[0].field
          inputIndex = parseInt(jsonArrayMatch[1], 10)
          fieldPath = jsonArrayMatch[2]
          method = jsonArrayMatch[3]
          methodArgs = jsonArrayMatch[4]
        } else {
          // Object-based: json.field
          fieldPath = jsonObjectMatch![1]
          method = jsonObjectMatch![2]
          methodArgs = jsonObjectMatch![3]
        }
        
        // Get json data from connected nodes
        if (!nodeId) return trimmedExpr
        
        const { workflow } = workflowStore
        if (!workflow) return trimmedExpr
        
        const inputConnections = workflow.connections.filter(
          (conn) => conn.targetNodeId === nodeId
        )
        
        if (inputConnections.length === 0) return trimmedExpr
        
        // Determine which connection to use
        let targetConnection: any
        if (inputIndex !== null) {
          // Use specific input by index
          if (inputIndex >= inputConnections.length) {
            return `[Input ${inputIndex} not found - only ${inputConnections.length} input(s) available]`
          }
          targetConnection = inputConnections[inputIndex]
        } else {
          // Use first connection for object-based access
          targetConnection = inputConnections[0]
        }
        
        const sourceNodeId = targetConnection.sourceNodeId
        const sourceNodeResult = workflowStore.getNodeExecutionResult(sourceNodeId)
        
        if (!sourceNodeResult?.data) {
          return inputIndex !== null 
            ? `[No data from input ${inputIndex}]`
            : trimmedExpr
        }
        
        // Extract data structure
        let sourceData: any[] = []
        if (sourceNodeResult.data.main && Array.isArray(sourceNodeResult.data.main)) {
          sourceData = sourceNodeResult.data.main
        } else if (sourceNodeResult.status === 'skipped') {
          sourceData = [{ json: sourceNodeResult.data }]
        }
        
        if (sourceData.length === 0) {
          return inputIndex !== null 
            ? `[No data from input ${inputIndex}]`
            : trimmedExpr
        }
        
        const firstItem = sourceData[0]
        let itemData: any = null
        
        if (firstItem && firstItem.json) {
          itemData = firstItem.json
        } else if (firstItem) {
          itemData = firstItem
        }
        
        if (!itemData) {
          return inputIndex !== null 
            ? `[No data from input ${inputIndex}]`
            : trimmedExpr
        }
        
        // Get the field value
        const fieldValue = getNestedValue(itemData, fieldPath)
        
        if (fieldValue === undefined) {
          return inputIndex !== null
            ? `[Field not found: json[${inputIndex}].${fieldPath}]`
            : `[Field not found: json.${fieldPath}]`
        }
        
        // Apply method if exists
        if (method && typeof fieldValue === 'string') {
          try {
            switch (method) {
              case 'toUpperCase':
                return fieldValue.toUpperCase()
              case 'toLowerCase':
                return fieldValue.toLowerCase()
              case 'trim':
                return fieldValue.trim()
              case 'length':
                return String(fieldValue.length)
              case 'substring':
              case 'substr':
                if (methodArgs) {
                  const args = methodArgs.split(',').map((a: string) => parseInt(a.trim()))
                  return fieldValue.substring(args[0], args[1])
                }
                return fieldValue
              case 'replace':
                if (methodArgs) {
                  const args = methodArgs.split(',').map((a: string) => a.trim().replace(/['"]/g, ''))
                  return fieldValue.replace(args[0], args[1] || '')
                }
                return fieldValue
              default:
                return formatValue(fieldValue)
            }
          } catch (error) {
            return `[Error applying method: ${method}]`
          }
        } else if (method && Array.isArray(fieldValue)) {
          // Handle array methods
          try {
            switch (method) {
              case 'length':
                return String(fieldValue.length)
              case 'join':
                if (methodArgs) {
                  const separator = methodArgs.replace(/['"]/g, '')
                  return fieldValue.join(separator)
                }
                return fieldValue.join(',')
              default:
                return formatValue(fieldValue)
            }
          } catch (error) {
            return `[Error applying method: ${method}]`
          }
        }
        
        // No method, just return the value
        return formatValue(fieldValue)
      }
      
      // Check if it's a complex expression (contains operators or function calls)
      // Exclude method calls on json.* expressions (already handled above)
      const isComplexExpression = /[+\-*/%[\]<>=!&|]/.test(trimmedExpr) && !trimmedExpr.startsWith('json.')
      
      if (isComplexExpression) {
        // For complex expressions, replace variables within them first
        let resolvedExpression = trimmedExpr
        
        // Replace $now with current timestamp
        resolvedExpression = resolvedExpression.replace(/\$now/g, `"${new Date().toISOString()}"`)
        
        // Replace $today with today's date at midnight
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        resolvedExpression = resolvedExpression.replace(/\$today/g, `"${today.toISOString()}"`)
        
        // Replace $vars.* variables
        resolvedExpression = resolvedExpression.replace(/\$vars\.(\w+)/g, (_m: string, varKey: string) => {
          const variable = variables.find(v => v.key === varKey && v.scope === 'GLOBAL')
          return variable ? JSON.stringify(variable.value) : `"[Variable not found: $vars.${varKey}]"`
        })
        
        // Replace $local.* variables
        resolvedExpression = resolvedExpression.replace(/\$local\.(\w+)/g, (_m: string, varKey: string) => {
          const variable = variables.find(v => v.key === varKey && v.scope === 'LOCAL')
          return variable ? JSON.stringify(variable.value) : `"[Variable not found: $local.${varKey}]"`
        })
        
        // Try to evaluate the expression
        try {
          // eslint-disable-next-line no-eval
          const result = eval(resolvedExpression)
          return String(result)
        } catch (error) {
          // If evaluation fails, return the resolved expression as-is
          return `[Expression: ${resolvedExpression}]`
        }
      }
      
      // For simple expressions, use the existing resolveExpression function
      const resolvedValue = resolveExpression(trimmedExpr)
      return resolvedValue
    })

    return resolvedText
  }

  const previewText = getPreviewText()

  // Don't show preview if there are no expressions or if it's the same as input
  if (!value || !value.includes('{{') || previewText === value) {
    return null
  }

  return (
    <div className="mt-2 p-3 rounded-md bg-muted/50 border border-border">
      <div className="flex items-start gap-2">
        <Eye className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-muted-foreground mb-1">Preview</div>
          <div className="text-sm text-foreground break-words whitespace-pre-wrap">
            {previewText}
          </div>
        </div>
      </div>
    </div>
  )
}
