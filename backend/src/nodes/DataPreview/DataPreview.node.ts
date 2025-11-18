import {
    NodeDefinition,
    NodeInputData,
    NodeOutputData,
} from "../../types/node.types";

/**
 * Data Preview Node
 *
 * Displays data output in a terminal-like collapsible format.
 * Perfect for testing loops, counters, and debugging data transformations.
 */
export const DataPreviewNode: NodeDefinition = {
    identifier: "data-preview",
    displayName: "Data Preview",
    name: "dataPreview",
    group: ["transform"],
    version: 1,
    description: "Display data in a terminal-like collapsible preview for testing and debugging",
    icon: "fa:terminal",
    color: "#4CAF50",
    outputComponent: "DataPreviewOutput", // Custom output renderer
    defaults: {
        previewSource: "all",
        previewFormat: "json",
        maxLines: 100,
        showTimestamp: true,
        autoCollapse: false,
        appendMode: false,
        maxHistoryItems: 10,
    },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
        {
            displayName: "Preview Source",
            name: "previewSource",
            type: "options",
            required: true,
            default: "all",
            description: "Which input data to preview",
            options: [
                {
                    name: "All Items",
                    value: "all",
                    description: "Preview all items from input",
                },
                {
                    name: "First Item Only",
                    value: "first",
                    description: "Preview only the first item",
                },
                {
                    name: "Last Item Only",
                    value: "last",
                    description: "Preview only the last item",
                },
            ],
        },
        {
            displayName: "Preview Format",
            name: "previewFormat",
            type: "options",
            required: true,
            default: "json",
            description: "How to format the data in the preview",
            options: [
                {
                    name: "JSON (Pretty)",
                    value: "json",
                    description: "Format as pretty-printed JSON",
                },
                {
                    name: "JSON (Compact)",
                    value: "json-compact",
                    description: "Format as compact JSON",
                },
                {
                    name: "Text",
                    value: "text",
                    description: "Display as plain text",
                },
                {
                    name: "Table",
                    value: "table",
                    description: "Display as ASCII table (for arrays of objects)",
                },
            ],
        },
        {
            displayName: "Max Lines",
            name: "maxLines",
            type: "number",
            required: false,
            default: 100,
            description: "Maximum number of lines to display (prevents overflow, range: 10-1000)",
        },
        {
            displayName: "Show Timestamp",
            name: "showTimestamp",
            type: "boolean",
            required: false,
            default: true,
            description: "Include execution timestamp in the preview",
        },
        {
            displayName: "Auto Collapse",
            name: "autoCollapse",
            type: "boolean",
            required: false,
            default: false,
            description: "Start with preview collapsed by default",
        },
        {
            displayName: "Append Mode",
            name: "appendMode",
            type: "boolean",
            required: false,
            default: false,
            description: "Append new data to history instead of replacing (latest shown on top)",
        },
        {
            displayName: "Max History Items",
            name: "maxHistoryItems",
            type: "number",
            required: false,
            default: 10,
            description: "Maximum number of historical previews to keep in append mode (range: 1-50)",
            displayOptions: {
                show: {
                    appendMode: [true],
                },
            },
        },

    ],
    execute: async function (
        inputData: NodeInputData
    ): Promise<NodeOutputData[]> {
        const previewSource = await this.getNodeParameter("previewSource") as string;
        const previewFormat = await this.getNodeParameter("previewFormat") as string;
        const maxLines = await this.getNodeParameter("maxLines") as number;
        const showTimestamp = await this.getNodeParameter("showTimestamp") as boolean;
        const autoCollapse = await this.getNodeParameter("autoCollapse") as boolean;
        const appendMode = await this.getNodeParameter("appendMode") as boolean;
        const maxHistoryItems = await this.getNodeParameter("maxHistoryItems") as number;

        // Get input data
        // inputData.main is the array of items from the input connection
        const items: any[] = inputData.main || [];

        // Extract the actual JSON data from items
        const extractedItems = items.map((item: any) => item?.json || item);

        // Filter items based on preview source
        let itemsToPreview: any[];
        switch (previewSource) {
            case "first":
                itemsToPreview = extractedItems.length > 0 ? [extractedItems[0]] : [];
                break;
            case "last":
                itemsToPreview = extractedItems.length > 0 ? [extractedItems[extractedItems.length - 1]] : [];
                break;
            case "all":
            default:
                itemsToPreview = extractedItems;
                break;
        }

        // Preview selected input data
        const dataToPreview = itemsToPreview;

        // Format the data based on selected format
        let formattedData: string;
        let lineCount: number;

        try {
            switch (previewFormat) {
                case "json":
                    formattedData = JSON.stringify(dataToPreview, null, 2);
                    break;

                case "json-compact":
                    formattedData = JSON.stringify(dataToPreview);
                    break;

                case "text":
                    formattedData = typeof dataToPreview === "string"
                        ? dataToPreview
                        : String(dataToPreview);
                    break;

                case "table":
                    formattedData = formatAsTable(dataToPreview);
                    break;

                default:
                    formattedData = JSON.stringify(dataToPreview, null, 2);
            }

            // Count lines and truncate if necessary
            const lines = formattedData.split("\n");
            lineCount = lines.length;

            if (lineCount > maxLines) {
                formattedData = lines.slice(0, maxLines).join("\n") +
                    `\n\n... (${lineCount - maxLines} more lines truncated)`;
                lineCount = maxLines;
            }

        } catch (error) {
            formattedData = `Error formatting data: ${error instanceof Error ? error.message : "Unknown error"
                }`;
            lineCount = 1;
        }

        // Prepare current preview metadata
        const currentPreview = {
            id: `preview-${Date.now()}`,
            preview: formattedData,
            format: previewFormat,
            lineCount: lineCount,
            timestamp: new Date().toISOString(),
            metadata: {
                inputItems: Array.isArray(items) ? items.length : 0,
                previewedItems: Array.isArray(itemsToPreview) ? itemsToPreview.length : 0,
                previewSource: previewSource,
                dataType: typeof dataToPreview,
                isArray: Array.isArray(dataToPreview),
                truncated: lineCount >= maxLines,
            },
        };

        // Handle append mode
        let outputMetadata;
        if (appendMode) {
            // Get existing history from node state (persists across loop iterations)
            const nodeState = (this.getNodeState?.() || {}) as { previewHistory?: any[] };
            const existingHistory = nodeState.previewHistory || [];
            
            // Add current preview to the beginning (latest on top)
            const updatedHistory = [currentPreview, ...existingHistory];
            
            // Limit history size
            const trimmedHistory = updatedHistory.slice(0, maxHistoryItems);
            
            // Save updated history to node state
            if (this.setNodeState) {
                this.setNodeState({ previewHistory: trimmedHistory });
            }
            
            outputMetadata = {
                ...currentPreview,
                appendMode: true,
                previewHistory: trimmedHistory,
                historyCount: trimmedHistory.length,
            };
        } else {
            // Clear history when not in append mode
            if (this.setNodeState) {
                this.setNodeState({});
            }
            
            outputMetadata = {
                ...currentPreview,
                appendMode: false,
                autoCollapse: autoCollapse,
            };
        }

        this.logger.info("Data preview processed", {
            format: previewFormat,
            lineCount: lineCount,
            inputItems: Array.isArray(items) ? items.length : 0,
            dataToPreviewLength: Array.isArray(dataToPreview) ? dataToPreview.length : 0,
            appendMode: appendMode,
            historyCount: appendMode && 'historyCount' in outputMetadata ? outputMetadata.historyCount : 0,
        });

        // Output the formatted preview as the main JSON data
        const outputItems = [{
            json: outputMetadata
        }];

        return [{ main: outputItems }];
    },
};

