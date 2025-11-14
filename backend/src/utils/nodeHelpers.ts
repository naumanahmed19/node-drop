/**
 * Node Helpers Utility
 *
 * Common utility functions that can be used across all node implementations.
 * These helpers provide reusable functionality for data manipulation and processing.
 */

/**
 * Resolves placeholder expressions in a value string using data from an item or input array.
 *
 * Supports template syntax like {{json.fieldName}} or {{json.nested.path}}
 * and will replace them with actual values from the item data.
 * 
 * Also supports array-based input access for multiple inputs: {{json[0].fieldName}}
 *
 * @param value - The value string that may contain placeholders like {{json.fieldName}}
 * @param item - The data item to extract values from (can be a single item or array of items for multiple inputs)
 * @returns The resolved value with placeholders replaced by actual data
 *
 * @example
 * const item = { name: "John", address: { city: "NYC" } };
 * resolveValue("Hello {{json.name}}", item); // Returns: "Hello John"
 * resolveValue("City: {{json.address.city}}", item); // Returns: "City: NYC"
 * 
 * // Multiple inputs (item is an array)
 * const items = [{ name: "John" }, { name: "Jane" }];
 * resolveValue("{{json[0].name}} and {{json[1].name}}", items); // Returns: "John and Jane"
 * 
 * resolveValue("Static text", item); // Returns: "Static text"
 */
export function resolveValue(value: string | any, item: any): any {
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

  // Replace placeholders like {{json.fieldName}} or {{json[0].fieldName}}
  return decodedValue.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    // Check if this is array-based access: json[0].field
    const arrayAccessMatch = path.match(/^json\[(\d+)\]\.(.+)$/);
    
    if (arrayAccessMatch) {
      // Array-based access for multiple inputs
      const inputIndex = parseInt(arrayAccessMatch[1], 10);
      const fieldPath = arrayAccessMatch[2];
      
      // If item is an array (multiple inputs), access the specific input
      if (Array.isArray(item)) {
        if (inputIndex >= item.length) {
          // Input index out of bounds
          return match;
        }
        
        const targetItem = item[inputIndex];
        const result = resolvePath(targetItem, fieldPath);
        return result !== undefined ? String(result) : match;
      } else {
        // Item is not an array, can't use array access
        return match;
      }
    }
    
    // Standard object-based access: json.field
    const parts = path.split(".");
    let result = item;

    // Skip 'json' prefix if it exists, since we're already working with the json data
    let startIndex = 0;
    if (parts[0] === "json") {
      startIndex = 1;
    }

    // Navigate through the nested path
    for (let i = startIndex; i < parts.length; i++) {
      const part = parts[i];

      if (result && typeof result === "object" && part in result) {
        result = result[part];
      } else {
        // Path not found, return the original placeholder
        return match;
      }
    }

    // Convert the result to string if it exists, otherwise return the original placeholder
    return result !== undefined ? String(result) : match;
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
