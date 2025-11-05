import {
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";

/**
 * Switch Node - Routes data to different outputs based on conditions
 *
 * This demonstrates how to use collection/multipleValues for repeating fields
 * Users can add multiple outputs, each with their own conditions
 * Output pins are dynamically created based on configured outputs
 */
export const SwitchNode: NodeDefinition = {
  type: "switch",
  displayName: "Switch",
  name: "switch",
  group: ["transform"],
  version: 1,
  description:
    "Route data to different outputs based on conditions. Add multiple outputs with custom rules.",
  icon: "fa:code-branch",
  color: "#7E57C2",
  defaults: {
    mode: "rules",
    outputs: [
      {
        id: "output_1",
        values: {
          rule: {
            key: "",
            expression: "equals",
            value: "",
          },
        },
      },
    ],
  },
  inputs: ["main"],
  outputs: ["main"], // Base output - actual outputs are determined by configuration

  properties: [
    {
      displayName: "Mode",
      name: "mode",
      type: "options",
      required: true,
      default: "rules",
      description: "How to determine which output to use",
      options: [
        {
          name: "Rules",
          value: "rules",
          description: "Define rules to route data",
        },
        {
          name: "Expression",
          value: "expression",
          description: "Use an expression to determine output",
        },
      ],
    },

    // Outputs configuration - This will use RepeatingField component
    {
      displayName: "Outputs",
      name: "outputs",
      type: "collection",
      required: false,
      default: [],
      description:
        "Define multiple outputs with conditions. The field name (key) will be used as the output name.",
      typeOptions: {
        multipleValues: true,
        multipleValueButtonText: "Add Output",
      },
      displayOptions: {
        show: {
          mode: ["rules"],
        },
      },
      component: "RepeatingField",
      componentProps: {
        compact: true,
        titleField: "rule.key",
        fields: [
          {
            displayName: "Condition",
            name: "rule",
            type: "conditionRow",
            required: true,
            default: {
              key: "",
              expression: "equals",
              value: "",
            },
            options: [
              { name: "Equals", value: "equals" },
              { name: "Not Equals", value: "notEquals" },
              { name: "Contains", value: "contains" },
              { name: "Does Not Contain", value: "notContains" },
              { name: "Starts With", value: "startsWith" },
              { name: "Ends With", value: "endsWith" },
              { name: "Greater Than", value: "greaterThan" },
              { name: "Less Than", value: "lessThan" },
              { name: "Greater or Equal", value: "greaterOrEqual" },
              { name: "Less or Equal", value: "lessOrEqual" },
              { name: "Is Empty", value: "isEmpty" },
              { name: "Is Not Empty", value: "isNotEmpty" },
              { name: "Regex Match", value: "regex" },
            ],
            componentProps: {
              keyPlaceholder: "Key",
              valuePlaceholder: "Value",
              expressionPlaceholder: "Select condition",
            },
          },
        ],
      },
    },

    // Expression mode
    {
      displayName: "Expression",
      name: "expression",
      type: "string",
      required: true,
      default: "",
      description: "Expression that returns output index (0-based)",
      displayOptions: {
        show: {
          mode: ["expression"],
        },
      },
    },
  ],

  execute: async function (
    inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    const mode = this.getNodeParameter("mode") as string;

    // Get items to process
    let items = inputData.main || [];

    if (items.length === 1 && items[0] && Array.isArray(items[0])) {
      items = items[0];
    }

    const processedItems = items.map((item: any) => {
      if (item && typeof item === "object" && "json" in item) {
        return item.json;
      }
      return item;
    });

    if (mode === "rules") {
      // Get outputs configuration
      const outputs = this.getNodeParameter("outputs") as any[];

      // If no outputs configured, return all items through first output
      if (!outputs || outputs.length === 0) {
        return [
          {
            main: processedItems.map((item: any) => ({ json: item })),
          },
        ];
      }

      // Route items based on conditions
      const routedOutputs: Record<number, any[]> = {};

      // Helper function to resolve field value from item
      // Handles both simple field names ("id") and template expressions ("{{json.id}}")
      const resolveFieldValue = (item: any, fieldExpression: string): any => {
        // If it's a template expression like {{json.id}} or {{json.user.address.city}}, extract the field path
        const templateMatch = fieldExpression.match(
          /\{\{json(?:\[\d+\])?\.([\w.[\]]+)\}\}/
        );
        if (templateMatch) {
          const fieldPath = templateMatch[1];
          // Support deeply nested paths like "user.address.city" or "items[0].name"
          return resolvePath(item, fieldPath);
        }

        // Otherwise treat as direct field path
        // Support deeply nested paths like "user.address.city"
        return resolvePath(item, fieldExpression);
      };

      // Helper to resolve nested paths including array access
      const resolvePath = (obj: any, path: string): any => {
        // Handle array notation: items[0].name -> items.0.name
        const normalizedPath = path.replace(/\[(\d+)\]/g, ".$1");

        return normalizedPath.split(".").reduce((current, key) => {
          if (current === null || current === undefined) {
            return undefined;
          }
          return current[key];
        }, obj);
      };

      // Helper function to evaluate conditions
      const evaluateCondition = (
        item: any,
        fieldExpression: string,
        condition: string,
        value: string
      ): boolean => {
        const fieldValue = resolveFieldValue(item, fieldExpression);
        const fieldStr = String(fieldValue || "");

        switch (condition) {
          case "equals":
          case "equal":
            return fieldStr === value;
          case "notEquals":
          case "notEqual":
            return fieldStr !== value;
          case "contains":
            return fieldStr.includes(value);
          case "notContains":
            return !fieldStr.includes(value);
          case "startsWith":
            return fieldStr.startsWith(value);
          case "endsWith":
            return fieldStr.endsWith(value);
          case "greaterThan":
          case "larger":
            return Number(fieldValue) > Number(value);
          case "lessThan":
          case "smaller":
            return Number(fieldValue) < Number(value);
          case "greaterOrEqual":
          case "largerEqual":
            return Number(fieldValue) >= Number(value);
          case "lessOrEqual":
          case "smallerEqual":
            return Number(fieldValue) <= Number(value);
          case "isEmpty":
            return !fieldValue || fieldValue === "";
          case "isNotEmpty":
            return fieldValue && fieldValue !== "";
          case "regex":
            try {
              const regex = new RegExp(value);
              return regex.test(fieldStr);
            } catch {
              return false;
            }
          default:
            return false;
        }
      };

      processedItems.forEach((item: any) => {
        // Check each output condition
        for (let i = 0; i < outputs.length; i++) {
          const output = outputs[i];
          const outputConfig = output.values || output; // Handle both nested and flat structure

          // Extract rule from conditionRow
          const rule = outputConfig.rule || {
            key: outputConfig.field,
            expression: outputConfig.condition,
            value: outputConfig.value,
          };

          const field = rule.key;
          const condition = rule.expression;
          const value = rule.value;

          if (evaluateCondition(item, field, condition, value)) {
            if (!routedOutputs[i]) {
              routedOutputs[i] = [];
            }
            routedOutputs[i].push({ json: item });
            break; // Only route to first matching output
          }
        }

        // If no match found, item is discarded (not routed to any output)
      });

      // Convert to array format - one entry per output
      // Each output gets its routed items with the key field as the output name
      const result: NodeOutputData[] = [];
      for (let i = 0; i < outputs.length; i++) {
        const output = outputs[i];
        const outputConfig = output.values || output; // Handle both nested and flat structure

        // Extract rule to get the key field
        const rule = outputConfig.rule || {
          key: outputConfig.field,
          expression: outputConfig.condition,
          value: outputConfig.value,
        };

        // Use the key field as the output name, fallback to generic name
        const outputName = rule.key || `output${i}`;
        const outputItems = routedOutputs[i] || [];

        result.push({
          [outputName]: outputItems, // Use key field as output name
        });
      }

      return result;
    } else {
      // Expression mode
      const expression = this.getNodeParameter("expression") as string;

      // Simple expression evaluation (in reality, use a proper expression evaluator)
      // For now, just return all items through main output
      // TODO: Implement proper expression evaluation to route to specific output index
      parseInt(expression, 10); // Parse expression for future use

      return [
        {
          main: processedItems.map((item: any) => ({ json: item })),
        },
      ];
    }
  },
};
