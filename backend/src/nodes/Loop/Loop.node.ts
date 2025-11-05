import {
    NodeDefinition,
    NodeInputData,
    NodeOutputData,
} from "../../types/node.types";

/**
 * Loop Node - Iterate over items and process them
 *
 * This node allows you to iterate over an array of items and process each one.
 * It can loop over items from input data, from a specified field, or repeat N times.
 *
 * How it works:
 * - Takes input items and iterates over them one by one
 * - Can extract an array from a specific field to iterate over
 * - Can repeat a specific number of times (like a for loop)
 * - Outputs each item individually for processing by subsequent nodes
 * - Supports batch processing to group items
 *
 * Examples:
 * 1. Repeat N times:
 *    Repeat: 100
 *    Output: 100 iterations with { iteration: 1, index: 0, total: 100 }, etc.
 *
 * 2. Simple iteration:
 *    Input: [{ "id": 1 }, { "id": 2 }, { "id": 3 }]
 *    Output: Each item sent individually to next node
 *
 * 3. Field extraction:
 *    Input: { "users": [{ "name": "John" }, { "name": "Jane" }] }
 *    Field: "users"
 *    Output: Each user sent individually
 *
 * 4. Batch processing:
 *    Input: [{ "id": 1 }, { "id": 2 }, { "id": 3 }, { "id": 4 }]
 *    Batch Size: 2
 *    Output: [{ "id": 1 }, { "id": 2 }], then [{ "id": 3 }, { "id": 4 }]
 */
export const LoopNode: NodeDefinition = {
    type: "loop",
    displayName: "Loop",
    name: "loop",
    group: ["transform"],
    version: 1,
    description: "Iterate over items and process them individually or in batches",
    icon: "fa:repeat",
    color: "#FF6B6B",
    defaults: {
        mode: "each",
        loopOver: "items",
        fieldName: "",
        batchSize: 1,
        repeatTimes: 10,
    },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
        {
            displayName: "Loop Over",
            name: "loopOver",
            type: "options",
            required: true,
            default: "items",
            description: "What to loop over",
            options: [
                {
                    name: "All Input Items",
                    value: "items",
                    description: "Loop over all items from input",
                },
                {
                    name: "Field Value",
                    value: "field",
                    description: "Loop over array in a specific field",
                },
                {
                    name: "Repeat N Times",
                    value: "repeat",
                    description: "Repeat a specific number of times (like a for loop)",
                },
            ],
        },
        {
            displayName: "Number of Iterations",
            name: "repeatTimes",
            type: "number",
            required: true,
            default: 10,
            placeholder: "e.g., 100",
            description: "How many times to repeat the loop",
            displayOptions: {
                show: {
                    loopOver: ["repeat"],
                },
            },
        },
        {
            displayName: "Field Name",
            name: "fieldName",
            type: "string",
            required: true,
            default: "",
            placeholder: "e.g., users or data.items",
            description:
                "The field containing the array to loop over (supports nested paths like 'data.items')",
            displayOptions: {
                show: {
                    loopOver: ["field"],
                },
            },
        },
        {
            displayName: "Mode",
            name: "mode",
            type: "options",
            required: true,
            default: "each",
            description: "How to process the items",
            options: [
                {
                    name: "Process Each Item",
                    value: "each",
                    description: "Process items one by one",
                },
                {
                    name: "Batch Processing",
                    value: "batch",
                    description: "Process items in batches",
                },
            ],
        },
        {
            displayName: "Batch Size",
            name: "batchSize",
            type: "number",
            required: true,
            default: 10,
            description: "Number of items to process in each batch",
            displayOptions: {
                show: {
                    mode: ["batch"],
                },
            },
        },
    ],
    execute: async function (
        inputData: NodeInputData
    ): Promise<NodeOutputData[]> {
        const loopOver = (await this.getNodeParameter("loopOver")) as string;
        const mode = (await this.getNodeParameter("mode")) as string;

        // Get items to process
        let items = inputData.main || [];

        if (items.length === 1 && items[0] && Array.isArray(items[0])) {
            items = items[0];
        }

        // Process items - extract json if wrapped
        const processedItems = items.map((item: any) => {
            if (item && typeof item === "object" && "json" in item) {
                return item.json;
            }
            return item;
        });

        let itemsToLoop: any[] = [];

        if (loopOver === "repeat") {
            // Repeat N times - generate array
            const repeatTimes = (await this.getNodeParameter("repeatTimes")) as number;

            if (repeatTimes <= 0) {
                throw new Error("Number of iterations must be greater than 0");
            }

            if (repeatTimes > 100000) {
                throw new Error(
                    "Number of iterations cannot exceed 100,000 for safety"
                );
            }

            // Generate array with iteration numbers
            itemsToLoop = Array.from({ length: repeatTimes }, (_, i) => ({
                iteration: i + 1,
                index: i,
                total: repeatTimes,
            }));
        } else if (loopOver === "items") {
            // Loop over all input items
            itemsToLoop = processedItems;
        } else if (loopOver === "field") {
            // Loop over array in a specific field
            const fieldName = (await this.getNodeParameter("fieldName")) as string;

            if (!fieldName) {
                throw new Error("Field name is required when looping over a field");
            }

            // Get the first item to extract the field from
            if (processedItems.length === 0) {
                throw new Error("No input items to extract field from");
            }

            const firstItem = processedItems[0];

            // Resolve nested path
            const fieldValue = this.resolvePath(firstItem, fieldName);

            if (!Array.isArray(fieldValue)) {
                throw new Error(
                    `Field '${fieldName}' is not an array. Got: ${typeof fieldValue}`
                );
            }

            itemsToLoop = fieldValue;
        }

        if (itemsToLoop.length === 0) {
            // No items to loop over, return empty result
            return [{ main: [] }];
        }

        if (mode === "each") {
            // Process each item individually
            // Return all items wrapped in json format
            const outputItems = itemsToLoop.map((item: any) => ({ json: item }));
            return [{ main: outputItems }];
        } else if (mode === "batch") {
            // Process items in batches
            const batchSize = (await this.getNodeParameter("batchSize")) as number;

            if (batchSize <= 0) {
                throw new Error("Batch size must be greater than 0");
            }

            // Split items into batches
            const batches: any[][] = [];
            for (let i = 0; i < itemsToLoop.length; i += batchSize) {
                batches.push(itemsToLoop.slice(i, i + batchSize));
            }

            // Return batches as separate items
            // Each batch is an array of items
            const outputItems = batches.map((batch: any[]) => ({
                json: { items: batch, count: batch.length },
            }));

            return [{ main: outputItems }];
        }

        // Fallback - should not reach here
        return [{ main: [] }];
    },
};
