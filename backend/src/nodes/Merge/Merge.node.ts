import {
    NodeDefinition,
    NodeInputData,
    NodeOutputData,
} from "../../types/node.types";

/**
 * Merge Node - Combine data from multiple inputs
 *
 * This node merges data from multiple input connections into a single output.
 * Essential for workflows where you need to combine results from parallel branches.
 *
 * How it works:
 * - Accepts multiple input connections
 * - Waits for all inputs to arrive (by default)
 * - Combines them based on the selected merge mode
 * - Outputs the merged result
 *
 * Merge Modes:
 * 1. Append: Concatenate all items from all inputs (default)
 *    Input 1: [A, B], Input 2: [C, D] → Output: [A, B, C, D]
 *
 * 2. Merge by Position: Merge items at the same index
 *    Input 1: [{a:1}, {a:2}], Input 2: [{b:1}, {b:2}] → Output: [{a:1, b:1}, {a:2, b:2}]
 *
 * 3. Merge by Key: Merge items with matching key values
 *    Input 1: [{id:1, name:"A"}], Input 2: [{id:1, age:30}] → Output: [{id:1, name:"A", age:30}]
 *
 * 4. Keep First: Only keep items from the first input
 *    Input 1: [A, B], Input 2: [C, D] → Output: [A, B]
 *
 * 5. Keep Last: Only keep items from the last input
 *    Input 1: [A, B], Input 2: [C, D] → Output: [C, D]
 *
 * Wait Behavior:
 * - Wait for All: Waits for all inputs before executing (default)
 * - Pass Through: Outputs as soon as any input arrives
 *
 * Examples:
 * 1. Combine API results:
 *    API 1 (users) → Merge (Append) ← API 2 (admins)
 *
 * 2. Enrich data:
 *    Get User → Merge (By Key: id) ← Get User Details
 *
 * 3. Parallel processing:
 *    Process A → Merge (Append) ← Process B
 */
export const MergeNode: NodeDefinition = {
    type: "merge",
    displayName: "Merge",
    name: "merge",
    group: ["transform"],
    version: 1,
    description: "Merge data from multiple inputs",
    icon: "fa:code-branch",
    color: "#9C27B0",
    defaults: {
        mode: "append",
        waitForAll: true,
        mergeByKey: "id",
    },
    inputs: ["main"], // Single input that accepts multiple connections
    outputs: ["main"],
    properties: [
        {
            displayName: "Mode",
            name: "mode",
            type: "options",
            required: true,
            default: "append",
            description: "How to merge the data from multiple inputs",
            options: [
                {
                    name: "Append",
                    value: "append",
                    description: "Concatenate all items from all inputs",
                },
                {
                    name: "Merge by Position",
                    value: "mergeByPosition",
                    description: "Merge items at the same index position",
                },
                {
                    name: "Merge by Key",
                    value: "mergeByKey",
                    description: "Merge items with matching key values",
                },
                {
                    name: "Keep First Input",
                    value: "keepFirst",
                    description: "Only keep items from the first input",
                },
                {
                    name: "Keep Last Input",
                    value: "keepLast",
                    description: "Only keep items from the last input",
                },
            ],
        },
        {
            displayName: "Merge Key",
            name: "mergeByKey",
            type: "string",
            required: true,
            default: "id",
            placeholder: "e.g., id or userId",
            description: "The field name to use for matching items across inputs",
            displayOptions: {
                show: {
                    mode: ["mergeByKey"],
                },
            },
        },
        {
            displayName: "Wait for All Inputs",
            name: "waitForAll",
            type: "boolean",
            required: true,
            default: true,
            description: "Whether to wait for all inputs before merging (recommended)",
        },
    ],
    execute: async function (
        inputData: NodeInputData
    ): Promise<NodeOutputData[]> {
        const mode = (await this.getNodeParameter("mode")) as string;
        const waitForAll = (await this.getNodeParameter("waitForAll")) as boolean;

        // Get all inputs - main is a 2D array where each sub-array is from a different connection
        // main[0] = items from first connection
        // main[1] = items from second connection, etc.
        const allInputs = inputData.main || [];

        // If waitForAll is true and we don't have all inputs yet, wait
        // (This would be handled by the workflow engine in a real implementation)
        if (waitForAll && allInputs.length === 0) {
            return [{ main: [] }];
        }

        // Process each input connection - extract items
        const processedInputs = allInputs.map((inputConnection: any) => {
            if (!inputConnection) return [];

            // inputConnection is an array of items from one connection
            let items = Array.isArray(inputConnection) ? inputConnection : [inputConnection];

            // Extract json if wrapped
            return items.map((item: any) => {
                if (item && typeof item === "object" && "json" in item) {
                    return item.json;
                }
                return item;
            });
        });

        let mergedItems: any[] = [];

        switch (mode) {
            case "append": {
                // Concatenate all items from all inputs
                mergedItems = processedInputs.flat();
                break;
            }

            case "mergeByPosition": {
                // Merge items at the same index
                const maxLength = Math.max(
                    ...processedInputs.map((input) => input.length)
                );

                for (let i = 0; i < maxLength; i++) {
                    const mergedItem: any = {};

                    processedInputs.forEach((input) => {
                        if (i < input.length && input[i]) {
                            Object.assign(mergedItem, input[i]);
                        }
                    });

                    if (Object.keys(mergedItem).length > 0) {
                        mergedItems.push(mergedItem);
                    }
                }
                break;
            }

            case "mergeByKey": {
                // Merge items with matching key values
                const mergeKey = (await this.getNodeParameter("mergeByKey")) as string;

                if (!mergeKey) {
                    throw new Error("Merge key is required for 'Merge by Key' mode");
                }

                // Create a map of items by key
                const itemsByKey = new Map<any, any>();

                processedInputs.forEach((input) => {
                    input.forEach((item: any) => {
                        const keyValue = this.resolvePath(item, mergeKey);

                        if (keyValue !== undefined) {
                            if (itemsByKey.has(keyValue)) {
                                // Merge with existing item
                                const existing = itemsByKey.get(keyValue);
                                itemsByKey.set(keyValue, { ...existing, ...item });
                            } else {
                                // Add new item
                                itemsByKey.set(keyValue, { ...item });
                            }
                        }
                    });
                });

                mergedItems = Array.from(itemsByKey.values());
                break;
            }

            case "keepFirst": {
                // Only keep items from the first input
                mergedItems = processedInputs[0] || [];
                break;
            }

            case "keepLast": {
                // Only keep items from the last input
                mergedItems = processedInputs[processedInputs.length - 1] || [];
                break;
            }

            default:
                throw new Error(`Unknown merge mode: ${mode}`);
        }

        // Wrap items in the expected format
        const outputItems = mergedItems.map((item: any) => ({ json: item }));

        return [{ main: outputItems }];
    },
};
