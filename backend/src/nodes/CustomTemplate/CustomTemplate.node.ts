import {
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";

/**
 * Example node demonstrating custom template usage in form configurations
 *
 * This shows the ACTUAL supported input types in the frontend:
 * 1. Standard types: string, number, boolean, options, multiOptions, json, dateTime,
 *    textarea, password, email, url, switch
 * 2. Custom type: For custom components with customComponent prop
 *
 * Note: For custom components, the backend specifies type: "custom" and passes
 * component/componentProps. The frontend then needs to implement the custom component.
 */
export const CustomTemplateNode: NodeDefinition = {
  identifier: "custom-template-example",
  displayName: "Custom Template Example",
  name: "customTemplateExample",
  group: ["transform"],
  version: 1,
  description:
    "Example node showing how to use custom templates in form configuration",
  icon: "fa:code",
  color: "#FF6B6B",
  defaults: {
    customConfig: {},
    code: "",
    query: null,
    mapping: [],
  },
  inputs: ["main"],
  outputs: ["main"],

  properties: [
    // ============================================
    // BACKEND SUPPORTED INPUT TYPES
    // ============================================
    // Backend: string, number, boolean, options, multiOptions, json, dateTime, collection, custom
    // Frontend extends these with: textarea, password, email, url, switch (handled automatically)

    // String input (Frontend can render as: text, textarea, password, email, url)
    {
      displayName: "Text Input",
      name: "textInput",
      type: "string",
      required: false,
      default: "",
      description: "Standard text input field",
    },

    // Long text (use string type - frontend will use Input by default)
    {
      displayName: "Long Text Description",
      name: "longText",
      type: "string",
      required: false,
      default: "",
      description: "For longer text, frontend can render as textarea",
    },

    // Number input
    {
      displayName: "Timeout (ms)",
      name: "timeout",
      type: "number",
      required: false,
      default: 5000,
      description: "Numeric input field",
    },

    // Boolean/Checkbox
    {
      displayName: "Enable Feature",
      name: "enableFeature",
      type: "boolean",
      required: false,
      default: false,
      description: "Checkbox for boolean values",
    },

    // Options (Dropdown)
    {
      displayName: "Operation Type",
      name: "operationType",
      type: "options",
      required: true,
      default: "transform",
      description: "Choose the type of operation to perform",
      options: [
        {
          name: "Transform",
          value: "transform",
          description: "Transform the data",
        },
        {
          name: "Filter",
          value: "filter",
          description: "Filter the data based on conditions",
        },
        {
          name: "Aggregate",
          value: "aggregate",
          description: "Aggregate data using various methods",
        },
      ],
    },

    // Multi Options (Multiple checkboxes)
    {
      displayName: "Select Features",
      name: "features",
      type: "multiOptions",
      required: false,
      default: [],
      description: "Select multiple options",
      options: [
        {
          name: "Feature A",
          value: "featureA",
          description: "Enable feature A",
        },
        {
          name: "Feature B",
          value: "featureB",
          description: "Enable feature B",
        },
        {
          name: "Feature C",
          value: "featureC",
          description: "Enable feature C",
        },
      ],
    },

    // JSON Editor
    {
      displayName: "JSON Configuration",
      name: "jsonConfig",
      type: "json",
      required: false,
      default: {},
      description: "JSON object configuration",
    },

    // DateTime
    {
      displayName: "Schedule Time",
      name: "scheduleTime",
      type: "dateTime",
      required: false,
      default: "",
      description: "Date and time picker",
    },

    // ============================================
    // CONDITIONAL DISPLAY EXAMPLES
    // ============================================

    // Transform-specific options (shown when operationType = "transform")
    {
      displayName: "Transform Method",
      name: "transformMethod",
      type: "options",
      required: false,
      default: "uppercase",
      description: "Transformation to apply",
      displayOptions: {
        show: {
          operationType: ["transform"],
        },
      },
      options: [
        { name: "Uppercase", value: "uppercase" },
        { name: "Lowercase", value: "lowercase" },
        { name: "Capitalize", value: "capitalize" },
        { name: "Reverse", value: "reverse" },
      ],
    },

    {
      displayName: "Field Name",
      name: "fieldName",
      type: "string",
      required: false,
      default: "",
      description: "Field to transform",
      displayOptions: {
        show: {
          operationType: ["transform"],
        },
      },
    },

    // Filter-specific options (shown when operationType = "filter")
    {
      displayName: "Filter Condition",
      name: "filterCondition",
      type: "options",
      required: false,
      default: "contains",
      description: "Filter condition to apply",
      displayOptions: {
        show: {
          operationType: ["filter"],
        },
      },
      options: [
        { name: "Contains", value: "contains" },
        { name: "Equals", value: "equals" },
        { name: "Starts With", value: "startsWith" },
        { name: "Ends With", value: "endsWith" },
      ],
    },

    {
      displayName: "Filter Value",
      name: "filterValue",
      type: "string",
      required: false,
      default: "",
      description: "Value to filter by",
      displayOptions: {
        show: {
          operationType: ["filter"],
        },
      },
    },

    // Aggregate-specific options (shown when operationType = "aggregate")
    {
      displayName: "Aggregate Method",
      name: "aggregateMethod",
      type: "options",
      required: false,
      default: "sum",
      description: "Aggregation method",
      displayOptions: {
        show: {
          operationType: ["aggregate"],
        },
      },
      options: [
        { name: "Sum", value: "sum" },
        { name: "Average", value: "average" },
        { name: "Count", value: "count" },
        { name: "Min", value: "min" },
        { name: "Max", value: "max" },
      ],
    },

    // ============================================
    // CUSTOM TYPE EXAMPLES
    // ============================================
    // Note: Custom types work but require frontend implementation
    // The frontend FormGenerator supports customComponent prop

    {
      displayName: "Custom Code Editor",
      name: "customCode",
      type: "custom",
      required: false,
      default: "// Your code here",
      description: "Custom code editor (requires custom component in frontend)",
      component: "CodeEditor", // Frontend component identifier
      componentProps: {
        // Props passed to the frontend component
        language: "javascript",
        height: "300px",
        theme: "vs-dark",
      },
    },

    {
      displayName: "Advanced Configuration",
      name: "advancedConfig",
      type: "custom",
      required: false,
      default: {},
      description:
        "Custom JSON editor with validation (requires custom component in frontend)",
      component: "JsonSchemaEditor", // Frontend component identifier
      componentProps: {
        schema: {
          identifier: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
            email: { type: "string", format: "email" },
          },
        },
      },
    },

    // ============================================
    // COLLECTION TYPE EXAMPLE
    // ============================================
    // Collection allows grouping related fields together
    {
      displayName: "Advanced Options",
      name: "advancedOptions",
      type: "collection",
      required: false,
      default: {},
      description: "Advanced configuration options",
    },
  ],

  execute: async function (
    inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    // Get parameter values
    const operationType = this.getNodeParameter("operationType") as string;
    const textInput = this.getNodeParameter("textInput") as string;
    const timeout = this.getNodeParameter("timeout") as number;
    const enableFeature = this.getNodeParameter("enableFeature") as boolean;
    const jsonConfig = this.getNodeParameter("jsonConfig") as any;

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

    let resultItems: any[] = [];

    switch (operationType) {
      case "transform": {
        const fieldName = this.getNodeParameter("fieldName") as string;
        const transformMethod = this.getNodeParameter(
          "transformMethod"
        ) as string;

        resultItems = processedItems.map((item: any) => {
          const newItem = { ...item };
          if (fieldName && fieldName in newItem) {
            const value = String(newItem[fieldName]);

            switch (transformMethod) {
              case "uppercase":
                newItem[fieldName] = value.toUpperCase();
                break;
              case "lowercase":
                newItem[fieldName] = value.toLowerCase();
                break;
              case "capitalize":
                newItem[fieldName] =
                  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
                break;
              case "reverse":
                newItem[fieldName] = value.split("").reverse().join("");
                break;
            }
          }

          // Add metadata
          newItem._processedWith = {
            textInput,
            timeout,
            enableFeature,
            jsonConfig,
          };

          return { json: newItem };
        });
        break;
      }

      case "filter": {
        const filterCondition = this.getNodeParameter(
          "filterCondition"
        ) as string;
        const filterValue = this.getNodeParameter("filterValue") as string;

        resultItems = processedItems
          .filter((item: any) => {
            // Simple filter logic
            const itemStr = JSON.stringify(item);

            switch (filterCondition) {
              case "contains":
                return itemStr.includes(filterValue);
              case "equals":
                return itemStr === filterValue;
              case "startsWith":
                return itemStr.startsWith(filterValue);
              case "endsWith":
                return itemStr.endsWith(filterValue);
              default:
                return false;
            }
          })
          .map((item: any) => ({ json: item }));
        break;
      }

      case "aggregate": {
        const aggregateMethod = this.getNodeParameter(
          "aggregateMethod"
        ) as string;

        let result: any;

        switch (aggregateMethod) {
          case "count":
            result = processedItems.length;
            break;
          case "sum":
          case "average":
          case "min":
          case "max":
            // Simple aggregation on all numeric values
            const allNumbers = processedItems.flatMap((item: any) =>
              Object.values(item).filter((v) => typeof v === "number")
            ) as number[];

            switch (aggregateMethod) {
              case "sum":
                result = allNumbers.reduce((acc, val) => acc + val, 0);
                break;
              case "average":
                result =
                  allNumbers.length > 0
                    ? allNumbers.reduce((acc, val) => acc + val, 0) /
                      allNumbers.length
                    : 0;
                break;
              case "min":
                result = allNumbers.length > 0 ? Math.min(...allNumbers) : 0;
                break;
              case "max":
                result = allNumbers.length > 0 ? Math.max(...allNumbers) : 0;
                break;
            }
            break;
          default:
            result = 0;
        }

        resultItems = [
          {
            json: {
              method: aggregateMethod,
              result,
              count: processedItems.length,
              config: {
                textInput,
                timeout,
                enableFeature,
                jsonConfig,
              },
            },
          },
        ];
        break;
      }

      default:
        resultItems = processedItems.map((item: any) => ({ json: item }));
    }

    return [{ main: resultItems }];
  },
};
