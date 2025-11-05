import {
    NodeDefinition,
    NodeInputData,
    NodeOutputData,
} from "../../types/node.types";

/**
 * IfElse Node - Routes data based on conditions
 * 
 * Three modes:
 * - Simple: Single condition (default, easy to use)
 * - Combine: Multiple conditions with AND/OR
 * - Grouped: Nested condition groups for complex logic like (a==3 || a==4) && (b==1 || b==4)
 * 
 * Uses the conditionRow field type for intuitive condition configuration.
 */
export const IfElseNode: NodeDefinition = {
    type: "ifElse",
    displayName: "If/Else",
    name: "ifElse",
    group: ["transform"],
    version: 1,
    description: "Route data based on conditions. Simple, Combine, or Grouped modes.",
    icon: "fa:code-branch",
    color: "#FF6B6B",
    defaults: {
        mode: "simple",
        condition: {
            key: "",
            expression: "equal",
            value: "",
        },
        combineOperation: "AND",
        conditions: [
            {
                values: {
                    condition: {
                        key: "",
                        expression: "equal",
                        value: "",
                    },
                },
            },
        ],
        combineGroups: "AND",
        conditionGroups: [
            {
                values: {
                    groupOperation: "OR",
                    conditions: [
                        {
                            values: {
                                condition: {
                                    key: "",
                                    expression: "equal",
                                    value: "",
                                },
                            },
                        },
                    ],
                },
            },
        ],
    },
    inputs: ["main"],
    outputs: ["true", "false"],

    properties: [
        {
            displayName: "Mode",
            name: "mode",
            type: "options",
            required: true,
            default: "simple",
            description: "Choose between simple conditions or grouped conditions for complex logic",
            options: [
                {
                    name: "Simple",
                    value: "simple",
                    description: "Single condition",
                },
                {
                    name: "Combine",
                    value: "combine",
                    description: "Multiple conditions with AND/OR",
                },
                {
                    name: "Grouped",
                    value: "grouped",
                    description: "Nested groups for complex logic",
                },
            ],
        },
        // Simple mode property - single condition
        {
            displayName: "Condition",
            name: "condition",
            type: "conditionRow",
            required: true,
            default: {
                key: "",
                expression: "equal",
                value: "",
            },
            description: "Define the condition to evaluate",
            displayOptions: {
                show: {
                    mode: ["simple"],
                },
            },
            options: [
                { name: "Equal", value: "equal" },
                { name: "Not Equal", value: "notEqual" },
                { name: "Larger", value: "larger" },
                { name: "Larger Equal", value: "largerEqual" },
                { name: "Smaller", value: "smaller" },
                { name: "Smaller Equal", value: "smallerEqual" },
                { name: "Contains", value: "contains" },
                { name: "Not Contains", value: "notContains" },
                { name: "Starts With", value: "startsWith" },
                { name: "Ends With", value: "endsWith" },
                { name: "Is Empty", value: "isEmpty" },
                { name: "Is Not Empty", value: "isNotEmpty" },
                { name: "Regex", value: "regex" },
            ],
            componentProps: {
                keyPlaceholder: "Field or value",
                valuePlaceholder: "Compare value",
                expressionPlaceholder: "Select condition",
            },
        },
        // Combine mode properties
        {
            displayName: "Combine",
            name: "combineOperation",
            type: "options",
            required: true,
            default: "AND",
            description: "How to combine multiple conditions",
            displayOptions: {
                show: {
                    mode: ["combine"],
                },
            },
            options: [
                {
                    name: "AND",
                    value: "AND",
                    description: "All conditions must be true",
                },
                {
                    name: "OR",
                    value: "OR",
                    description: "At least one condition must be true",
                },
            ],
        },
        {
            displayName: "Conditions",
            name: "conditions",
            type: "collection",
            required: true,
            default: [],
            description: "Define multiple conditions to evaluate",
            displayOptions: {
                show: {
                    mode: ["combine"],
                },
            },
            typeOptions: {
                multipleValues: true,
                multipleValueButtonText: "Add Condition",
            },
            component: "RepeatingField",
            componentProps: {
                compact: true,
                titleField: "condition.key",
                fields: [
                    {
                        displayName: "Condition",
                        name: "condition",
                        type: "conditionRow",
                        required: true,
                        default: {
                            key: "",
                            expression: "equal",
                            value: "",
                        },
                        description: "Define the condition to evaluate",
                        options: [
                            { name: "Equal", value: "equal" },
                            { name: "Not Equal", value: "notEqual" },
                            { name: "Larger", value: "larger" },
                            { name: "Larger Equal", value: "largerEqual" },
                            { name: "Smaller", value: "smaller" },
                            { name: "Smaller Equal", value: "smallerEqual" },
                            { name: "Contains", value: "contains" },
                            { name: "Not Contains", value: "notContains" },
                            { name: "Starts With", value: "startsWith" },
                            { name: "Ends With", value: "endsWith" },
                            { name: "Is Empty", value: "isEmpty" },
                            { name: "Is Not Empty", value: "isNotEmpty" },
                            { name: "Regex", value: "regex" },
                        ],
                        componentProps: {
                            keyPlaceholder: "Field or value",
                            valuePlaceholder: "Compare value",
                            expressionPlaceholder: "Select condition",
                        },
                    },
                ],
            },
        },
        // Grouped mode properties
        {
            displayName: "Combine Groups",
            name: "combineGroups",
            type: "options",
            required: true,
            default: "AND",
            description: "How to combine multiple condition groups",
            displayOptions: {
                show: {
                    mode: ["grouped"],
                },
            },
            options: [
                {
                    name: "AND",
                    value: "AND",
                    description: "All groups must be true",
                },
                {
                    name: "OR",
                    value: "OR",
                    description: "At least one group must be true",
                },
            ],
        },
        {
            displayName: "Condition Groups",
            name: "conditionGroups",
            type: "collection",
            required: true,
            default: [],
            description: "Define groups of conditions. Each group can have its own AND/OR logic.",
            displayOptions: {
                show: {
                    mode: ["grouped"],
                },
            },
            typeOptions: {
                multipleValues: true,
                multipleValueButtonText: "Add Group",
            },
            component: "RepeatingField",
            componentProps: {
                compact: false,
                titleField: "groupOperation",
                fields: [
                    {
                        displayName: "Group Operation",
                        name: "groupOperation",
                        type: "options",
                        required: true,
                        default: "OR",
                        description: "How to combine conditions within this group",
                        options: [
                            { name: "AND", value: "AND" },
                            { name: "OR", value: "OR" },
                        ],
                    },
                    {
                        displayName: "Conditions",
                        name: "conditions",
                        type: "collection",
                        required: true,
                        default: [],
                        description: "Conditions in this group",
                        typeOptions: {
                            multipleValues: true,
                            multipleValueButtonText: "Add Condition",
                        },
                        component: "RepeatingField",
                        componentProps: {
                            compact: true,
                            titleField: "condition.key",
                            fields: [
                                {
                                    displayName: "Condition",
                                    name: "condition",
                                    type: "conditionRow",
                                    required: true,
                                    default: {
                                        key: "",
                                        expression: "equal",
                                        value: "",
                                    },
                                    description: "Define the condition to evaluate",
                                    options: [
                                        { name: "Equal", value: "equal" },
                                        { name: "Not Equal", value: "notEqual" },
                                        { name: "Larger", value: "larger" },
                                        { name: "Larger Equal", value: "largerEqual" },
                                        { name: "Smaller", value: "smaller" },
                                        { name: "Smaller Equal", value: "smallerEqual" },
                                        { name: "Contains", value: "contains" },
                                        { name: "Not Contains", value: "notContains" },
                                        { name: "Starts With", value: "startsWith" },
                                        { name: "Ends With", value: "endsWith" },
                                        { name: "Is Empty", value: "isEmpty" },
                                        { name: "Is Not Empty", value: "isNotEmpty" },
                                        { name: "Regex", value: "regex" },
                                    ],
                                    componentProps: {
                                        keyPlaceholder: "Field or value",
                                        valuePlaceholder: "Compare value",
                                        expressionPlaceholder: "Select condition",
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        },
    ],

    execute: async function (
        inputData: NodeInputData
    ): Promise<NodeOutputData[]> {
        // Normalize and extract input items
        const items = this.normalizeInputItems(inputData.main || []);
        const processedItems = this.extractJsonData(items);

        // Get mode
        const mode = this.getNodeParameter("mode") as string;

        // Helper function to resolve field value from item or use direct value
        const resolveValue = (item: any, fieldExpression: string): any => {
            // If it's a template expression like {{json.id}}, extract the field path
            const templateMatch = fieldExpression.match(
                /\{\{json(?:\[\d+\])?\.([\w.[\]]+)\}\}/
            );
            if (templateMatch) {
                const fieldPath = templateMatch[1];
                return resolvePath(item, fieldPath);
            }

            // Try to resolve as field path first
            const resolved = resolvePath(item, fieldExpression);

            // If resolution returns undefined and the expression doesn't look like a path,
            // treat it as a literal value
            if (resolved === undefined && !fieldExpression.includes('.')) {
                return fieldExpression;
            }

            return resolved;
        };

        // Helper to resolve nested paths including array access
        const resolvePath = (obj: any, path: string): any => {
            if (!path) return undefined;

            // Handle array notation: items[0].name -> items.0.name
            const normalizedPath = path.replace(/\[(\d+)\]/g, ".$1");

            return normalizedPath.split(".").reduce((current, key) => {
                if (current === null || current === undefined) {
                    return undefined;
                }
                return current[key];
            }, obj);
        };

        // Evaluate single condition function
        const evaluateSingleCondition = (
            value1: any,
            operation: string,
            value2: any
        ): boolean => {
            const val1 = String(value1 ?? "");
            const val2 = String(value2 ?? "");

            switch (operation) {
                case "equal":
                    return val1 === val2;

                case "notEqual":
                    return val1 !== val2;

                case "larger":
                    return Number(value1) > Number(value2);

                case "largerEqual":
                    return Number(value1) >= Number(value2);

                case "smaller":
                    return Number(value1) < Number(value2);

                case "smallerEqual":
                    return Number(value1) <= Number(value2);

                case "contains":
                    return val1.includes(val2);

                case "notContains":
                    return !val1.includes(val2);

                case "startsWith":
                    return val1.startsWith(val2);

                case "endsWith":
                    return val1.endsWith(val2);

                case "isEmpty":
                    return !val1 || val1.trim() === "";

                case "isNotEmpty":
                    return !!(val1 && val1.trim() !== "");

                case "regex":
                    try {
                        const regex = new RegExp(val2);
                        return regex.test(val1);
                    } catch (error) {
                        throw new Error(`Invalid regex pattern: ${val2}`);
                    }

                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }
        };

        let finalResult: boolean;

        if (mode === "simple") {
            // Simple mode: single condition evaluation
            const condition = (await this.getNodeParameter("condition", 0)) as {
                key: string;
                expression: string;
                value: string;
            };

            // Resolve the key value from first item or use as literal
            const keyValue = processedItems.length > 0
                ? resolveValue(processedItems[0], condition.key)
                : condition.key;

            finalResult = evaluateSingleCondition(
                keyValue,
                condition.expression,
                condition.value
            );
        } else if (mode === "combine") {
            // Combine mode: multiple conditions with single AND/OR
            const combineOperation = this.getNodeParameter("combineOperation") as string;
            const conditions = this.getNodeParameter("conditions") as any[];

            // If no conditions, route everything to false
            if (!conditions || conditions.length === 0) {
                const wrappedItems = processedItems.map((item) => ({ json: item }));
                return [{ true: [] }, { false: wrappedItems }];
            }

            // Evaluate all conditions
            const conditionResults: boolean[] = [];

            for (const conditionConfig of conditions) {
                // Extract condition from nested structure
                const condition = conditionConfig.values?.condition || conditionConfig.condition;

                if (!condition) continue;

                // Resolve the key value from first item or use as literal
                const keyValue = processedItems.length > 0
                    ? resolveValue(processedItems[0], condition.key)
                    : condition.key;

                const result = evaluateSingleCondition(
                    keyValue,
                    condition.expression,
                    condition.value
                );

                conditionResults.push(result);
            }

            // Combine results based on operation
            if (combineOperation === "AND") {
                // All conditions must be true
                finalResult = conditionResults.length > 0 && conditionResults.every(r => r === true);
            } else {
                // OR: At least one condition must be true
                finalResult = conditionResults.some(r => r === true);
            }
        } else {
            // Grouped mode: nested groups with complex logic
            const combineGroups = this.getNodeParameter("combineGroups") as string;
            const conditionGroups = this.getNodeParameter("conditionGroups") as any[];

            // If no groups, route everything to false
            if (!conditionGroups || conditionGroups.length === 0) {
                const wrappedItems = processedItems.map((item) => ({ json: item }));
                return [{ true: [] }, { false: wrappedItems }];
            }

            // Evaluate all condition groups
            const groupResults: boolean[] = [];

            for (const groupConfig of conditionGroups) {
                // Extract group configuration
                const group = groupConfig.values || groupConfig;
                const groupOperation = group.groupOperation || "OR";
                const conditions = group.conditions || [];

                if (!conditions || conditions.length === 0) {
                    // Empty group evaluates to false
                    groupResults.push(false);
                    continue;
                }

                // Evaluate all conditions in this group
                const conditionResults: boolean[] = [];

                for (const conditionConfig of conditions) {
                    // Extract condition from nested structure
                    const condition = conditionConfig.values?.condition || conditionConfig.condition;

                    if (!condition) continue;

                    // Resolve the key value from first item or use as literal
                    const keyValue = processedItems.length > 0
                        ? resolveValue(processedItems[0], condition.key)
                        : condition.key;

                    const result = evaluateSingleCondition(
                        keyValue,
                        condition.expression,
                        condition.value
                    );

                    conditionResults.push(result);
                }

                // Combine conditions within this group
                let groupResult: boolean;
                if (groupOperation === "AND") {
                    // All conditions in group must be true
                    groupResult = conditionResults.length > 0 && conditionResults.every(r => r === true);
                } else {
                    // OR: At least one condition in group must be true
                    groupResult = conditionResults.some(r => r === true);
                }

                groupResults.push(groupResult);
            }

            // Combine group results based on combineGroups operation
            if (combineGroups === "AND") {
                // All groups must be true
                finalResult = groupResults.length > 0 && groupResults.every(r => r === true);
            } else {
                // OR: At least one group must be true
                finalResult = groupResults.some(r => r === true);
            }
        }

        // Route all items to either true or false output
        const wrappedItems = processedItems.map((item) => ({ json: item }));

        // Log the routing decision for debugging
        this.logger.info(`IfElse routing decision: ${finalResult ? 'TRUE' : 'FALSE'}`, {
            finalResult,
            itemCount: wrappedItems.length,
            mode,
        });

        if (finalResult) {
            return [{ true: wrappedItems }, { false: [] }];
        } else {
            return [{ true: [] }, { false: wrappedItems }];
        }
    },
};
