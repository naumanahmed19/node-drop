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
  $json?: any; // Immediate input data
  $node?: Record<string, any>; // Node outputs by ID/name: $node["nodeId"].field or $node["Name"].field
  $vars?: Record<string, string>; // Variables
  $workflow?: { id: string; name: string; active: boolean };
  $execution?: { id: string; mode: string };
  $itemIndex?: number; // Current item index when processing multiple items (0-based)
}

/**
 * Create helper functions for expression evaluation
 * Usage: isExecuted("Node Name"), hasData("Node Name"), etc.
 */
export function createNodeHelperFunctions(nodeData: Record<string, any>) {
  return {
    /**
     * Check if a node has executed (has data)
     * Usage: isExecuted("HTTP Request")
     */
    isExecuted: (nodeName: string): boolean => {
      return nodeData[nodeName] !== undefined && nodeData[nodeName] !== null;
    },

    /**
     * Check if a node has non-empty data
     * Usage: hasData("HTTP Request")
     */
    hasData: (nodeName: string): boolean => {
      const data = nodeData[nodeName];
      if (data === undefined || data === null) return false;
      if (Array.isArray(data)) return data.length > 0;
      if (typeof data === "object") return Object.keys(data).length > 0;
      return true;
    },

    /**
     * Get node data or return default value
     * Usage: getNodeData("HTTP Request", { fallback: true })
     */
    getNodeData: (nodeName: string, defaultValue: any = null): any => {
      const data = nodeData[nodeName];
      return data !== undefined && data !== null ? data : defaultValue;
    },

    /**
     * Get the first executed node's data from a list
     * Usage: firstExecuted(["Path A", "Path B", "Path C"])
     */
    firstExecuted: (nodeNames: string[]): any => {
      for (const name of nodeNames) {
        if (nodeData[name] !== undefined && nodeData[name] !== null) {
          return nodeData[name];
        }
      }
      return null;
    },
  };
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
    const nodeData = context.$node || {};
    const helperFunctions = createNodeHelperFunctions(nodeData);

    // Build the evaluation context with all available data
    const evalContext: Record<string, any> = {
      // Data sources
      $json: context.$json ?? item,
      $node: nodeData,
      $vars: context.$vars || {},
      $workflow: context.$workflow || {},
      $execution: context.$execution || {},
      $itemIndex: context.$itemIndex ?? 0, // Current item index (0-based)
      // Helper functions (direct access like $isExecuted("Node"))
      ...helperFunctions,
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
 * - {{$node["Node Name"].fieldName}} - Access specific node's output by name (recommended, user-friendly)
 * - {{$node["nodeId"].fieldName}} - Access specific node's output by ID (stable, doesn't break on rename)
 * - {{$node["..."].json.fieldName}} - Also supported for backward compatibility (.json is optional)
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
 * // Node reference by name (recommended)
 * resolveValue("{{$node[\"HTTP Request\"].posts}}", null, { $node: { "HTTP Request": { json: { posts: [...] } } } });
 *
 * // Node reference by ID (stable - doesn't break on rename)
 * resolveValue("{{$node[\"abc123\"].title}}", null, { $node: { "abc123": { json: { title: "Test" } } } });
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
    
    // Handle $node["Node Name"].field or $node["Node Name"].json.field format
    // Supports both with and without .json, and both node ID (stable) and node name (user-friendly)
    // Examples: $node["HTTP Request"].posts, $node["HTTP Request"].json.posts
    // Note: $node data is stored directly (not wrapped in .json), so .json is just ignored for compatibility
    const nodeRefMatch = trimmedPath.match(/^\$node\["([^"]+)"\](?:\.json)?(?:\.(.+))?$/);
    if (nodeRefMatch) {
      const nodeIdOrName = nodeRefMatch[1];
      const fieldPath = nodeRefMatch[2];

      if (context?.$node && context.$node[nodeIdOrName]) {
        // Data is stored directly in $node[name], not wrapped in .json
        const nodeData = context.$node[nodeIdOrName];
        if (fieldPath) {
          const result = resolvePath(nodeData, fieldPath);
          return result !== undefined
            ? typeof result === 'object'
              ? JSON.stringify(result)
              : String(result)
            : match;
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

/**
 * ============================================================================
 * EXPRESSION CONTEXT UTILITIES
 * ============================================================================
 * Shared utilities for building expression context (nodeIdToName, nodeOutputs)
 * Used by RealtimeExecutionEngine, ExecutionService, ExecutionEngine, FlowExecutionEngine
 */

/**
 * Workflow node interface for expression context building
 */
export interface WorkflowNodeForContext {
  id: string;
  name?: string;
  mockData?: any;
  mockDataPinned?: boolean;
}

/**
 * Connection interface for expression context building
 */
export interface ConnectionForContext {
  sourceNodeId: string;
  targetNodeId: string;
}

/**
 * Builds a nodeId -> nodeName mapping for $node["Name"] expression support.
 * This allows users to reference nodes by their friendly names instead of IDs.
 * 
 * @param nodes - Array of workflow nodes
 * @returns Map of nodeId -> nodeName
 * 
 * @example
 * const nodes = [{ id: "node-123", name: "HTTP Request" }, { id: "node-456", name: "JSON" }];
 * const map = buildNodeIdToNameMap(nodes);
 * // map.get("node-123") === "HTTP Request"
 */
export function buildNodeIdToNameMap(nodes: WorkflowNodeForContext[]): Map<string, string> {
  const nodeIdToName = new Map<string, string>();
  for (const node of nodes) {
    if (node.id && node.name) {
      nodeIdToName.set(node.id, node.name);
    }
  }
  return nodeIdToName;
}

/**
 * Options for building nodeOutputs map
 */
export interface BuildNodeOutputsOptions {
  /** The target node ID (for single node execution) */
  targetNodeId?: string;
  /** Connections in the workflow */
  connections?: ConnectionForContext[];
  /** Input data from frontend (may contain nodeOutputs) */
  inputData?: {
    main?: any[];
    nodeOutputs?: Record<string, any>;
  };
  /** Workflow nodes (for mock data fallback) */
  nodes?: WorkflowNodeForContext[];
  /** nodeIdToName map for adding name-based entries */
  nodeIdToName?: Map<string, string>;
}

/**
 * Builds a nodeOutputs map for $node expression resolution.
 * This map contains the output data from each node, keyed by both node ID and node name.
 * 
 * Priority:
 * 1. nodeOutputs from frontend (if provided)
 * 2. Pinned mock data from source nodes
 * 3. Input data (for single connection scenarios)
 * 
 * @param options - Options for building the map
 * @returns Map of nodeId/nodeName -> output data
 * 
 * @example
 * const nodeOutputs = buildNodeOutputsMap({
 *   inputData: { main: [...], nodeOutputs: { "JSON": { posts: [...] } } },
 *   nodes: workflowNodes,
 *   nodeIdToName: nodeIdToNameMap,
 * });
 */
export function buildNodeOutputsMap(options: BuildNodeOutputsOptions): Map<string, any> {
  const { targetNodeId, connections, inputData, nodes, nodeIdToName } = options;
  const nodeOutputs = new Map<string, any>();

  // Priority 1: Use nodeOutputs from frontend if provided
  if (inputData?.nodeOutputs && typeof inputData.nodeOutputs === 'object') {
    for (const [key, value] of Object.entries(inputData.nodeOutputs)) {
      nodeOutputs.set(key, value);
    }
    return nodeOutputs;
  }

  // Priority 2 & 3: Build from connections and input data
  if (targetNodeId && connections && nodes) {
    // Find all connections where target node is the target
    const inputConnections = connections.filter(
      (conn) => conn.targetNodeId === targetNodeId
    );

    for (const conn of inputConnections) {
      const sourceNodeId = conn.sourceNodeId;
      const sourceNode = nodes.find((n) => n.id === sourceNodeId);

      if (sourceNode) {
        // Priority 2: Check for pinned mock data
        if (sourceNode.mockData && sourceNode.mockDataPinned) {
          nodeOutputs.set(sourceNodeId, sourceNode.mockData);
          if (sourceNode.name) {
            nodeOutputs.set(sourceNode.name, sourceNode.mockData);
          }
        }
        // Priority 3: Use input data for single connection
        else if (inputData?.main && inputData.main.length > 0 && inputConnections.length === 1) {
          const extractedData = inputData.main.map((item: any) => {
            if (item && item.json !== undefined) {
              return item.json;
            }
            return item;
          });
          const data = extractedData.length === 1 ? extractedData[0] : extractedData;
          nodeOutputs.set(sourceNodeId, data);
          if (sourceNode.name) {
            nodeOutputs.set(sourceNode.name, data);
          }
        }
      }
    }
  }

  // Also add entries by node name using nodeIdToName map
  if (nodeIdToName && nodeOutputs.size > 0) {
    for (const [nodeId, data] of nodeOutputs.entries()) {
      const nodeName = nodeIdToName.get(nodeId);
      if (nodeName && !nodeOutputs.has(nodeName)) {
        nodeOutputs.set(nodeName, data);
      }
    }
  }

  return nodeOutputs;
}

/**
 * Creates a complete expression context for node execution.
 * This is a convenience function that builds both nodeIdToName and nodeOutputs.
 * 
 * @param nodes - Workflow nodes
 * @param options - Additional options for building nodeOutputs
 * @returns Object containing nodeIdToName and nodeOutputs maps
 */
export function buildExpressionContext(
  nodes: WorkflowNodeForContext[],
  options?: Omit<BuildNodeOutputsOptions, 'nodes' | 'nodeIdToName'>
): {
  nodeIdToName: Map<string, string>;
  nodeOutputs: Map<string, any>;
} {
  const nodeIdToName = buildNodeIdToNameMap(nodes);
  const nodeOutputs = buildNodeOutputsMap({
    ...options,
    nodes,
    nodeIdToName,
  });

  return { nodeIdToName, nodeOutputs };
}
