import { NodeDefinition, NodeInputData, NodeOutputData, NodeExecutionContext } from "../../types/node.types";

export const TestUploadNode: NodeDefinition = {
  identifier: "test-upload",
  displayName: "Test Upload Node",
  name: "testUpload",
  group: ["Custom"],
  version: 1,
  description: "A test node uploaded via ZIP",
  icon: "fa:upload",
  color: "#9b59b6",
  defaults: {},
  inputs: ["main"],
  outputs: ["main"],
  properties: [
    {
      displayName: "Message",
      name: "message",
      type: "string",
      required: false,
      default: "Hello from uploaded node!",
      description: "Message to display",
    },
  ],
  execute: async function (this: NodeExecutionContext, inputData: NodeInputData): Promise<NodeOutputData[]> {
    const message = this.getNodeParameter("message") as string;
    const items = inputData.main?.[0] || [];
    
    const results = items.map((item: any) => ({
      json: {
        ...item.json,
        message: message || "Hello from uploaded node!"
      }
    }));

    return [{ main: results }];
  },
};
