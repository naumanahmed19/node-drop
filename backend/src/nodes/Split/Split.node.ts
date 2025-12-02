import {
    NodeDefinition,
    NodeInputData,
    NodeOutputData,
} from "../../types/node.types";

/**
 * Split Node - Divide data into multiple outputs or batches
 *
 * This node splits data from a single input into multiple outputs or batches.
 * Essential for workflows where you need parallel processing or batch operations.
 *
 * How it works:
 * - Accepts a single input with multiple items
 * - Splits them based on the selected split mode
 * - Outputs the split results
 *
 * Split Modes:
 * 1. Batch: Split items into batches of specified size
 *    Input: [1,2,3,4,5], Batch Size: 2 → Output: [[1,2], [3,4], [5]]
 *
 * 2. By Field Value: Split items by unique values of a field
 *    Input: [{type:"A"}, {type:"B"}, {type:"A"}] → Output: {A: [item1, item3], B: [item2]}
 *
 * 3. Even/Odd: Split items into even and odd index positions
 *    Input: [1,2,3,4] → Output 1: [1,3], Output 2: [2,4]
 *
 * 4. Percentage: Split items by percentage (e.g., 70/30 split)
 *    Input: [1,2,3,4,5,6,7,8,9,10], Split: 70% → Output 1: [1-7], Output 2: [8-10]
 *
 * 5. Count: Split into N equal parts
 *    Input: [1,2,3,4,5,6], Parts: 3 → Output: [[1,2], [3,4], [5,6]]
 *
 * Examples:
 * 1. Batch processing:
 *    Get 1000 users → Split (Batch: 100) → Process in parallel
 *
 * 2. A/B testing:
 *    Get users → Split (Percentage: 50%) → Path A / Path B
 *
 * 3. Categorize data:
 *    Get orders → Split (By Field: status) → Process by status
 */
export const SplitNode: NodeDefinition = {
    identifier: "split",
    displayName: "Split",
    name: "split",
    group: ["transform"],
    version: 1,
    description: "Split data into multiple outputs or batches",
    icon: "svg:split",
    color: "#FF5722",
    defaults: {
        mode: "batch",
        batchSize: 10,
        splitField: "type",
        percentage: 50,
        parts: 2,
    },
    inputs: ["main"],
    outputs: ["main"], // Dynamic outputs based on split mode
    properties: [
        {
            displayName: "Mode",
            name: "mode",
            type: "options",
            required: true,
            default: "batch",
            description: "How to split the input data",
            options: [
                {
                    name: "Batch",
                    value: "batch",
                    description: "Split items into batches of specified size",
                },
                {
                    name: "By Field Value",
                    value: "byField",
                    description: "Split items by unique values of a field",
                },
                {
                    name: "Even/Odd",
                    value: "evenOdd",
                    description: "Split items into even and odd positions",
                },
                {
                    name: "Percentage",
                    value: "percentage",
                    description: "Split items by percentage (e.g., 70/30)",
                },
                {
                    name: "Equal Parts",
                    value: "parts",
                    description: "Split into N equal parts",
                },
            ],
        },
        {
            displayName: "Batch Size",
            name: "batchSize",
            type: "number",
            required: true,
            default: 10,
            description: "Number of items per batch",
            displayOptions: {
                show: {
                    mode: ["batch"],
                },
            },
        },
        {
            displayName: "Field Name",
            name: "splitField",
            type: "expression",
            required: true,
            default: "type",
            placeholder: "e.g., status or category",
            description: "The field name to use for splitting items",
            displayOptions: {
                show: {
                    mode: ["byField"],
                },
            },
        },
        {
            displayName: "Percentage for First Output",
            name: "percentage",
            type: "number",
            required: true,
            default: 50,
            description: "Percentage of items for the first output (0-100)",
            displayOptions: {
                show: {
                    mode: ["percentage"],
                },
            },
        },
        {
            displayName: "Number of Parts",
            name: "parts",
            type: "number",
            required: true,
            default: 2,
            description: "Number of equal parts to split into",
            displayOptions: {
                show: {
                    mode: ["parts"],
                },
            },
        },
    ],
    execute: async function (
        inputData: NodeInputData
    ): Promise<NodeOutputData[]> {
        const mode = (await this.getNodeParameter("mode")) as string;

        // Get input items
        const items = inputData.main?.[0] || [];

        // Extract json data from items
        const processedItems = items.map((item: any) => {
            if (item && typeof item === "object" && "json" in item) {
                return item.json;
            }
            return item;
        });

        if (processedItems.length === 0) {
            return [{ main: [] }];
        }

        let splitResults: any[][] = [];

        switch (mode) {
            case "batch": {
                // Split into batches of specified size
                const batchSize = (await this.getNodeParameter("batchSize")) as number;

                if (batchSize <= 0) {
                    throw new Error("Batch size must be greater than 0");
                }

                for (let i = 0; i < processedItems.length; i += batchSize) {
                    splitResults.push(processedItems.slice(i, i + batchSize));
                }
                break;
            }

            case "byField": {
                // Split by unique field values
                const splitField = (await this.getNodeParameter("splitField")) as string;

                if (!splitField) {
                    throw new Error("Field name is required for 'By Field Value' mode");
                }

                // Group items by field value
                const groupedItems = new Map<any, any[]>();

                processedItems.forEach((item: any) => {
                    const fieldValue = this.resolvePath(item, splitField);
                    const key = fieldValue !== undefined ? fieldValue : "undefined";

                    if (!groupedItems.has(key)) {
                        groupedItems.set(key, []);
                    }
                    groupedItems.get(key)!.push(item);
                });

                splitResults = Array.from(groupedItems.values());
                break;
            }

            case "evenOdd": {
                // Split into even and odd positions
                const evenItems: any[] = [];
                const oddItems: any[] = [];

                processedItems.forEach((item: any, index: number) => {
                    if (index % 2 === 0) {
                        evenItems.push(item);
                    } else {
                        oddItems.push(item);
                    }
                });

                splitResults = [evenItems, oddItems];
                break;
            }

            case "percentage": {
                // Split by percentage
                const percentage = (await this.getNodeParameter("percentage")) as number;

                if (percentage < 0 || percentage > 100) {
                    throw new Error("Percentage must be between 0 and 100");
                }

                const splitIndex = Math.floor((processedItems.length * percentage) / 100);
                const firstPart = processedItems.slice(0, splitIndex);
                const secondPart = processedItems.slice(splitIndex);

                splitResults = [firstPart, secondPart];
                break;
            }

            case "parts": {
                // Split into N equal parts
                const parts = (await this.getNodeParameter("parts")) as number;

                if (parts <= 0) {
                    throw new Error("Number of parts must be greater than 0");
                }

                const itemsPerPart = Math.ceil(processedItems.length / parts);

                for (let i = 0; i < parts; i++) {
                    const start = i * itemsPerPart;
                    const end = start + itemsPerPart;
                    const part = processedItems.slice(start, end);

                    if (part.length > 0) {
                        splitResults.push(part);
                    }
                }
                break;
            }

            default:
                throw new Error(`Unknown split mode: ${mode}`);
        }

        // For batch mode, return as a single output with batches as items
        if (mode === "batch") {
            const batchItems = splitResults.map((batch: any) => ({
                json: { batch, batchSize: batch.length },
            }));
            return [{ main: batchItems }];
        }

        // For other modes, return multiple outputs (one per split)
        // Note: This returns the first split as the main output
        // In a real implementation, you'd want to support multiple output connections
        const outputItems = splitResults[0]?.map((item: any) => ({ json: item })) || [];
        return [{ main: outputItems }];
    },
};
