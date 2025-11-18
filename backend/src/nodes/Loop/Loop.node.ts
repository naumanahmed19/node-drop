import {
    NodeDefinition,
    NodeInputData,
    NodeOutputData,
} from "../../types/node.types";

/**
 * Loop Node - Iterate over items and process them one at a time
 *
 * This node creates a true workflow loop where each iteration flows through
 * downstream nodes before moving to the next iteration.
 *
 * How it works:
 * - Outputs ONE item at a time through the "loop" output
 * - Downstream nodes process that single item
 * - When downstream processing completes, next iteration begins
 * - When all iterations complete, outputs through "done" output
 *
 * Outputs:
 * - "loop": Outputs current iteration item (connects to nodes that process each iteration)
 * - "done": Outputs when all iterations complete (connects to nodes that run after loop)
 *
 * Examples:
 * 1. Repeat N times with condition:
 *    Loop (Repeat 100) → If ({{$json.iteration}} == 7) → Stop/Continue
 *
 * 2. Process array items one by one:
 *    Input: [{ "id": 1 }, { "id": 2 }, { "id": 3 }]
 *    Each item processed individually through downstream nodes
 *
 * 3. API pagination:
 *    Loop (Repeat 10) → HTTP Request (page={{$json.iteration}}) → Process Data
 */
export const LoopNode: NodeDefinition = {
    identifier: "loop",
    displayName: "Loop",
    name: "loop",
    group: ["transform"],
    version: 1,
    description: "Iterate over items one at a time through downstream nodes",
    icon: "fa:repeat",
    color: "#FF6B6B",
    defaults: {
        loopOver: "items",
        fieldName: "",
        batchSize: 1,
        repeatTimes: 10,
    },
    inputs: ["main"],
    outputs: ["loop", "done"],
    outputNames: ["Loop", "Done"],
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
            displayName: "Batch Size",
            name: "batchSize",
            type: "number",
            required: true,
            default: 1,
            description: "Number of items to process in each iteration (1 = one at a time)",
            displayOptions: {
                show: {
                    loopOver: ["items", "field"],
                },
            },
        },
    ],
    execute: async function (
        inputData: NodeInputData
    ): Promise<NodeOutputData[]> {
        const loopOver = (await this.getNodeParameter("loopOver")) as string;
        const batchSize = (await this.getNodeParameter("batchSize")) as number;

        // Get or initialize loop state
        const loopState = (this.getNodeState?.() || {}) as {
            itemsToLoop?: any[];
            currentIndex?: number;
            totalItems?: number;
        };

        // First execution - prepare items to loop
        if (!loopState.itemsToLoop) {
            let itemsToLoop: any[] = [];

            if (loopOver === "repeat") {
                // Repeat N times - generate array (ignore input data)
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
            } else {
                // For "items" and "field" modes, process input data
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

                if (loopOver === "items") {
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
            }

            if (itemsToLoop.length === 0) {
                // No items to loop over, output through "done" only
                return [
                    { main: [] }, // loop output (empty)
                    { main: [{ json: { completed: true, totalIterations: 0 } }] }, // done output
                ];
            }

            // Initialize loop state
            loopState.itemsToLoop = itemsToLoop;
            loopState.currentIndex = 0;
            loopState.totalItems = itemsToLoop.length;

            // Save state for next iteration
            this.setNodeState?.(loopState);
        }

        // Get current batch of items
        const currentIndex = loopState.currentIndex || 0;
        const itemsToLoop = loopState.itemsToLoop || [];
        const totalItems = loopState.totalItems || 0;

        // Check if loop is complete
        if (currentIndex >= totalItems) {
            // Clear state
            this.setNodeState?.({});

            // Output through "done" output only
            return [
                { main: [] }, // loop output (empty)
                { main: [{ json: { completed: true, totalIterations: totalItems } }] }, // done output
            ];
        }

        // Get current batch
        const endIndex = Math.min(currentIndex + batchSize, totalItems);
        const currentBatch = itemsToLoop.slice(currentIndex, endIndex);

        // Update state for next iteration
        loopState.currentIndex = endIndex;
        this.setNodeState?.(loopState);

        // Prepare output items with metadata
        const outputItems = currentBatch.map((item: any, batchIdx: number) => {
            const globalIndex = currentIndex + batchIdx;
            return {
                json: {
                    ...item,
                    $index: globalIndex,
                    $iteration: globalIndex + 1,
                    $total: totalItems,
                    $isFirst: globalIndex === 0,
                    $isLast: globalIndex === totalItems - 1,
                    $batchIndex: batchIdx,
                    $batchSize: currentBatch.length,
                },
            };
        });

        // Output through "loop" output (first output)
        // "done" output remains empty until loop completes
        return [
            { main: outputItems }, // loop output
            { main: [] }, // done output (empty during iteration)
        ];
    },
};
