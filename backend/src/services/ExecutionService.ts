import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import {
  Execution,
  ExecutionFilters,
  ExecutionResult,
  ExecutionStatus,
  NodeExecution,
  Workflow,
} from "../types/database";
import {
  ExecutionOptions,
  ExecutionProgress,
  ExecutionStats,
  QueueConfig,
} from "../types/execution.types";
import { logger } from "../utils/logger";
import { ExecutionEngine } from "./ExecutionEngine";
import ExecutionHistoryService from "./ExecutionHistoryService";
import {
  FlowExecutionEngine,
  FlowExecutionOptions,
  FlowExecutionResult,
} from "./FlowExecutionEngine";
import { NodeService } from "./NodeService";

export class ExecutionService {
  private prisma: PrismaClient;
  private executionEngine: ExecutionEngine;
  private flowExecutionEngine: FlowExecutionEngine;
  private nodeService: NodeService;
  private executionHistoryService: ExecutionHistoryService;

  constructor(
    prisma: PrismaClient,
    nodeService: NodeService,
    executionHistoryService: ExecutionHistoryService
  ) {
    this.prisma = prisma;
    this.nodeService = nodeService;
    this.executionHistoryService = executionHistoryService;

    // Initialize queue configuration
    const queueConfig: QueueConfig = {
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || "0"),
      },
      concurrency: parseInt(process.env.EXECUTION_CONCURRENCY || "5"),
      removeOnComplete: parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE || "100"),
      removeOnFail: parseInt(process.env.QUEUE_REMOVE_ON_FAIL || "50"),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    };

    this.executionEngine = new ExecutionEngine(
      prisma,
      nodeService,
      queueConfig
    );
    this.flowExecutionEngine = new FlowExecutionEngine(
      prisma,
      nodeService,
      executionHistoryService
    );
    this.setupEventHandlers();
  }

  /**
   * Execute a workflow using flow-based execution
   */
  async executeWorkflow(
    workflowId: string,
    userId: string,
    triggerData?: any,
    options: ExecutionOptions = {},
    triggerNodeId?: string, // Optional specific trigger node ID
    workflowData?: { nodes?: any[]; connections?: any[]; settings?: any }, // Optional workflow data
    executionId?: string // Optional execution ID (for trigger-initiated executions)
  ): Promise<ExecutionResult> {
    
    try {


      let parsedWorkflow: Workflow;

      // Use passed workflow data if available, otherwise load from database
      if (workflowData && workflowData.nodes) {
        // Use passed workflow data (for unsaved workflows)
        parsedWorkflow = {
          id: workflowId,
          userId,
          name: "Unsaved Workflow", // Default name for unsaved workflows
          description: undefined,
          nodes: workflowData.nodes,
          connections: workflowData.connections || [],
          settings: workflowData.settings || {},
          triggers: [], // Default value
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };


      } else {
        // Load workflow from database (existing behavior)
        const workflow = await this.prisma.workflow.findFirst({
          where: {
            id: workflowId,
            userId,
          },
        });

        if (!workflow) {
          return {
            success: false,
            error: {
              message: "Workflow not found",
              timestamp: new Date(),
            },
          };
        }

        // Parse workflow data to match Workflow interface
        parsedWorkflow = {
          ...workflow,
          description: workflow.description || undefined,
          nodes: Array.isArray(workflow.nodes)
            ? workflow.nodes
            : JSON.parse(workflow.nodes as string),
          connections: Array.isArray(workflow.connections)
            ? workflow.connections
            : JSON.parse(workflow.connections as string),
          triggers: Array.isArray(workflow.triggers)
            ? workflow.triggers
            : JSON.parse(workflow.triggers as string),
          settings:
            typeof workflow.settings === "object"
              ? workflow.settings
              : JSON.parse(workflow.settings as string),
        };
      }

      // Use the parsed workflow data
      const workflowNodes = parsedWorkflow.nodes;

      // Find trigger nodes or determine starting point
      // Include chat nodes as they can trigger workflows
      const triggerNodes = workflowNodes.filter((node: any) => {
        const nodeDef = this.nodeService.getNodeDefinitionSync(node.type);
        return nodeDef?.triggerType !== undefined || node.type === "chat";
      });

      let flowResult: FlowExecutionResult;

      if (triggerNodes.length > 0 && triggerData) {
        // Execute from specific trigger or first trigger
        let targetTriggerNode;

        if (triggerNodeId) {
          // Use specific trigger node if provided
          targetTriggerNode = triggerNodes.find(
            (node: any) => node.id === triggerNodeId
          );
          if (!targetTriggerNode) {
            // If the specified node is not in triggerNodes list, try to find it in all nodes
            // This handles cases where a node might be used as a trigger even if it's not a typical trigger type
            targetTriggerNode = workflowNodes.find(
              (node: any) => node.id === triggerNodeId
            );
            if (!targetTriggerNode) {
              return {
                success: false,
                error: {
                  message: `Specified trigger node ${triggerNodeId} not found in workflow`,
                  timestamp: new Date(),
                },
              };
            }
          }
        } else {
          // Use first trigger node as fallback
          targetTriggerNode = triggerNodes[0];
        }



        flowResult = await this.flowExecutionEngine.executeFromTrigger(
          targetTriggerNode.id,
          workflowId,
          userId,
          triggerData,
          {
            timeout: options.timeout || 300000,
            saveProgress: true,
            saveData: true,
            manual: true,
            isolatedExecution: false,
          },
          parsedWorkflow, // Pass the workflow data
          executionId // Pass the execution ID if provided
        );
      } else {
        // Execute from first node or specified starting node
        const startNode = workflowNodes[0];
        if (!startNode) {
          return {
            success: false,
            error: {
              message: "No nodes found in workflow",
              timestamp: new Date(),
            },
          };
        }

        flowResult = await this.flowExecutionEngine.executeFromNode(
          startNode.id,
          workflowId,
          userId,
          triggerData ? { main: [[triggerData]] } : undefined,
          {
            timeout: options.timeout || 300000,
            saveProgress: true,
            saveData: true,
            manual: true,
            isolatedExecution: false,
          },
          parsedWorkflow, // Pass the workflow data
          executionId // Pass the execution ID if provided
        );
      }

      // Create execution record in database
      const executionRecord = await this.createFlowExecutionRecord(
        flowResult,
        workflowId,
        userId,
        triggerData,
        // Pass workflow snapshot
        parsedWorkflow
          ? {
            nodes: parsedWorkflow.nodes,
            connections: parsedWorkflow.connections,
            settings: parsedWorkflow.settings,
          }
          : undefined,
        options // Pass options to check saveToDatabase
      );

      // Collect error information from failed nodes
      let executionError: any = undefined;
      if (flowResult.failedNodes.length > 0) {
        const failedNodeErrors: string[] = [];

        for (const [nodeId, nodeResult] of flowResult.nodeResults) {
          if (nodeResult.status === "failed" && nodeResult.error) {
            const errorMessage =
              nodeResult.error instanceof Error
                ? nodeResult.error.message
                : String(nodeResult.error);
            failedNodeErrors.push(`Node ${nodeId}: ${errorMessage}`);
          }
        }

        executionError = {
          message:
            failedNodeErrors.length > 0
              ? failedNodeErrors.join("; ")
              : `${flowResult.failedNodes.length} node(s) failed`,
          timestamp: new Date(),
          failedNodes: flowResult.failedNodes,
        };
      }

      return {
        success: true, // Execution started and ran, even if some nodes failed
        data: {
          executionId: flowResult.executionId,
          status: flowResult.status,
          executedNodes: flowResult.executedNodes,
          failedNodes: flowResult.failedNodes,
          duration: flowResult.totalDuration,
          hasFailures: flowResult.failedNodes.length > 0,
          // Include the actual execution data
          executionData: {
            nodeResults: Object.fromEntries(flowResult.nodeResults),
            resultData: {
              runData: this.convertNodeResultsToRunData(flowResult.nodeResults)
            }
          }
        },
        error: executionError,
      };
    } catch (error) {
      logger.error(`Failed to execute workflow ${workflowId}:`, error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Execute a workflow from a specific node using flow execution
   */
  async executeFromNode(
    workflowId: string,
    nodeId: string,
    userId: string,
    inputData?: any,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    try {


      // Verify workflow exists and belongs to user
      const workflow = await this.prisma.workflow.findFirst({
        where: {
          id: workflowId,
          userId,
        },
      });

      if (!workflow) {
        return {
          success: false,
          error: {
            message: "Workflow not found",
            timestamp: new Date(),
          },
        };
      }

      // Parse workflow data to match Workflow interface
      const parsedWorkflow: Workflow = {
        ...workflow,
        description: workflow.description || undefined,
        nodes: Array.isArray(workflow.nodes)
          ? workflow.nodes
          : JSON.parse(workflow.nodes as string),
        connections: Array.isArray(workflow.connections)
          ? workflow.connections
          : JSON.parse(workflow.connections as string),
        triggers: Array.isArray(workflow.triggers)
          ? workflow.triggers
          : JSON.parse(workflow.triggers as string),
        settings:
          typeof workflow.settings === "object"
            ? workflow.settings
            : JSON.parse(workflow.settings as string),
      };

      const flowOptions: FlowExecutionOptions = {
        timeout: options.timeout || 300000,
        saveProgress: true,
        saveData: true,
        manual: true,
        isolatedExecution: false,
      };

      const flowResult = await this.flowExecutionEngine.executeFromNode(
        nodeId,
        workflowId,
        userId,
        inputData ? { main: [[inputData]] } : undefined,
        flowOptions,
        parsedWorkflow // Pass the parsed workflow data to avoid re-loading
      );

      // Create execution record in database
      const executionRecord = await this.createFlowExecutionRecord(
        flowResult,
        workflowId,
        userId,
        inputData,
        // Pass workflow snapshot
        parsedWorkflow
          ? {
            nodes: parsedWorkflow.nodes,
            connections: parsedWorkflow.connections,
            settings: parsedWorkflow.settings,
          }
          : undefined,
        options // Pass options to check saveToDatabase
      );

      // Collect error information from failed nodes
      let executionError: any = undefined;
      if (flowResult.failedNodes.length > 0) {
        const failedNodeErrors: string[] = [];

        for (const [nodeId, nodeResult] of flowResult.nodeResults) {
          if (nodeResult.status === "failed" && nodeResult.error) {
            const errorMessage =
              nodeResult.error instanceof Error
                ? nodeResult.error.message
                : String(nodeResult.error);
            failedNodeErrors.push(`Node ${nodeId}: ${errorMessage}`);
          }
        }

        executionError = {
          message:
            failedNodeErrors.length > 0
              ? failedNodeErrors.join("; ")
              : `${flowResult.failedNodes.length} node(s) failed`,
          timestamp: new Date(),
          failedNodes: flowResult.failedNodes,
        };
      }

      return {
        success: true, // Execution started and ran, even if some nodes failed
        data: {
          executionId: flowResult.executionId,
          status: flowResult.status,
          executedNodes: flowResult.executedNodes,
          failedNodes: flowResult.failedNodes,
          duration: flowResult.totalDuration,
          hasFailures: flowResult.failedNodes.length > 0,
        },
        error: executionError,
      };
    } catch (error) {
      logger.error(`Failed to execute from node ${nodeId}:`, error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Get execution by ID
   */
  async getExecution(
    executionId: string,
    userId: string
  ): Promise<Execution | null> {
    try {


      const execution = await this.prisma.execution.findFirst({
        where: {
          id: executionId,
          workflow: { userId },
        },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          nodeExecutions: {
            orderBy: { startedAt: "asc" },
          },
        },
      });

      if (!execution) {
        // Try to find the execution without user filter for debugging
        const executionWithoutUserFilter =
          await this.prisma.execution.findUnique({
            where: { id: executionId },
            include: { workflow: true },
          });

        if (executionWithoutUserFilter) {
          logger.warn(
            `Execution ${executionId} exists but not for user ${userId}. Workflow userId: ${executionWithoutUserFilter.workflow?.userId}`
          );
        } else {
          logger.warn(`Execution ${executionId} not found in database`);
        }
      } else {

      }

      return execution as any;
    } catch (error) {
      logger.error(`Failed to get execution ${executionId}:`, error);
      return null;
    }
  }

  /**
   * List executions with filtering and pagination
   */
  async listExecutions(
    userId: string,
    filters: ExecutionFilters = {}
  ): Promise<{
    executions: Execution[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        status,
        workflowId,
        startDate,
        endDate,
        limit = 20,
        offset = 0,
      } = filters;

      const where: any = {
        workflow: { userId },
      };

      if (status) {
        where.status = status;
      }

      if (workflowId) {
        where.workflowId = workflowId;
      }

      if (startDate || endDate) {
        where.startedAt = {};
        if (startDate) where.startedAt.gte = startDate;
        if (endDate) where.startedAt.lte = endDate;
      }

      const [executions, total] = await Promise.all([
        this.prisma.execution.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { startedAt: "desc" },
          include: {
            workflow: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            _count: {
              select: {
                nodeExecutions: true,
              },
            },
          },
        }),
        this.prisma.execution.count({ where }),
      ]);

      const page = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(total / limit);

      return {
        executions: executions as any,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error(`Failed to list executions for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(
    executionId: string,
    userId: string
  ): Promise<ExecutionResult> {
    try {
      // Verify execution belongs to user
      const execution = await this.prisma.execution.findFirst({
        where: {
          id: executionId,
          workflow: { userId },
        },
      });

      if (!execution) {
        return {
          success: false,
          error: {
            message: "Execution not found",
            timestamp: new Date(),
          },
        };
      }

      if (execution.status !== ExecutionStatus.RUNNING) {
        return {
          success: false,
          error: {
            message: "Can only cancel running executions",
            timestamp: new Date(),
          },
        };
      }

      await this.executionEngine.cancelExecution(executionId);

      return {
        success: true,
        data: { message: "Execution cancelled successfully" },
      };
    } catch (error) {
      logger.error(`Failed to cancel execution ${executionId}:`, error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Retry a failed execution
   */
  async retryExecution(
    executionId: string,
    userId: string
  ): Promise<ExecutionResult> {
    try {
      // Get the original execution
      const originalExecution = await this.prisma.execution.findFirst({
        where: {
          id: executionId,
          workflow: { userId },
        },
        include: {
          workflow: true,
        },
      });

      if (!originalExecution) {
        return {
          success: false,
          error: {
            message: "Execution not found",
            timestamp: new Date(),
          },
        };
      }

      if (originalExecution.status === ExecutionStatus.RUNNING) {
        return {
          success: false,
          error: {
            message: "Cannot retry running execution",
            timestamp: new Date(),
          },
        };
      }

      // Start a new execution with the same trigger data
      const newExecutionId = await this.executionEngine.executeWorkflow(
        originalExecution.workflowId,
        userId,
        originalExecution.triggerData
      );

      return {
        success: true,
        data: { executionId: newExecutionId },
      };
    } catch (error) {
      logger.error(`Failed to retry execution ${executionId}:`, error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Delete an execution
   */
  async deleteExecution(
    executionId: string,
    userId: string
  ): Promise<ExecutionResult> {
    try {
      // Verify execution belongs to user and is not running
      const execution = await this.prisma.execution.findFirst({
        where: {
          id: executionId,
          workflow: { userId },
        },
      });

      if (!execution) {
        return {
          success: false,
          error: {
            message: "Execution not found",
            timestamp: new Date(),
          },
        };
      }

      if (execution.status === ExecutionStatus.RUNNING) {
        return {
          success: false,
          error: {
            message: "Cannot delete running execution",
            timestamp: new Date(),
          },
        };
      }

      // Delete execution and related node executions (cascade should handle this)
      await this.prisma.execution.delete({
        where: { id: executionId },
      });

      return {
        success: true,
        data: { message: "Execution deleted successfully" },
      };
    } catch (error) {
      logger.error(`Failed to delete execution ${executionId}:`, error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Get execution progress
   */
  async getExecutionProgress(
    executionId: string,
    userId: string
  ): Promise<ExecutionProgress | null> {
    try {
      // Verify execution belongs to user
      const execution = await this.prisma.execution.findFirst({
        where: {
          id: executionId,
          workflow: { userId },
        },
      });

      if (!execution) {
        return null;
      }

      // Check if this is a flow execution (new FlowExecutionEngine)
      if (
        execution.executionType === "flow" ||
        execution.executionType === "workflow"
      ) {
        // Try to get from active FlowExecutionEngine first
        const flowStatus =
          this.flowExecutionEngine.getExecutionStatus(executionId);

        if (flowStatus) {
          // Active execution - use real-time status from FlowExecutionEngine
          return {
            executionId: flowStatus.executionId,
            totalNodes: flowStatus.nodeStates.size,
            completedNodes: flowStatus.completedNodes.length,
            failedNodes: flowStatus.failedNodes.length,
            currentNode: flowStatus.currentlyExecuting[0],
            status: flowStatus.overallStatus as any,
            startedAt: execution.startedAt,
            finishedAt: execution.finishedAt || undefined,
            error:
              flowStatus.failedNodes.length > 0
                ? {
                  message: "Some nodes failed during execution",
                  timestamp: new Date(),
                }
                : undefined,
          };
        }

        // Completed execution - get status from database
        // Get node execution data from database for completed workflow
        const nodeExecutions = await this.prisma.nodeExecution.findMany({
          where: { executionId },
        });

        const totalNodes = nodeExecutions.length;
        const completedNodes = nodeExecutions.filter(
          (ne) => ne.status === "SUCCESS"
        ).length;
        const failedNodes = nodeExecutions.filter(
          (ne) => ne.status === "ERROR"
        ).length;
        const runningNode = nodeExecutions.find(
          (ne) => ne.status === "RUNNING"
        );

        // Determine the correct status based on execution results
        let progressStatus:
          | "running"
          | "success"
          | "error"
          | "cancelled"
          | "paused"
          | "partial";

        if (execution.status === "RUNNING") {
          progressStatus = "running";
        } else if (execution.status === "CANCELLED") {
          progressStatus = "cancelled";
        } else if (execution.status === "PAUSED") {
          progressStatus = "paused";
        } else if (failedNodes > 0 && completedNodes > 0) {
          // Some nodes succeeded and some failed = partial
          progressStatus = "partial";
        } else if (failedNodes > 0) {
          // All executed nodes failed = error
          progressStatus = "error";
        } else if (completedNodes > 0) {
          // All executed nodes succeeded = success
          progressStatus = "success";
        } else {
          // No nodes executed or unknown state = error
          progressStatus = "error";
        }

        return {
          executionId,
          totalNodes,
          completedNodes,
          failedNodes,
          currentNode: runningNode?.nodeId,
          status: progressStatus,
          startedAt: execution.startedAt,
          finishedAt: execution.finishedAt || undefined,
          error: execution.error
            ? {
              message: (execution.error as any).message || "Execution failed",
              stack: (execution.error as any).stack,
              nodeId: (execution.error as any).nodeId,
              timestamp: new Date(
                (execution.error as any).timestamp || execution.finishedAt
              ),
            }
            : undefined,
        };
      }

      // Use ExecutionEngine for single node executions
      return await this.executionEngine.getExecutionProgress(executionId);
    } catch (error) {
      logger.error(
        `Failed to get execution progress for ${executionId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get execution statistics
   */
  async getExecutionStats(userId?: string): Promise<ExecutionStats> {
    try {
      if (userId) {
        // Get stats for specific user
        const [
          totalExecutions,
          runningExecutions,
          completedExecutions,
          failedExecutions,
          cancelledExecutions,
        ] = await Promise.all([
          this.prisma.execution.count({
            where: { workflow: { userId } },
          }),
          this.prisma.execution.count({
            where: { workflow: { userId }, status: ExecutionStatus.RUNNING },
          }),
          this.prisma.execution.count({
            where: { workflow: { userId }, status: ExecutionStatus.SUCCESS },
          }),
          this.prisma.execution.count({
            where: { workflow: { userId }, status: ExecutionStatus.ERROR },
          }),
          this.prisma.execution.count({
            where: { workflow: { userId }, status: ExecutionStatus.CANCELLED },
          }),
        ]);

        return {
          totalExecutions,
          runningExecutions,
          completedExecutions,
          failedExecutions,
          cancelledExecutions,
          averageExecutionTime: 0, // TODO: Calculate from actual execution times
          queueSize: 0, // User-specific queue size not available
        };
      } else {
        // Get global stats from execution engine
        return await this.executionEngine.getExecutionStats();
      }
    } catch (error) {
      logger.error("Failed to get execution stats:", error);
      throw error;
    }
  }

  /**
   * Get node execution details
   */
  async getNodeExecution(
    executionId: string,
    nodeId: string,
    userId: string
  ): Promise<NodeExecution | null> {
    try {
      const nodeExecution = await this.prisma.nodeExecution.findFirst({
        where: {
          executionId,
          nodeId,
          execution: {
            workflow: { userId },
          },
        },
      });

      return nodeExecution as any;
    } catch (error) {
      logger.error(
        `Failed to get node execution ${nodeId} for execution ${executionId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Setup event handlers for execution engine events
   */
  private setupEventHandlers(): void {
    // Legacy ExecutionEngine events
    this.executionEngine.on("execution-event", (eventData) => {


      // Broadcast to Socket.IO for real-time frontend updates
      if (global.socketService) {
        global.socketService.broadcastExecutionEvent(
          eventData.executionId,
          eventData
        );
      }
    });

    this.executionEngine.on("execution-progress", (progressData) => {


      // Broadcast progress updates
      if (global.socketService) {
        global.socketService.broadcastExecutionProgress(
          progressData.executionId,
          progressData
        );
      }
    });

    this.executionEngine.on("node-execution-event", (nodeEventData) => {


      // Broadcast node-specific events
      if (global.socketService) {
        global.socketService.broadcastNodeExecutionEvent(
          nodeEventData.executionId,
          nodeEventData.nodeId,
          nodeEventData.type,
          nodeEventData.data
        );
      }
    });

    // FlowExecutionEngine events
    this.flowExecutionEngine.on("flowExecutionCompleted", (flowResult) => {


      // Broadcast flow completion event to BOTH execution room and workflow room
      if (global.socketService) {
        global.socketService.broadcastExecutionEvent(
          flowResult.executionId,
          {
            executionId: flowResult.executionId,
            type: "completed",
            timestamp: new Date(),
            data: {
              status: flowResult.status,
              executedNodes: flowResult.executedNodes,
              failedNodes: flowResult.failedNodes,
              duration: flowResult.totalDuration,
            },
          },
          flowResult.workflowId // Pass workflowId to broadcast to workflow room
        );
      }
    });

    this.flowExecutionEngine.on("nodeExecuted", (nodeEventData: any) => {


      // Broadcast node execution updates for flow to BOTH execution room and workflow room
      if (global.socketService) {
        // Determine if node succeeded or failed - fix the logic here
        const eventType =
          nodeEventData.status === "FAILED" ||
            nodeEventData.result?.status === "failed"
            ? "node-failed"
            : "node-completed";



        global.socketService.broadcastExecutionEvent(
          nodeEventData.executionId,
          {
            executionId: nodeEventData.executionId,
            type: eventType,
            nodeId: nodeEventData.nodeId,
            status: nodeEventData.status,
            data: nodeEventData.result,
            error: nodeEventData.result?.error,
            timestamp: new Date(),
          },
          nodeEventData.workflowId // Pass workflowId to broadcast to workflow room
        );
      } else {
        logger.warn(
          "Global socketService is not available for node execution broadcast"
        );
      }
    });

    this.flowExecutionEngine.on("nodeStarted", (nodeEventData) => {
      // Broadcast node start events for flow
      if (global.socketService) {

        global.socketService.broadcastExecutionEvent(
          nodeEventData.executionId,
          {
            executionId: nodeEventData.executionId,
            type: "node-started",
            nodeId: nodeEventData.nodeId,
            status: "RUNNING",
            data: nodeEventData.node,
            timestamp: new Date(),
          }
        );
      } else {
        logger.warn(
          "Global socketService is not available for node start broadcast"
        );
      }
    });

    this.flowExecutionEngine.on("executionCancelled", (eventData) => {


      // Broadcast cancellation event
      if (global.socketService) {
        global.socketService.broadcastExecutionEvent(eventData.executionId, {
          executionId: eventData.executionId,
          type: "cancelled",
          timestamp: new Date(),
        });
      }
    });

    this.flowExecutionEngine.on("executionPaused", (eventData) => {


      // Broadcast pause event
      if (global.socketService) {
        global.socketService.broadcastExecutionEvent(eventData.executionId, {
          executionId: eventData.executionId,
          type: "node-status-update",
          timestamp: new Date(),
          data: { status: "paused" },
        });
      }
    });

    this.flowExecutionEngine.on("executionResumed", (eventData) => {


      // Broadcast resume event
      if (global.socketService) {
        global.socketService.broadcastExecutionEvent(eventData.executionId, {
          executionId: eventData.executionId,
          type: "node-status-update",
          timestamp: new Date(),
          data: { status: "resumed" },
        });
      }
    });
  }

  /**
   * Execute a single node or workflow from a node
   * @param mode 'single' = execute only this node in isolation, 'workflow' = execute workflow starting from this node
   */
  async executeSingleNode(
    workflowId: string,
    nodeId: string,
    userId: string,
    inputData?: any,
    parameters?: Record<string, any>,
    mode: "single" | "workflow" = "single",
    workflowData?: { nodes?: any[]; connections?: any[]; settings?: any } // Optional workflow data
  ): Promise<ExecutionResult> {
    try {


      let workflowNodes: any[];
      let workflowName: string;

      // Use passed workflow data if available, otherwise load from database
      if (workflowData && workflowData.nodes) {
        // Use passed workflow data (for unsaved workflows)
        workflowNodes = workflowData.nodes;
        workflowName = "Unsaved Workflow";

        logger.info(
          `Using passed workflow data with ${workflowNodes.length} nodes`,
          {
            nodeId,
            workflowId,
            totalNodes: workflowNodes.length,
            nodeIds: workflowNodes.map((n: any) => n.id),
          }
        );
      } else {
        // Load workflow from database (existing behavior)
        const workflow = await this.prisma.workflow.findFirst({
          where: {
            id: workflowId,
            userId,
          },
        });

        if (!workflow) {
          logger.error(`Workflow ${workflowId} not found for user ${userId}`);
          return {
            success: false,
            error: {
              message: "Workflow not found",
              timestamp: new Date(),
            },
          };
        }



        // Parse nodes from JSON
        workflowNodes = Array.isArray(workflow.nodes)
          ? workflow.nodes
          : JSON.parse(workflow.nodes as string);
        workflowName = workflow.name;
      }



      // Find the specific node
      const node = workflowNodes.find((n: any) => n.id === nodeId);
      if (!node) {
        logger.error(`Node ${nodeId} not found in workflow ${workflowId}`, {
          nodeId,
          workflowId,
          availableNodeIds: workflowNodes.map((n: any) => n.id),
          totalNodes: workflowNodes.length,
        });
        return {
          success: false,
          error: {
            message: "Node not found in workflow",
            stack: `Available nodes: ${workflowNodes
              .map((n: any) => n.id)
              .join(", ")}`,
            timestamp: new Date(),
            nodeId: nodeId,
          },
        };
      }

      // Check if node can be executed individually (trigger nodes)


      let nodeTypeInfo;
      try {
        nodeTypeInfo = await this.nodeService.getNodeSchema(node.type);
      } catch (schemaError) {
        logger.error(`Failed to get node schema for ${node.type}`, {
          nodeId,
          nodeType: node.type,
          nodeName: node.name || "unnamed",
          error: schemaError,
        });
        return {
          success: false,
          error: {
            message: `Failed to load node type schema: ${schemaError instanceof Error
              ? schemaError.message
              : "Unknown error"
              }`,
            stack: schemaError instanceof Error ? schemaError.stack : undefined,
            timestamp: new Date(),
            nodeId: nodeId,
          },
        };
      }

      if (!nodeTypeInfo) {
        logger.error(`Node type schema not found for ${node.type}`, {
          nodeId,
          nodeType: node.type,
          nodeName: node.name || "unnamed",
        });
        return {
          success: false,
          error: {
            message: `Unknown node type: ${node.type}`,
            stack: `Node schema not found for type '${node.type}'. This node type may not be registered or available.`,
            timestamp: new Date(),
            nodeId: nodeId,
          },
        };
      }

      // Handle execution based on mode
      const nodeDef = this.nodeService.getNodeDefinitionSync(node.type);
      const isTriggerNode = nodeDef?.triggerType !== undefined;

      if (mode === "workflow" && !isTriggerNode) {
        return {
          success: false,
          error: {
            message: "Workflow execution mode requires a trigger node",
            timestamp: new Date(),
          },
        };
      }

      // Prepare node parameters (merge defaults with provided parameters)
      const nodeParameters = {
        ...nodeTypeInfo.defaults,
        ...node.parameters,
        ...(parameters || {}),
      };

      // Build credentials mapping from parameters
      // Extract credential field values and map them to credential types
      let credentialsMapping: Record<string, string> = {};

      if (nodeTypeInfo.properties) {
        const properties = Array.isArray(nodeTypeInfo.properties)
          ? nodeTypeInfo.properties
          : [];

        for (const property of properties) {
          // Check if this is a credential field
          if (
            property.type === "credential" &&
            property.allowedTypes &&
            property.allowedTypes.length > 0
          ) {
            // Get the credential ID from parameters using the field name
            const credentialId = nodeParameters[property.name];

            if (credentialId && typeof credentialId === "string") {
              // Verify credential exists and get its actual type
              const cred = await this.prisma.credential.findUnique({
                where: { id: credentialId },
                select: { type: true, userId: true }
              });

              if (cred) {
                if (cred.userId !== userId) {
                  logger.warn(`Credential ${credentialId} does not belong to user ${userId}`);
                  continue;
                }
                // Map the actual credential type from the database to the credential ID
                // This ensures the node can request credentials by their actual type
                credentialsMapping[cred.type] = credentialId;
                logger.info(`Mapped credential type '${cred.type}' to ID '${credentialId}' from parameter '${property.name}'`);
              } else {
                logger.warn(`Credential ${credentialId} not found in database`);
              }
            }
          }
        }
      }

      // Prepare input data for the node
      const nodeInputData = inputData || { main: [[]] };

      try {
        if (mode === "workflow") {
          // For workflow mode, we need the full workflow data
          let parsedWorkflow: Workflow;

          if (workflowData && workflowData.nodes) {
            // Use passed workflow data
            parsedWorkflow = {
              id: workflowId,
              userId,
              name: workflowName,
              description: undefined,
              nodes: workflowData.nodes,
              connections: workflowData.connections || [],
              settings: workflowData.settings || {},
              triggers: [],
              active: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          } else {
            // Load from database
            const workflow = await this.prisma.workflow.findFirst({
              where: {
                id: workflowId,
                userId,
              },
            });

            if (!workflow) {
              return {
                success: false,
                error: {
                  message: "Workflow not found",
                  timestamp: new Date(),
                },
              };
            }

            parsedWorkflow = {
              ...workflow,
              description: workflow.description || undefined,
              nodes: Array.isArray(workflow.nodes)
                ? workflow.nodes
                : JSON.parse(workflow.nodes as string),
              connections: Array.isArray(workflow.connections)
                ? workflow.connections
                : JSON.parse(workflow.connections as string),
              triggers: Array.isArray(workflow.triggers)
                ? workflow.triggers
                : JSON.parse(workflow.triggers as string),
              settings:
                typeof workflow.settings === "object"
                  ? workflow.settings
                  : JSON.parse(workflow.settings as string),
            };
          }

          // Workflow execution mode: execute entire workflow from trigger node
          const flowResult = await this.flowExecutionEngine.executeFromNode(
            nodeId,
            workflowId,
            userId,
            nodeInputData,
            {
              timeout: 300000, // 5 minutes
              saveProgress: true,
              saveData: true,
              manual: true,
              isolatedExecution: false,
            },
            parsedWorkflow // Pass the parsed workflow data
          );

          // Create execution record in database
          const executionRecord = await this.createFlowExecutionRecord(
            flowResult,
            workflowId,
            userId,
            nodeInputData,
            undefined, // No workflow snapshot for single node execution
            undefined // No options - always save single node executions
          );



          // Collect error information from failed nodes
          let executionError: any = undefined;
          if (flowResult.failedNodes.length > 0) {
            const failedNodeErrors: string[] = [];

            for (const [failedNodeId, nodeResult] of flowResult.nodeResults) {
              if (nodeResult.status === "failed" && nodeResult.error) {
                const errorMessage =
                  nodeResult.error instanceof Error
                    ? nodeResult.error.message
                    : String(nodeResult.error);
                failedNodeErrors.push(`Node ${failedNodeId}: ${errorMessage}`);
              }
            }

            executionError = {
              message:
                failedNodeErrors.length > 0
                  ? failedNodeErrors.join("; ")
                  : `${flowResult.failedNodes.length} node(s) failed`,
              timestamp: new Date(),
              failedNodes: flowResult.failedNodes,
            };
          }

          return {
            success: true, // Execution started and ran, even if some nodes failed
            data: {
              executionId: flowResult.executionId,
              status: flowResult.status, // Use the same status values as main workflow execution
              executedNodes: flowResult.executedNodes,
              failedNodes: flowResult.failedNodes,
              duration: flowResult.totalDuration,
              hasFailures: flowResult.failedNodes.length > 0,
            },
            error: executionError,
          };
        } else {
          // Single node execution mode: execute only this node in isolation
          const startTime = Date.now();

          let nodeResult;

          // For single node execution, always execute the actual node (skip mock data)
          // Mock data should only be used in test scenarios, not for real single node execution


          // Execute the actual node (credentials mapping already built earlier)
          // Note: For single node execution, we don't have nodeOutputs from previous nodes
          // The user should use the InputsColumn to see available data from connected nodes
          nodeResult = await this.nodeService.executeNode(
            node.type,
            nodeParameters,
            nodeInputData,
            credentialsMapping,
            `single_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId, // Pass the actual userId so credentials can be looked up
            undefined, // options
            workflowId, // Pass workflowId for variable resolution
            (node as any).settings || {}, // Pass node settings
            undefined // nodeOutputs - not available for single node execution
          );

          const endTime = Date.now();
          const duration = endTime - startTime;

          // Generate proper UUID for execution ID (same as workflow executions)
          const executionId = uuidv4();

          // Skip database save for individual node executions
          // Individual node executions are for testing/debugging and shouldn't clutter execution history
          // logger.info(`Skipping database save for individual node execution`, {
          //   executionId,
          //   nodeId,
          //   workflowId,
          // });



          // Prepare error information if node failed
          let executionError: any = undefined;
          if (!nodeResult.success) {
            // Extract detailed error information
            let errorMessage = "Node execution failed";
            let errorStack: string | undefined;

            if (nodeResult.error) {
              if (typeof nodeResult.error === "string") {
                errorMessage = nodeResult.error;
              } else if (
                nodeResult.error &&
                typeof nodeResult.error === "object"
              ) {
                errorMessage = nodeResult.error.message || errorMessage;
                errorStack = nodeResult.error.stack;
              }
            }

            executionError = {
              message: errorMessage,
              stack: errorStack,
              timestamp: new Date(),
              nodeId: nodeId,
            };
          }

          // Format the response to match the structure from external webhook triggers
          // This ensures consistency between execute button and actual webhook triggers
          const nodeExecutionResult = {
            nodeId: nodeId,
            status: nodeResult.success ? "completed" : "failed",
            data: nodeResult.data ? JSON.parse(JSON.stringify(nodeResult.data)) : undefined,
            error: executionError,
            duration,
          };

          return {
            success: true, // Execution started and ran, even if node failed
            data: {
              executionId: executionId,
              status: nodeResult.success ? "completed" : "failed", // Use same status values as workflow execution
              executedNodes: [nodeId],
              failedNodes: nodeResult.success ? [] : [nodeId],
              duration,
              hasFailures: !nodeResult.success,
              // Include output data in the same format as FlowExecutionEngine emits via socket
              nodeExecutions: [nodeExecutionResult],
            },
            error: executionError,
          };
        }
      } catch (flowError) {
        logger.error(`FlowExecutionEngine failed for node ${nodeId}:`, {
          error: flowError,
          errorMessage:
            flowError instanceof Error ? flowError.message : String(flowError),
          errorStack: flowError instanceof Error ? flowError.stack : undefined,
          nodeId,
          workflowId,
          userId,
        });

        // Return more specific error information
        const errorMessage =
          flowError instanceof Error
            ? flowError.message
            : typeof flowError === "string"
              ? flowError
              : "Flow execution failed with unknown error";

        return {
          success: false,
          error: {
            message: errorMessage,
            stack: flowError instanceof Error ? flowError.stack : undefined,
            timestamp: new Date(),
            nodeId: nodeId,
          },
        };
      }
    } catch (error) {
      logger.error(`Failed to execute single node ${nodeId}:`, error);

      // Skip database save for individual node executions (even on error)
      // Individual node executions are for testing/debugging and shouldn't clutter execution history

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date(),
          nodeId: nodeId,
        },
      };
    }
  }

  /**
   * Convert node results to the format expected by the response extraction logic
   */
  private convertNodeResultsToRunData(nodeResults: Map<string, any>): any {
    const runData: any = {};

    for (const [nodeId, result] of nodeResults) {
      if (result.data && result.status === 'completed') {
        // Convert the standardized output back to the expected format
        runData[nodeId] = [{
          data: {
            main: result.data.main || [[]]
          }
        }];
      }
    }

    return runData;
  }

  /**
   * Create execution record for flow execution in database
   */
  private async createFlowExecutionRecord(
    flowResult: FlowExecutionResult,
    workflowId: string,
    userId: string,
    triggerData?: any,
    workflowSnapshot?: { nodes: any[]; connections: any[]; settings?: any },
    options?: ExecutionOptions
  ): Promise<any> {
    try {
      // Skip database save if configured
      if (options?.saveToDatabase === false) {
        console.log(`⏭️  Skipping database save for execution ${flowResult.executionId} (saveToDatabase: false)`);
        logger.info(`Skipping database save for execution`, {
          executionId: flowResult.executionId,
          workflowId,
        });
        
        // Return a minimal execution record for compatibility
        return {
          id: flowResult.executionId,
          workflowId,
          status: flowResult.status === "completed" ? ExecutionStatus.SUCCESS : ExecutionStatus.ERROR,
          startedAt: new Date(Date.now() - flowResult.totalDuration),
          finishedAt: new Date(),
        };
      }
      // Map flow status to execution status
      let executionStatus: ExecutionStatus;
      switch (flowResult.status) {
        case "completed":
          executionStatus = ExecutionStatus.SUCCESS;
          break;
        case "failed":
          executionStatus = ExecutionStatus.ERROR;
          break;
        case "cancelled":
          executionStatus = ExecutionStatus.CANCELLED;
          break;
        case "partial":
          executionStatus = ExecutionStatus.ERROR; // Partial completion is treated as error
          break;
        default:
          executionStatus = ExecutionStatus.ERROR;
      }

      // Handle unsaved workflows (workflowId = "new")
      let actualWorkflowId = workflowId;
      if (workflowId === "new" && workflowSnapshot) {
        // Create a temporary workflow record for unsaved workflows
        const tempWorkflow = await this.prisma.workflow.create({
          data: {
            name: "Unsaved Workflow",
            description: "Temporary workflow created for execution",
            userId,
            nodes: workflowSnapshot.nodes || [],
            connections: workflowSnapshot.connections || [],
            settings: workflowSnapshot.settings || {},
            active: false, // Mark as inactive since it's temporary
            tags: ["temporary", "unsaved"]
          }
        });
        actualWorkflowId = tempWorkflow.id;
      }

      // Create main execution record with workflow snapshot
      const execution = await this.prisma.execution.create({
        data: {
          id: flowResult.executionId,
          workflowId: actualWorkflowId,
          status: executionStatus,
          startedAt: new Date(Date.now() - flowResult.totalDuration),
          finishedAt: new Date(),
          triggerData: triggerData || undefined,
          workflowSnapshot: workflowSnapshot || undefined, // Store workflow state at execution time
          error:
            flowResult.status === "failed" || flowResult.status === "partial"
              ? {
                message: "Flow execution failed",
                failedNodes: flowResult.failedNodes,
                executionPath: flowResult.executionPath,
              }
              : undefined,
        },
      });

      // Create node execution records
      for (const [nodeId, nodeResult] of flowResult.nodeResults) {
        let nodeStatus: "SUCCESS" | "ERROR" | "CANCELLED";
        switch (nodeResult.status) {
          case "completed":
            nodeStatus = "SUCCESS";
            break;
          case "failed":
            nodeStatus = "ERROR";
            break;
          case "cancelled":
            nodeStatus = "CANCELLED";
            break;
          default:
            nodeStatus = "ERROR";
        }

        // Serialize error properly for database storage
        let errorData = undefined;
        if (nodeResult.error) {
          if (nodeResult.error instanceof Error) {
            errorData = {
              message: nodeResult.error.message,
              name: nodeResult.error.name,
              stack: nodeResult.error.stack,
            };
          } else if (typeof nodeResult.error === "object") {
            errorData = nodeResult.error;
          } else {
            errorData = { message: String(nodeResult.error) };
          }
        }

        await this.prisma.nodeExecution.create({
          data: {
            id: `${flowResult.executionId}_${nodeId}`,
            executionId: flowResult.executionId,
            nodeId: nodeId,
            status: nodeStatus as any,
            startedAt: new Date(),
            finishedAt: new Date(Date.now() + nodeResult.duration),
            inputData: {}, // TODO: Add actual input data
            outputData: nodeResult.data ? JSON.parse(JSON.stringify(nodeResult.data)) : undefined,
            error: errorData,
          },
        });
      }

      return execution;
    } catch (error) {
      logger.error("Failed to create flow execution record:", error);
      throw error;
    }
  }

  /**
   * Get flow execution status from FlowExecutionEngine
   */
  async getFlowExecutionStatus(executionId: string): Promise<any> {
    return this.flowExecutionEngine.getExecutionStatus(executionId);
  }

  /**
   * Cancel flow execution
   */
  async cancelFlowExecution(executionId: string): Promise<ExecutionResult> {
    try {
      await this.flowExecutionEngine.cancelExecution(executionId);

      return {
        success: true,
        data: { message: "Flow execution cancelled successfully" },
      };
    } catch (error) {
      logger.error(`Failed to cancel flow execution ${executionId}:`, error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Pause flow execution
   */
  async pauseFlowExecution(executionId: string): Promise<ExecutionResult> {
    try {
      await this.flowExecutionEngine.pauseExecution(executionId);

      return {
        success: true,
        data: { message: "Flow execution paused successfully" },
      };
    } catch (error) {
      logger.error(`Failed to pause flow execution ${executionId}:`, error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Resume flow execution
   */
  async resumeFlowExecution(executionId: string): Promise<ExecutionResult> {
    try {
      await this.flowExecutionEngine.resumeExecution(executionId);

      return {
        success: true,
        data: { message: "Flow execution resumed successfully" },
      };
    } catch (error) {
      logger.error(`Failed to resume flow execution ${executionId}:`, error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Get execution engine instance (for advanced usage)
   */
  getExecutionEngine(): ExecutionEngine {
    return this.executionEngine;
  }

  /**
   * Get flow execution engine instance (for advanced usage)
   */
  getFlowExecutionEngine(): FlowExecutionEngine {
    return this.flowExecutionEngine;
  }

  /**
   * Shutdown the execution service
   */
  async shutdown(): Promise<void> {
    await this.executionEngine.shutdown();
  }
}
