import { WorkflowNode } from "@/types";

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Generates a unique node name by adding an increment suffix if the name already exists.
 * Examples:
 * - "HTTP Request" -> "HTTP Request 1" (if "HTTP Request" exists)
 * - "HTTP Request 1" -> "HTTP Request 2" (if "HTTP Request 1" exists)
 * - "My Node" -> "My Node" (if no conflict)
 *
 * @param desiredName - The name the user wants to use
 * @param existingNames - Set or array of existing node names in the workflow
 * @param excludeNodeId - Optional node ID to exclude from conflict check (for rename operations)
 * @param nodes - Optional array of nodes (alternative to existingNames)
 * @returns A unique name, possibly with an increment suffix
 */
export function ensureUniqueNodeName(
  desiredName: string,
  existingNames?: Set<string> | string[],
  excludeNodeId?: string,
  nodes?: WorkflowNode[]
): string {
  // Build the set of existing names
  let nameSet: Set<string>;

  if (existingNames instanceof Set) {
    nameSet = existingNames;
  } else if (Array.isArray(existingNames)) {
    nameSet = new Set(existingNames);
  } else if (nodes) {
    nameSet = new Set(
      nodes
        .filter((n) => n.id !== excludeNodeId)
        .map((n) => n.name)
    );
  } else {
    return desiredName; // No existing names to check against
  }

  // If the name doesn't exist, return as-is
  if (!nameSet.has(desiredName)) {
    return desiredName;
  }

  // Extract base name and existing number suffix
  const match = desiredName.match(/^(.+?)\s*(\d+)?$/);
  const baseName = match ? match[1].trim() : desiredName;

  // Find the next available number
  let counter = 1;
  let newName = `${baseName} ${counter}`;

  while (nameSet.has(newName)) {
    counter++;
    newName = `${baseName} ${counter}`;
  }

  return newName;
}

/**
 * Recursively updates all $node["OldName"] references in an object
 * to use the new name $node["NewName"]
 */
function updateExpressionsInValue(
  value: unknown,
  pattern: RegExp,
  replacement: string
): unknown {
  if (typeof value === "string") {
    return value.replace(pattern, replacement);
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      updateExpressionsInValue(item, pattern, replacement)
    );
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const key in value) {
      result[key] = updateExpressionsInValue(
        (value as Record<string, unknown>)[key],
        pattern,
        replacement
      );
    }
    return result;
  }

  return value;
}

/**
 * Updates all $node["oldName"] references to $node["newName"] in all nodes' parameters.
 * This should be called when a node is renamed to keep expressions valid.
 *
 * @param nodes - Array of workflow nodes
 * @param oldName - The old node name being replaced
 * @param newName - The new node name to use
 * @returns Updated array of nodes with references updated
 */
export function updateNodeNameReferences(
  nodes: WorkflowNode[],
  oldName: string,
  newName: string
): WorkflowNode[] {
  // Pattern matches $node["OldName"] - handles both single and double quotes
  const doubleQuotePattern = new RegExp(
    `\\$node\\["${escapeRegex(oldName)}"\\]`,
    "g"
  );
  const singleQuotePattern = new RegExp(
    `\\$node\\['${escapeRegex(oldName)}'\\]`,
    "g"
  );

  const doubleQuoteReplacement = `$node["${newName}"]`;
  const singleQuoteReplacement = `$node['${newName}']`;

  return nodes.map((node) => {
    // Update parameters
    let updatedParameters = updateExpressionsInValue(
      node.parameters,
      doubleQuotePattern,
      doubleQuoteReplacement
    ) as Record<string, unknown>;

    updatedParameters = updateExpressionsInValue(
      updatedParameters,
      singleQuotePattern,
      singleQuoteReplacement
    ) as Record<string, unknown>;

    return {
      ...node,
      parameters: updatedParameters,
    };
  });
}
