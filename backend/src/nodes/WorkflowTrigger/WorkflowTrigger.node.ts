import {
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";
import { WorkflowTriggerHelper } from "./WorkflowTriggerHelper";

export const WorkflowTriggerNode: NodeDefinition = {
  identifier: "workflow-trigger",
  displayName: "Trigger Workflow",
  name: "workflowTrigger",
  group: ["automation"],
  version: 1,
  description: "Trigger another workflow with optional data",
  icon: "fa:play-circle",
  color: "#10B981",
  executionCapability: "action",
  defaults: {
    workflowId: "",
    triggerId: "",
    inputData: {},
    waitForCompletion: true,
    timeout: 30000,
  },
  inputs: ["main"],
  outputs: ["main"],
  properties: [
    {
      displayName: "Workflow",
      name: "workflowId",
      type: "custom",
      required: true,
      default: "",
      description: "Select the workflow to trigger",
      component: "WorkflowAutocomplete",
      componentProps: {
        placeholder: "Select a workflow to trigger",
      },
    },
    {
      displayName: "Trigger",
      name: "triggerId",
      type: "custom",
      required: true,
      default: "",
      description: "Select the trigger to activate",
      component: "TriggerAutocomplete",
      displayOptions: {
        hide: {
          workflowId: [""],
        },
      },
      componentProps: {
        placeholder: "Select a trigger",
        dependsOn: "workflowId",
      },
    },
    {
      displayName: "Input Data",
      name: "inputData",
      type: "json",
      required: false,
      default: "{}",
      description: "Data to pass to the triggered workflow",
    },
    {
      displayName: "Wait for Completion",
      name: "waitForCompletion",
      type: "boolean",
      required: false,
      default: true,
      description:
        "Whether to wait for the triggered workflow to complete before continuing",
    },
    {
      displayName: "Timeout (ms)",
      name: "timeout",
      type: "number",
      required: false,
      default: 30000,
      description: "Maximum time to wait for completion (in milliseconds)",
      displayOptions: {
        show: {
          waitForCompletion: [true],
        },
      },
    },
  ],
  execute: async function (
    inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    const workflowId = this.getNodeParameter("workflowId") as string;
    const triggerId = this.getNodeParameter("triggerId") as string;
    const inputDataParam = this.getNodeParameter("inputData") as
      | string
      | object;
    const waitForCompletion = this.getNodeParameter(
      "waitForCompletion"
    ) as boolean;
    const timeout = (this.getNodeParameter("timeout") as number) || 30000;

    // Validate required parameters
    if (!workflowId) {
      throw new Error("Workflow ID is required");
    }

    if (!triggerId) {
      throw new Error("Trigger ID is required");
    }

    // Parse input data
    let parsedInputData: any = {};
    if (inputDataParam) {
      if (typeof inputDataParam === "string") {
        try {
          parsedInputData = JSON.parse(inputDataParam);
        } catch (error) {
          throw new Error("Invalid input data JSON format");
        }
      } else {
        parsedInputData = inputDataParam;
      }
    }

    // Merge input data with current workflow data if available
    const currentData = inputData.main?.[0] || [];
    const triggerData = {
      ...parsedInputData,
      fromWorkflow: {
        data: currentData,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      this.logger.info(
        `Triggering workflow ${workflowId} with trigger ${triggerId}`
      );

      // Get the target workflow to find its owner
      const targetWorkflow = await WorkflowTriggerHelper.getWorkflowDetails(
        workflowId
      );

      if (!targetWorkflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Use the target workflow's userId
      const userId = targetWorkflow.userId;

      // Use WorkflowTriggerHelper to execute the workflow
      const result = await WorkflowTriggerHelper.executeWorkflow(
        workflowId,
        triggerId,
        userId,
        triggerData,
        waitForCompletion,
        timeout
      );

      // Return the execution result
      return [
        {
          main: [
            {
              json: result,
            },
          ],
        },
      ];
    } catch (error) {
      this.logger.error("Error triggering workflow:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return [
        {
          main: [
            {
              json: {
                success: false,
                error: errorMessage,
                workflowId,
                triggerId,
                status: "error",
                triggeredAt: new Date().toISOString(),
              },
            },
          ],
        },
      ];
    }
  },
};
