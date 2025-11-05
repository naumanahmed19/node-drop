import {
  BuiltInNodeTypes,
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";

/**
 * Set Node - Add or update fields on data items
 *
 * This node allows you to set key-value pairs on incoming data items.
 * You can add new fields or overwrite existing ones.
 *
 * How it works:
 * - If there are input items, it applies the set values to each item
 * - If there are no input items, it creates a new item with the set values
 * - Both keys and values support expressions (e.g., {{$json.fieldName}})
 * - Supports nested paths (e.g., "user.address.city" or "items[0].name")
 *
 * Examples:
 * 1. Simple fields:
 *    Input: { "name": "John", "age": 30 }
 *    Set: status = "active", role = "admin"
 *    Output: { "name": "John", "age": 30, "status": "active", "role": "admin" }
 *
 * 2. Nested paths:
 *    Input: { "name": "John" }
 *    Set: user.address.city = "New York", user.age = 30
 *    Output: { "name": "John", "user": { "address": { "city": "New York" }, "age": 30 } }
 */
export const SetNode: NodeDefinition = {
  type: BuiltInNodeTypes.SET,
  displayName: "Set",
  name: "set",
  group: ["transform"],
  version: 1,
  description: "Set values on the data",
  icon: "S",
  color: "#4CAF50",
  defaults: {
    values: [],
  },
  inputs: ["main"],
  outputs: ["main"],
  properties: [
    {
      displayName: "Values",
      name: "values",
      type: "collection",
      required: false,
      default: [],
      description: "The values to set",
      typeOptions: {
        multipleValues: true,
        multipleValueButtonText: "Add Value",
      },
      component: "RepeatingField",
      componentProps: {
        compact: true,
        titleField: "keyValue.key",
        fields: [
          {
            displayName: "Key Value",
            name: "keyValue",
            type: "keyValueRow",
            required: true,
            default: {
              key: "",
              value: "",
            },
            componentProps: {
              keyPlaceholder: "Field name (e.g., status or user.address.city)",
              valuePlaceholder: "Value to set",
            },
          },
        ],
      },
    },
  ],
  execute: async function (
    inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    const values = (await this.getNodeParameter("values")) as Array<{
      values?: {
        keyValue: {
          key: string;
          value: any;
        };
      };
      keyValue?: {
        key: string;
        value: any;
      };
    }>;

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

    // If no items, create a single empty item to apply values to
    const itemsToProcess = processedItems.length > 0 ? processedItems : [{}];

    // Helper function to set nested values
    const setNestedValue = (obj: any, path: string, value: any) => {
      // Handle array notation: items[0].name -> items.0.name
      const normalizedPath = path.replace(/\[(\d+)\]/g, ".$1");
      const keys = normalizedPath.split(".");

      let current = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current) || typeof current[key] !== "object") {
          // Create nested object or array based on next key
          const nextKey = keys[i + 1];
          current[key] = /^\d+$/.test(nextKey) ? [] : {};
        }
        current = current[key];
      }

      current[keys[keys.length - 1]] = value;
    };

    // Apply the set values to each item
    const outputItems = itemsToProcess.map((item: any) => {
      const newItem = { ...item };

      values.forEach((valueConfig) => {
        // Handle both nested and flat structure
        const keyValue = valueConfig.values?.keyValue || valueConfig.keyValue;

        if (keyValue && keyValue.key) {
          // Support nested paths like "user.address.city" or "items[0].name"
          setNestedValue(newItem, keyValue.key, keyValue.value);
        }
      });

      return { json: newItem };
    });

    return [{ main: outputItems }];
  },
};
