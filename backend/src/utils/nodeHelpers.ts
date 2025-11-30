/**
 * Node Helpers Utility
 *
 * Common utility functions that can be used across all node implementations.
 * These helpers provide reusable functionality for data manipulation and processing.
 */

/**
 * Context object for expression resolution containing all available data sources
 */
export interface ExpressionContext {
  $json?: any;           // Immediate input data
  $node?: Record<string, { json: any }>; // Node outputs by ID: $node["nodeId"].json
  $vars?: Record<string, string>;        // Variables
  $workflow?: { id: string; name: string; active: boolean };
  $execution?: { id: string; mode: string };
}

/**
 * Simple DateTime helper (compatible with Luxon-like API)
 * Provides basic date/time functionality for expressions
 */
const DateTime = {
  now: () => ({
    toISO: () => new Date().toISOString(),
    toISODate: () => new Date().toISOString().split('T')[0],
    toFormat: (format: string) => {
      const d = new Date();
      // Basic format support
      return format
        .replace('yyyy', d.getFullYear().toString())
        .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
        .replace('dd', d.getDate().toString().padStart(2, '0'))
        .replace('HH', d.getHours().toString().padStart(2, '0'))
        .replace('mm', d.getMinutes().toString().padStart(2, '0'))
        .replace('ss', d.getSeconds().toString().padStart(2, '0'));
    },
    plus: (duration: { days?: number; hours?: number; minutes?: number }) => {
      const d = new Date();
      if (duration.days) d.setDate(d.getDate() + duration.days);
      if (duration.hours) d.setHours(d.getHours() + duration.hours);
      if (duration.minutes) d.setMinutes(d.getMinutes() + duration.minutes);
      return {
        toISO: () => d.toISOString(),
        toISODate: () => d.toISOString().split('T')[0],
      };
    },
    minus: (duration: { days?: number; hours?: number; minutes?: number }) => {
      const d = new Date();
      if (duration.days) d.setDate(d.getDate() - duration.days);
      if (duration.hours) d.setHours(d.getHours() - duration.hours);
      if (duration.minutes) d.setMinutes(d.getMinutes() - duration.minutes);
      return {
        toISO: () => d.toISOString(),
        toISODate: () => d.toISOString().split('T')[0],
      };
    },
  }),
  fromISO: (isoString: string) => ({
    toISO: () => new Date(isoString).toISOString(),
    toISODate: () => new Date(isoString).toISOString().split('T')[0],
    toFormat: (format: string) => {
      const d = new Date(isoString);
      return format
        .replace('yyyy', d.getFullYear().toString())
        .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
        .replace('dd', d.getDate().toString().padStart(2, '0'))
        .replace('HH', d.getHours().toString().padStart(2, '0'))
        .replace('mm', d.getMinutes().toString().padStart(2, '0'))
        .replace('ss', d.getSeconds().toString().padStart(2, '0'));
    },
  }),
};

/**
 * Safely evaluate a JavaScript expression with provided context
 * Supports: String/Array/Object methods, Math, JSON, DateTime
 */
function safeEvaluateExpression(expression: string, context: ExpressionContext, item: any): any {
  try {
    // Build the evaluation context with all available data
    const evalContext: Record<string, any> = {
      // Data sources
      $json: context.$json ?? item,
      $node: context.$node || {},
      $vars: context.$vars || {},
      $workflow: context.$workflow || {},
      $execution: context.$execution || {},
      // Built-in variables
      $now: new Date().toISOString(),
      $today: new Date().toISOString().split('T')[0],
      // Safe globals
      Math,
      JSON,
      Object,
      Array,
      String,
      Number,
      Boolean,
      Date,
      DateTime, // Our DateTime helper
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      encodeURI,
      decodeURI,
    };

    // Create a function that evaluates the expression with the context
    // We use Function constructor instead of eval for slightly better isolation
    const contextKeys = Object.keys(evalContext);
    const contextValues = Object.values(evalContext);
    
    // Wrap expression to return its value
    const wrappedExpression = `"use strict"; return (${expression});`;
    
    // Create and execute the function
    const evaluator = new Function(...contextKeys, wrappedExpression);
    const result = evaluator(...contextValues);
    
    return result;
  } catch (error) {
    // If evaluation fails, return the original expression wrapped
    console.warn(`[safeEvaluateExpression] Failed to evaluate: ${expression}`, error);
    return `{{${expression}}}`;
  }
}

