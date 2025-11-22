import {
  BuiltInNodeTypes,
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";

export const JsonNode: NodeDefinition = {
  identifier: BuiltInNodeTypes.JSON,
  displayName: "JSON",
  name: "json",
  group: ["transform"],
  version: 1,
  description: "Compose a JSON object",
  icon: "fa:code",
  color: "#FF9800",
  defaults: {
    jsonData: "{}",
  },
  inputs: ["main"],
  outputs: ["main"],
  properties: [
    {
      displayName: "JSON Data",
      name: "jsonData",
      type: "json",
      required: true,
      default: "{}",
      description: "The JSON data to output",
    },
  ],
  execute: async function (
    inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    const jsonData = (await this.getNodeParameter("jsonData")) as string;

    try {
      const parsedData =
        typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;

      // If parsed data is an array, create separate items for each element
      if (Array.isArray(parsedData)) {
        const items = parsedData.map((item) => ({ json: item }));
        return [{ main: items }];
      }

      // Otherwise, wrap single object in an item
      return [{ main: [{ json: parsedData }] }];
    } catch (error) {
      throw new Error(
        `Invalid JSON data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  },
};
