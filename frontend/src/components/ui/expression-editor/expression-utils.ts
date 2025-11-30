import type { AutocompleteItem } from "./types"

/**
 * Infer the type of a value at a given path in the mock data
 * Supports $json, $input, and $node["NodeName"] formats
 */
export function inferTypeFromPath(
  path: string,
  data: Record<string, unknown>
): "string" | "array" | "number" | "object" | "any" {
  try {
    // Handle $node["NodeName"] format
    const nodeMatch = path.match(/^\$node\["([^"]+)"\](?:\.(.*))?$/)
    if (nodeMatch) {
      const nodeName = nodeMatch[1]
      const remainingPath = nodeMatch[2]
      const nodeData = data.$node as Record<string, unknown>

      if (!nodeData || !nodeData[nodeName]) {
        return "any"
      }

      let current: unknown = (nodeData[nodeName] as Record<string, unknown>)?.json
      if (!current) {
        return "any"
      }

      // Navigate remaining path if any
      if (remainingPath) {
        const parts = remainingPath.split(".").filter(Boolean)
        for (const part of parts) {
          if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
            current = (current as Record<string, unknown>)[part]
          } else {
            return "any"
          }
        }
      }

      if (typeof current === "string") return "string"
      if (Array.isArray(current)) return "array"
      if (typeof current === "number") return "number"
      if (typeof current === "object" && current !== null) return "object"
      return "any"
    }

    const parts = path
      .replace(/\[["']?/g, ".")
      .replace(/["']?\]/g, "")
      .split(".")
      .filter(Boolean)
    let current: unknown = data

    for (const part of parts) {
      if (!part) continue
      if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part]
      } else {
        return "any"
      }
    }

    if (typeof current === "string") return "string"
    if (Array.isArray(current)) return "array"
    if (typeof current === "number") return "number"
    if (typeof current === "object" && current !== null) return "object"
    return "any"
  } catch {
    return "any"
  }
}

/**
 * Get autocomplete properties from a path in the mock data
 * Supports $json, $input, and $node["NodeName"] formats
 */
export function getPropertiesFromPath(
  path: string,
  data: Record<string, unknown>
): AutocompleteItem[] {
  try {
    // Handle $node["NodeName"] format
    const nodeMatch = path.match(/^\$node\["([^"]+)"\](?:\.(.*))?$/)
    if (nodeMatch) {
      const nodeName = nodeMatch[1]
      const remainingPath = nodeMatch[2]
      const nodeData = data.$node as Record<string, unknown>

      if (!nodeData || !nodeData[nodeName]) {
        return []
      }

      let current: unknown = (nodeData[nodeName] as Record<string, unknown>)?.json
      if (!current) {
        return []
      }

      // Navigate remaining path if any
      if (remainingPath) {
        const parts = remainingPath.split(".").filter(Boolean)
        for (const part of parts) {
          if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
            current = (current as Record<string, unknown>)[part]
          } else {
            return []
          }
        }
      }

      return objectToAutocompleteItems(current)
    }

    const parts = path
      .replace(/\[["']?/g, ".")
      .replace(/["']?\]/g, "")
      .split(".")
      .filter(Boolean)

    let current: unknown = data

    if (parts[0] === "$json") {
      current = data.$json
      parts.shift()
    } else if (parts[0] === "$input") {
      current = data.$input
      parts.shift()
    } else {
      return []
    }

    for (const part of parts) {
      if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part]
      } else {
        return []
      }
    }

    return objectToAutocompleteItems(current)
  } catch {
    return []
  }
}

/**
 * Convert an object to autocomplete items
 */
function objectToAutocompleteItems(current: unknown): AutocompleteItem[] {
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return Object.entries(current as Record<string, unknown>).map(([key, value]) => {
      let type: AutocompleteItem["type"] = "property"
      let description = ""

      if (typeof value === "string") {
        description = `String: "${value.length > 20 ? value.slice(0, 20) + "..." : value}"`
      } else if (typeof value === "number") {
        description = `Number: ${value}`
      } else if (typeof value === "boolean") {
        description = `Boolean: ${value}`
      } else if (Array.isArray(value)) {
        description = `Array[${value.length}]`
        type = "array"
      } else if (typeof value === "object" && value !== null) {
        description = `Object {${Object.keys(value).length} keys}`
        type = "object"
      }

      return {
        label: key,
        type,
        description,
        insertText: key,
      }
    })
  }

  return []
}