/**
 * Resolves placeholder expressions in a value string using data from an item or context.
 *
 * Supports multiple expression formats:
 * - {{$json.fieldName}} or {{json.fieldName}} - Access immediate input data
 * - {{$json[0].fieldName}} - Array-based access for multiple inputs
 * - {{$node["nodeId"].json.fieldName}} - Access specific node's output by ID (stable, doesn't break on rename)
 * - {{$node["Node Name"].json.fieldName}} - Access specific node's output by name (user-friendly)
 * - {{$vars.variableName}} - Access workflow variables
 * - {{$workflow.name}} - Access workflow metadata
 *
 * @param value - The value string that may contain placeholders
 * @param item - The data item (for backward compatibility) or ExpressionContext
 * @param context - Optional full expression context with $node, $vars, etc.
 * @returns The resolved value with placeholders replaced by actual data
 *
 * @example
 * // Simple field access
 * resolveValue("Hello {{$json.name}}", { name: "John" }); // "Hello John"
 * 
 * // Node reference by ID (stable - doesn't break on rename)
 * resolveValue("{{$node[\"abc123\"].json.title}}", null, { $node: { "abc123": { json: { title: "Test" } } } });
 * 
 * // Node reference by name (user-friendly)
 * resolveValue("{{$node[\"HTTP Request\"].json.posts}}", null, { $node: { "HTTP Request": { json: { posts: [...] } } } });
 * 
 * // Multiple inputs
 * resolveValue("{{$json[0].name}}", [{ name: "John" }, { name: "Jane" }]); // "John"
 */
export function resolveValue(value: string | any, item: any, context?: ExpressionContext): any {
  // If value is not a string, return as-is
  if (typeof value !== "string") {
    return value;
  }

  // Decode URL-encoded values first (handles cases where {{ and }} are encoded as %7B%7B and %7D%7D)
  let decodedValue = value;
  try {
    // Only decode if the value contains URL-encoded characters
    if (value.includes('%')) {
      decodedValue = decodeURIComponent(value);
    }
  } catch (error) {
    // If decoding fails, use the original value
    decodedValue = value;
  }

  // Replace placeholders like {{$json.fieldName}}, {{$node["id"].json.field}}, etc.
  // Improved regex that handles:
  // - Nested braces: {{ { key: "value" } }}
  // - Object literals: {{ $json.obj || {} }}
  // - Ternary with braces: {{ $json.x ? {a:1} : {b:2} }}
  // Uses a balanced brace matching approach
  return decodedValue.replace(/\{\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    
    // Check if this is a complex expression (contains method calls, operators, etc.)
    const isComplexExpression = 
      trimmedPath.includes('(') ||  // Method calls
      trimmedPath.includes('+') ||  // Arithmetic
      trimmedPath.includes('-') ||
      trimmedPath.includes('*') ||
      trimmedPath.includes('/') ||
      trimmedPath.includes('?') ||  // Ternary
      trimmedPath.includes('Math.') ||
      trimmedPath.includes('JSON.') ||
      trimmedPath.includes('Object.') ||
      trimmedPath.includes('Array.') ||
      trimmedPath.includes('DateTime.') ||
      trimmedPath === '$now' ||
      trimmedPath === '$today';
    
    // For complex expressions, use the safe evaluator
    if (isComplexExpression) {
      const result = safeEvaluateExpression(trimmedPath, context || {}, item);
      if (result !== undefined && result !== null && !String(result).startsWith('{{')) {
        return typeof result === 'object' ? JSON.stringify(result) : String(result);
      }
      // If evaluation returned the original expression, fall through to simple resolution
    }
    
    // Handle $node["nodeId"].json.field or $node["Node Name"].json.field format
    // Supports both node ID (stable) and node name (user-friendly)
    const nodeRefMatch = trimmedPath.match(/^\$node\["([^"]+)"\]\.json(?:\.(.+))?$/);
    if (nodeRefMatch) {
      const nodeIdOrName = nodeRefMatch[1];
      const fieldPath = nodeRefMatch[2];
      
      if (context?.$node && context.$node[nodeIdOrName]) {
        const nodeData = context.$node[nodeIdOrName].json;
        if (fieldPath) {
          const result = resolvePath(nodeData, fieldPath);
          return result !== undefined ? (typeof result === 'object' ? JSON.stringify(result) : String(result)) : match;
        }
        return typeof nodeData === 'object' ? JSON.stringify(nodeData) : String(nodeData);
      }
      return match;
    }
    
    // Handle $vars.variableName format
    const varsMatch = trimmedPath.match(/^\$vars\.(.+)$/);
    if (varsMatch) {
      const varName = varsMatch[1];
      if (context?.$vars && varName in context.$vars) {
        return context.$vars[varName];
      }
      return match;
    }
    
    // Handle $workflow.field format
    const workflowMatch = trimmedPath.match(/^\$workflow\.(.+)$/);
    if (workflowMatch) {
      const field = workflowMatch[1];
      if (context?.$workflow && field in context.$workflow) {
        return String((context.$workflow as any)[field]);
      }
      return match;
    }
    
    // Handle $execution.field format
    const executionMatch = trimmedPath.match(/^\$execution\.(.+)$/);
    if (executionMatch) {
      const field = executionMatch[1];
      if (context?.$execution && field in context.$execution) {
        return String((context.$execution as any)[field]);
      }
      return match;
    }
    
    // Handle $json[0].field or json[0].field (array-based access)
    const arrayAccessMatch = trimmedPath.match(/^\$?json\[(\d+)\](?:\.(.+))?$/);
    if (arrayAccessMatch) {
      const inputIndex = parseInt(arrayAccessMatch[1], 10);
      const fieldPath = arrayAccessMatch[2];
      
      // Use context.$json if available, otherwise fall back to item
      const dataSource = context?.$json ?? item;
      
      if (Array.isArray(dataSource)) {
        if (inputIndex >= dataSource.length) {
          return match;
        }
        
        const targetItem = dataSource[inputIndex];
        if (fieldPath) {
          const result = resolvePath(targetItem, fieldPath);
          return result !== undefined ? (typeof result === 'object' ? JSON.stringify(result) : String(result)) : match;
        }
        return typeof targetItem === 'object' ? JSON.stringify(targetItem) : String(targetItem);
      }
      return match;
    }
    
    // Handle $json.field or json.field (standard object access)
    let normalizedPath = trimmedPath;
    if (normalizedPath.startsWith('$json.')) {
      normalizedPath = normalizedPath.substring(6); // Remove '$json.'
    } else if (normalizedPath.startsWith('json.')) {
      normalizedPath = normalizedPath.substring(5); // Remove 'json.'
    } else if (normalizedPath === '$json' || normalizedPath === 'json') {
      // Return the entire json object
      const dataSource = context?.$json ?? item;
      return typeof dataSource === 'object' ? JSON.stringify(dataSource) : String(dataSource);
    }
    
    // Use context.$json if available, otherwise fall back to item
    const dataSource = context?.$json ?? item;
    const result = resolvePath(dataSource, normalizedPath);
    
    if (result !== undefined) {
      return typeof result === 'object' ? JSON.stringify(result) : String(result);
    }
    
    return match;
  });
}

