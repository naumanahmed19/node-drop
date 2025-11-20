import {
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";

export const WorkflowCalledNode: NodeDefinition = {
  identifier: "workflow-called",
  displayName: "Called by Workflow",
  name: "workflowCalled",
  group: ["trigger"],
  nodeCategory: "trigger",
  triggerType: "workflow-called",
  version: 1,
  description: "Receives data when this workflow is called by another workflow",
  icon: "fa:phone-alt",
  color: "#16A085",
  defaults: {
    description: "",
    passthrough: true,
  },
  inputs: [],
  outputs: ["main"],
  properties: [
    {
      displayName: "Description",
      name: "description",
      type: "string",
      required: false,
      default: "",
      description: "Optional description for this workflow trigger",
    },
    {
      displayName: "Pass Through Input Data",
      name: "passthrough",
      type: "boolean",
      required: false,
      default: true,
      description:
        "Whether to pass through data received from the calling workflow",
    },
  ],
  execute: async function (
    inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    try {
      // Safely get parameters with fallbacks
      let description = "";
      let passthrough = true;

      try {
        description = (this.getNodeParameter("description") as string) || "";
        passthrough = this.getNodeParameter("passthrough") as boolean;
      } catch (error) {
        // If parameter access fails, use defaults
        this.logger?.warn("Failed to get node parameters, using defaults", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      this.logger?.info("WorkflowCalled trigger starting execution", {
        description,
        passthrough,
        hasInputData: !!inputData?.main?.[0]?.[0],
      });

      // Get trigger data from the execution context
      let receivedData: any = {};

      // Check input data for trigger data
      if (inputData?.main?.[0]?.[0]?.json) {
        receivedData = inputData.main[0][0].json;
        this.logger?.info("WorkflowCalled received input data", {
          dataKeys: Object.keys(receivedData),
        });
      }

      let output: any = {
        triggeredAt: new Date().toISOString(),
        triggerType: "workflow-called",
        description: description || "Triggered by WorkflowTrigger node",
        message:
          "This workflow was triggered by another workflow or external call",
      };

      // Include the received data if passthrough is enabled
      if (passthrough && receivedData && Object.keys(receivedData).length > 0) {
        output.receivedData = receivedData;
        // Also merge the received data directly into the output for easy access
        output = { ...output, ...receivedData };
        this.logger?.info("WorkflowCalled merged received data into output");
      }

      // Always provide some basic data even if no input
      if (!receivedData || Object.keys(receivedData).length === 0) {
        output.workflowCallInfo = {
          calledAt: new Date().toISOString(),
          triggerSource: "workflow-called",
        };
      }

      const result = [
        {
          main: [
            {
              json: output,
            },
          ],
        },
      ];

      this.logger?.info("WorkflowCalled trigger completed execution", {
        success: true,
        outputKeys: Object.keys(output),
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger?.error("WorkflowCalled trigger execution failed", {
        error: errorMessage,
        stack: errorStack,
      });

      // Return a basic error response instead of throwing
      return [
        {
          main: [
            {
              json: {
                error: true,
                message: "WorkflowCalled trigger failed",
                errorDetails: errorMessage,
                triggeredAt: new Date().toISOString(),
                triggerType: "workflow-called",
              },
            },
          ],
        },
      ];
    }
  },
};