/**
 * Helper function to format data as ASCII table
 */
function formatAsTable(data: any): string {
    if (!Array.isArray(data)) {
        return "Table format requires an array of objects";
    }

    if (data.length === 0) {
        return "Empty array";
    }

    // Get all unique keys from all objects
    const keys = Array.from(
        new Set(data.flatMap(item =>
            typeof item === "object" && item !== null ? Object.keys(item) : []
        ))
    );

    if (keys.length === 0) {
        return "No object properties to display";
    }

    // Calculate column widths
    const columnWidths: { [key: string]: number } = {};
    keys.forEach(key => {
        columnWidths[key] = Math.max(
            key.length,
            ...data.map(item => {
                const value = item?.[key];
                return String(value ?? "").length;
            })
        );
        // Limit column width to 50 characters
        columnWidths[key] = Math.min(columnWidths[key], 50);
    });

    // Build table
    const lines: string[] = [];

    // Header separator
    const separator = "+" + keys.map(key => "-".repeat(columnWidths[key] + 2)).join("+") + "+";

    // Header
    lines.push(separator);
    lines.push(
        "| " +
        keys.map(key => key.padEnd(columnWidths[key])).join(" | ") +
        " |"
    );
    lines.push(separator);

    // Rows
    data.forEach(item => {
        const row = keys.map(key => {
            const value = item?.[key];
            let strValue = String(value ?? "");
            if (strValue.length > 50) {
                strValue = strValue.substring(0, 47) + "...";
            }
            return strValue.padEnd(columnWidths[key]);
        });
        lines.push("| " + row.join(" | ") + " |");
    });

    lines.push(separator);

    return lines.join("\n");
}