/**
 * Resolves a field path in an object, supporting nested paths.
 *
 * @param obj - The object to extract data from
 * @param path - The path to the field (e.g., "user.address.city")
 * @returns The value at the specified path, or undefined if not found
 *
 * @example
 * const obj = { user: { address: { city: "NYC" } } };
 * resolvePath(obj, "user.address.city"); // Returns: "NYC"
 * resolvePath(obj, "user.name"); // Returns: undefined
 */
export function resolvePath(obj: any, path: string): any {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  // Handle array notation: items[0].name -> items.0.name
  const normalizedPath = path.replace(/\[(\d+)\]/g, ".$1");

  return normalizedPath.split(".").reduce((current, key) => {
    if (current === null || current === undefined) {
      return undefined;
    }
    return current[key];
  }, obj);
}

/**
 * Extracts the actual data from items that may be wrapped in {json: {...}} format.
 *
 * @param items - Array of items that may be wrapped
 * @returns Array of unwrapped data items
 *
 * @example
 * const wrapped = [{json: {id: 1}}, {json: {id: 2}}];
 * extractJsonData(wrapped); // Returns: [{id: 1}, {id: 2}]
 *
 * const unwrapped = [{id: 1}, {id: 2}];
 * extractJsonData(unwrapped); // Returns: [{id: 1}, {id: 2}]
 */
export function extractJsonData(items: any[]): any[] {
  return items.map((item: any) => {
    if (item && typeof item === "object" && "json" in item) {
      return item.json;
    }
    return item;
  });
}

/**
 * Wraps data items in the standard {json: {...}} format expected by the workflow engine.
 *
 * @param items - Array of data items to wrap
 * @returns Array of wrapped items
 *
 * @example
 * const data = [{id: 1}, {id: 2}];
 * wrapJsonData(data); // Returns: [{json: {id: 1}}, {json: {id: 2}}]
 */
export function wrapJsonData(items: any[]): any[] {
  return items.map((item: any) => ({ json: item }));
}

/**
 * Normalizes input data by unwrapping nested arrays if needed.
 *
 * Sometimes input data comes as [[{json: {...}}]] instead of [{json: {...}}].
 * This function handles that case.
 *
 * @param items - The items array that may be nested
 * @returns Normalized items array
 */
export function normalizeInputItems(items: any[] | any[][]): any[] {
  if (!items || !Array.isArray(items)) {
    return [];
  }

  // If items is wrapped in an extra array layer: [[{json: {...}}]]
  if (items.length === 1 && items[0] && Array.isArray(items[0])) {
    return items[0];
  }

  return items;
}
