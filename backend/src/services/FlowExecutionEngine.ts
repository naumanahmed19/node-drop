import { PrismaClient } from "@prisma/client";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { Workflow } from "../types/database";
import { NodeInputData, StandardizedNodeOutput } from "../types/node.types";
import { logger } from "../utils/logger";
import { DependencyResolver } from "./DependencyResolver";
import ExecutionHistoryService from "./ExecutionHistoryService";
import { NodeService } from "./NodeService";

export interface FlowExecutionContext {
  executionId: string;
  workflowId: string;
  userId: string;
  triggerNodeId?: string;
  triggerData?: any;
  executionOptions: FlowExecutionOptions;
  nodeStates: Map<string, NodeExecutionState>;
  executionPath: string[];
  startTime: number;
  cancelled: boolean;
  paused: boolean;
}

export interface FlowExecutionOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  saveProgress?: boolean;
  saveData?: boolean;
  manual?: boolean;
  isolatedExecution?: boolean;
}

// Status mapping between design document and Prisma enum
export enum FlowNodeStatus {
  IDLE = "idle",
  QUEUED = "queued",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  SKIPPED = "skipped",
}

export interface NodeExecutionState {
  nodeId: string;
  status: FlowNodeStatus;
  startTime?: number;
  endTime?: number;
  duration?: number;
  progress?: number;
  error?: any;
  inputData?: NodeInputData;
  outputData?: StandardizedNodeOutput; // Changed from NodeOutputData[] to StandardizedNodeOutput
  dependencies: string[];
  dependents: string[];
}

export interface FlowExecutionResult {
  executionId: string;
  workflowId: string; // Added to support workflow-level socket broadcasts
  status: "completed" | "failed" | "cancelled" | "partial";
  executedNodes: string[];
  failedNodes: string[];
  executionPath: string[];
  totalDuration: number;
  nodeResults: Map<string, NodeExecutionResult>;
}

export interface NodeExecutionResult {
  nodeId: string;
  status: FlowNodeStatus;
  data?: StandardizedNodeOutput; // Changed from NodeOutputData[] to StandardizedNodeOutput
  error?: any;
  duration: number;
}

export interface ExecutionFlowStatus {
  executionId: string;
  overallStatus: "running" | "completed" | "failed" | "cancelled" | "paused";
  progress: number;
  nodeStates: Map<string, NodeExecutionState>;
  currentlyExecuting: string[];
  completedNodes: string[];
  failedNodes: string[];
  queuedNodes: string[];
  executionPath: string[];
  estimatedTimeRemaining?: number;
}

/**
 * FlowExecutionEngine handles the execution of workflow flows with proper dependency resolution
 * and cascade execution from any node to all connected downstream nodes.
 */
export class FlowExecutionEngine extends EventEmitter {
  private prisma: PrismaClient;
  private nodeService: NodeService;
  private executionHistoryService: ExecutionHistoryService;
  private dependencyResolver: DependencyResolver;
  private activeExecutions: Map<string, FlowExecutionContext> = new Map();
  private nodeQueue: Map<string, string[]> = new Map();

  constructor(
    prisma: PrismaClient,
    nodeService: NodeService,
    executionHistoryService: ExecutionHistoryService
  ) {
    super();
    this.prisma = prisma;
    this.nodeService = nodeService;
    this.executionHistoryService = executionHistoryService;
    this.dependencyResolver = new DependencyResolver();
  }

  /**
   * Execute workflow flow starting from a specific node
   */
  async executeFromNode(
    nodeId: string,
    workflowId: string,
    userId: string,
    inputData?: NodeInputData,
    options: FlowExecutionOptions = {},
    workflowData?: Workflow, // Optional workflow data to avoid database load
    executionId?: string // Optional execution ID (for trigger-initiated executions)
  ): Promise<FlowExecutionResult> {
    const finalExecutionId = executionId || uuidv4();

    try {
      const context = await this.createExecutionContext(
        finalExecutionId,
        workflowId,
        userId,
        nodeId,
        inputData,
        options
      );

      // Use passed workflow data or load from database
      const workflow = workflowData || (await this.loadWorkflow(workflowId));
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      await this.initializeNodeStates(context, workflow, nodeId);
      const result = await this.executeFlow(context, workflow);

      return result;
    } catch (error) {
      logger.error("Flow execution failed", { executionId: finalExecutionId, nodeId, error });
      throw error;
    } finally {
      this.activeExecutions.delete(finalExecutionId);
      this.nodeQueue.delete(finalExecutionId);
    }
  }

  /**
   * Execute workflow flow starting from a trigger
   */
  async executeFromTrigger(
    triggerId: string,
    workflowId: string,
    userId: string,
    triggerData?: any,
    options: FlowExecutionOptions = {},
    workflowData?: Workflow, // Optional workflow data to avoid database load
    executionId?: string // Optional execution ID (for trigger-initiated executions)
  ): Promise<FlowExecutionResult> {
    const finalExecutionId = executionId || uuidv4();

    try {
      const context = await this.createExecutionContext(
        finalExecutionId,
        workflowId,
        userId,
        triggerId,
        triggerData,
        { ...options, manual: false }
      );

      // Use passed workflow data or load from database
      const workflow = workflowData || (await this.loadWorkflow(workflowId));
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const triggerNode = workflow.nodes.find((node) => node.id === triggerId);
      if (!triggerNode) {
        throw new Error(`Trigger node ${triggerId} not found in workflow`);
      }

      await this.initializeNodeStates(context, workflow, triggerId);
      const result = await this.executeFlow(context, workflow);

      return result;
    } catch (error) {
      logger.error("Trigger execution failed", {
        executionId: finalExecutionId,
        triggerId,
        error,
      });
      throw error;
    } finally {
      this.activeExecutions.delete(finalExecutionId);
      this.nodeQueue.delete(finalExecutionId);
    }
  }

  /**
   * Get current execution status
   */
  getExecutionStatus(executionId: string): ExecutionFlowStatus | null {
    const context = this.activeExecutions.get(executionId);
    if (!context) {
      return null;
    }

    const nodeStates = context.nodeStates;
    const completedNodes = Array.from(nodeStates.entries())
      .filter(([_, state]) => state.status === FlowNodeStatus.COMPLETED)
      .map(([nodeId, _]) => nodeId);

    const failedNodes = Array.from(nodeStates.entries())
      .filter(([_, state]) => state.status === FlowNodeStatus.FAILED)
      .map(([nodeId, _]) => nodeId);

    const currentlyExecuting = Array.from(nodeStates.entries())
      .filter(([_, state]) => state.status === FlowNodeStatus.RUNNING)
      .map(([nodeId, _]) => nodeId);

    const queuedNodes = this.nodeQueue.get(executionId) || [];
    const totalNodes = nodeStates.size;
    const progress =
      totalNodes > 0 ? (completedNodes.length / totalNodes) * 100 : 0;

    let overallStatus:
      | "running"
      | "completed"
      | "failed"
      | "cancelled"
      | "paused" = "running";
    if (context.cancelled) {
      overallStatus = "cancelled";
    } else if (context.paused) {
      overallStatus = "paused";
    } else if (
      failedNodes.length > 0 &&
      currentlyExecuting.length === 0 &&
      queuedNodes.length === 0
    ) {
      overallStatus = "failed";
    } else if (completedNodes.length === totalNodes) {
      overallStatus = "completed";
    }

    return {
      executionId,
      overallStatus,
      progress,
      nodeStates,
      currentlyExecuting,
      completedNodes,
      failedNodes,
      queuedNodes,
      executionPath: context.executionPath,
    };
  }

  /**
   * Cancel an active execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const context = this.activeExecutions.get(executionId);
    if (!context) {
      throw new Error(`Execution ${executionId} not found`);
    }

    context.cancelled = true;
    this.nodeQueue.set(executionId, []);

    logger.info("Execution cancelled", { executionId });
    this.emit("executionCancelled", { executionId });
  }

  /**
   * Pause an active execution
   */
  async pauseExecution(executionId: string): Promise<void> {
    const context = this.activeExecutions.get(executionId);
    if (!context) {
      throw new Error(`Execution ${executionId} not found`);
    }

    context.paused = true;

    logger.info("Execution paused", { executionId });
    this.emit("executionPaused", { executionId });
  }

  /**
   * Resume a paused execution
   */
  async resumeExecution(executionId: string): Promise<void> {
    const context = this.activeExecutions.get(executionId);
    if (!context) {
      throw new Error(`Execution ${executionId} not found`);
    }

    context.paused = false;

    logger.info("Execution resumed", { executionId });
    this.emit("executionResumed", { executionId });
  }

  /**
   * Get the dependency resolver instance for external use
   */
  getDependencyResolver(): DependencyResolver {
    return this.dependencyResolver;
  }

  private async createExecutionContext(
    executionId: string,
    workflowId: string,
    userId: string,
    triggerNodeId?: string,
    triggerData?: any,
    options: FlowExecutionOptions = {}
  ): Promise<FlowExecutionContext> {
    const context: FlowExecutionContext = {
      executionId,
      workflowId,
      userId,
      triggerNodeId,
      triggerData,
      executionOptions: {
        timeout: 300000,
        maxRetries: 3,
        retryDelay: 1000,
        saveProgress: true,
        saveData: true,
        manual: true,
        isolatedExecution: false,
        ...options,
      },
      nodeStates: new Map(),
      executionPath: [],
      startTime: Date.now(),
      cancelled: false,
      paused: false,
    };

    this.activeExecutions.set(executionId, context);
    this.nodeQueue.set(executionId, []);

    return context;
  }

  private async loadWorkflow(workflowId: string): Promise<Workflow | null> {
    try {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow) {
        return null;
      }

      // Parse JSON fields to match the Workflow interface
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

      return parsedWorkflow;
    } catch (error) {
      logger.error("Failed to load workflow", { workflowId, error });
      return null;
    }
  }

  private async initializeNodeStates(
    context: FlowExecutionContext,
    workflow: Workflow,
    startNodeId: string
  ): Promise<void> {
    // Validate workflow structure before execution with enhanced safety checks
    const nodeIds = workflow.nodes.map((node) => node.id);

    logger.debug("Workflow structure analysis", {
      executionId: context.executionId,
      nodeCount: workflow.nodes.length,
      connectionCount: workflow.connections.length,
      nodeIds: nodeIds,
      connections: workflow.connections.map((conn) => ({
        source: conn.sourceNodeId,
        target: conn.targetNodeId,
        sourceOutput: conn.sourceOutput,
        targetInput: conn.targetInput,
      })),
    });

    try {
      // Use enhanced validation that throws specific error types
      this.dependencyResolver.validateExecutionSafety(
        nodeIds,
        workflow.connections,
        context.executionPath
      );
    } catch (error: any) {
      logger.error("Workflow execution safety validation failed", {
        executionId: context.executionId,
        error: error.message,
        errorType: error.flowErrorType || "UNKNOWN",
      });
      throw error;
    }

    // Also run the general validation for warnings
    const validationResult = this.dependencyResolver.validateExecutionPath(
      nodeIds,
      workflow.connections
    );
    if (validationResult.warnings.length > 0) {
      logger.warn("Workflow validation warnings", {
        warnings: validationResult.warnings,
      });
    }

    // Get all nodes reachable from the starting node (trigger-specific execution path)
    const reachableNodes = this.getReachableNodes(
      startNodeId,
      workflow.connections
    );
    reachableNodes.add(startNodeId); // Include the starting node itself

    logger.debug("Reachable nodes from trigger", {
      startNodeId,
      reachableNodes: Array.from(reachableNodes),
      executionId: context.executionId,
    });

    for (const node of workflow.nodes) {
      // Get all dependencies for this node
      const allDependencies = this.dependencyResolver.getDependencies(
        node.id,
        workflow.connections
      );

      // Filter dependencies to only include those reachable from the starting trigger
      // This prevents infinite loops when multiple triggers connect to the same downstream node
      const reachableDependencies = allDependencies.filter(
        (depId) => reachableNodes.has(depId) || depId === startNodeId
      );

      const dependents = this.dependencyResolver.getDownstreamNodes(
        node.id,
        workflow.connections
      );

      logger.debug("Initializing node state", {
        nodeId: node.id,
        nodeType: node.type,
        allDependencies,
        reachableDependencies,
        dependents,
        executionId: context.executionId,
      });

      const nodeState: NodeExecutionState = {
        nodeId: node.id,
        status: FlowNodeStatus.IDLE,
        dependencies: reachableDependencies, // Use filtered dependencies
        dependents,
        progress: 0,
      };

      context.nodeStates.set(node.id, nodeState);
    }

    const queue = this.nodeQueue.get(context.executionId) || [];
    queue.push(startNodeId);
    this.nodeQueue.set(context.executionId, queue);

    const startNodeState = context.nodeStates.get(startNodeId);
    if (startNodeState) {
      startNodeState.status = FlowNodeStatus.QUEUED;
    }

    logger.info("Node states initialized for trigger execution", {
      executionId: context.executionId,
      startNodeId,
      totalNodes: context.nodeStates.size,
      reachableFromTrigger: Array.from(reachableNodes),
      nodeStates: Array.from(context.nodeStates.entries()).map(
        ([nodeId, state]) => ({
          nodeId,
          status: state.status,
          dependencies: state.dependencies,
          dependents: state.dependents,
        })
      ),
    });
  }

  private async executeFlow(
    context: FlowExecutionContext,
    workflow: Workflow
  ): Promise<FlowExecutionResult> {
    const nodeResults = new Map<string, NodeExecutionResult>();
    const executedNodes: string[] = [];
    const failedNodes: string[] = [];
    const nodeRetryCount = new Map<string, number>(); // Track retry counts to prevent infinite loops
    const maxRetries = 10; // Maximum retries per node

    while (!context.cancelled && !context.paused) {
      const queue = this.nodeQueue.get(context.executionId) || [];

      if (queue.length === 0) {
        logger.debug("No more nodes in queue, execution complete", {
          executionId: context.executionId,
          executedNodes: executedNodes.length,
          failedNodes: failedNodes.length,
        });
        break;
      }

      const nodeId = queue.shift()!;
      this.nodeQueue.set(context.executionId, queue);

      const nodeState = context.nodeStates.get(nodeId);
      if (!nodeState) {
        logger.warn("Node state not found, skipping", {
          nodeId,
          executionId: context.executionId,
        });
        continue;
      }

      const dependenciesSatisfied = this.areNodeDependenciesSatisfied(
        nodeId,
        context
      );
      if (!dependenciesSatisfied) {
        // Check retry count to prevent infinite loops
        const retryCount = nodeRetryCount.get(nodeId) || 0;
        if (retryCount >= maxRetries) {
          logger.error(
            "Node exceeded maximum retry attempts, marking as failed",
            {
              nodeId,
              retryCount,
              maxRetries,
              dependencies: nodeState.dependencies,
              executionId: context.executionId,
            }
          );

          // Mark node as failed instead of continuing to retry
          const failedResult: NodeExecutionResult = {
            nodeId,
            status: FlowNodeStatus.FAILED,
            error: new Error(
              `Node dependencies could not be satisfied after ${maxRetries} attempts. This may indicate a configuration issue with multiple triggers connecting to the same node.`
            ),
            duration: 0,
          };

          nodeResults.set(nodeId, failedResult);
          failedNodes.push(nodeId);
          nodeState.status = FlowNodeStatus.FAILED;
          nodeState.error = failedResult.error;
          continue;
        }

        logger.debug("Node dependencies not satisfied, re-queuing", {
          nodeId,
          retryCount,
          dependencies: nodeState.dependencies,
          executionId: context.executionId,
        });

        nodeRetryCount.set(nodeId, retryCount + 1);
        queue.push(nodeId);
        this.nodeQueue.set(context.executionId, queue);
        continue;
      }

      // Reset retry count on successful dependency satisfaction
      nodeRetryCount.delete(nodeId);

      logger.info("Executing node", {
        nodeId,
        nodeType: workflow.nodes.find((n) => n.id === nodeId)?.type,
        executionId: context.executionId,
      });

      // Log execution start
      const nodeName =
        workflow.nodes.find((n) => n.id === nodeId)?.name || "Unknown Node";
      this.executionHistoryService.addExecutionLog(
        context.executionId,
        "info",
        `Starting execution of node: ${nodeName}`,
        nodeId
      );

      try {
        const result = await this.executeNode(nodeId, context, workflow);
        nodeResults.set(nodeId, result);
        executedNodes.push(nodeId);
        context.executionPath.push(nodeId);

        nodeState.status = result.status;
        nodeState.endTime = Date.now();
        nodeState.duration =
          nodeState.endTime - (nodeState.startTime || nodeState.endTime);
        nodeState.outputData = result.data;
        nodeState.error = result.error;

        if (result.status === FlowNodeStatus.COMPLETED) {
          // Log execution completion
          const nodeName =
            workflow.nodes.find((n) => n.id === nodeId)?.name || "Unknown Node";
          this.executionHistoryService.addExecutionLog(
            context.executionId,
            "info",
            `Node execution completed successfully: ${nodeName}`,
            nodeId
          );

          await this.queueDependentNodes(nodeId, context, workflow);

          // Log the updated queue state
          const updatedQueue = this.nodeQueue.get(context.executionId) || [];
          logger.info("Updated execution queue after queuing dependents", {
            nodeId,
            queueLength: updatedQueue.length,
            queuedNodes: updatedQueue,
            executionId: context.executionId,
          });
        } else if (result.status === FlowNodeStatus.FAILED) {
          failedNodes.push(nodeId);
          logger.error("Node execution failed", {
            nodeId,
            error: result.error,
            executionId: context.executionId,
          });

          // Log execution failure
          const nodeName =
            workflow.nodes.find((n) => n.id === nodeId)?.name || "Unknown Node";
          const errorMessage =
            result.error instanceof Error
              ? result.error.message
              : String(result.error || "Unknown error");
          this.executionHistoryService.addExecutionLog(
            context.executionId,
            "error",
            `Node execution failed: ${nodeName} - ${errorMessage}`,
            nodeId
          );
        }

        this.emit("nodeExecuted", {
          executionId: context.executionId,
          workflowId: context.workflowId, // Include workflowId for socket broadcasts
          nodeId,
          status: result.status,
          result,
        });
      } catch (error) {
        logger.error("Node execution failed with exception", {
          nodeId,
          error,
          executionId: context.executionId,
        });
        nodeState.status = FlowNodeStatus.FAILED;
        nodeState.error = error;
        failedNodes.push(nodeId);

        const result: NodeExecutionResult = {
          nodeId,
          status: FlowNodeStatus.FAILED,
          error,
          duration: 0,
        };
        nodeResults.set(nodeId, result);

        // Emit nodeExecuted event for failed nodes too
        this.emit("nodeExecuted", {
          executionId: context.executionId,
          workflowId: context.workflowId, // Include workflowId for socket broadcasts
          nodeId,
          status: FlowNodeStatus.FAILED,
          result,
        });
      }
    }

    let finalStatus: "completed" | "failed" | "cancelled" | "partial" =
      "completed";
    if (context.cancelled) {
      finalStatus = "cancelled";
    } else if (failedNodes.length > 0) {
      finalStatus =
        executedNodes.length > failedNodes.length ? "partial" : "failed";
    }

    const totalDuration = Date.now() - context.startTime;

    const result: FlowExecutionResult = {
      executionId: context.executionId,
      workflowId: context.workflowId, // Include workflowId for socket broadcasts
      status: finalStatus,
      executedNodes,
      failedNodes,
      executionPath: context.executionPath,
      totalDuration,
      nodeResults,
    };

    this.emit("flowExecutionCompleted", result);
    return result;
  }

  private async executeNode(
    nodeId: string,
    context: FlowExecutionContext,
    workflow: Workflow
  ): Promise<NodeExecutionResult> {
    const nodeState = context.nodeStates.get(nodeId);
    if (!nodeState) {
      throw new Error(`Node state not found for ${nodeId}`);
    }

    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found in workflow`);
    }

    nodeState.status = FlowNodeStatus.RUNNING;
    nodeState.startTime = Date.now();
    nodeState.progress = 0;

    this.emit("nodeStarted", {
      executionId: context.executionId,
      nodeId,
      node,
    });

    try {
      const inputData = await this.collectNodeInputData(
        nodeId,
        context,
        workflow
      );
      nodeState.inputData = inputData;

      // Build credentials mapping: need to map credential types to IDs
      // For custom nodes, credentials are stored in parameters with credential type fields
      let credentialsMapping: Record<string, string> | undefined;

      // Get all node types and find the one we need
      const allNodeTypes = await this.nodeService.getNodeTypes();
      const nodeTypeInfo = allNodeTypes.find((nt) => nt.type === node.type);

      if (nodeTypeInfo && nodeTypeInfo.properties) {
        credentialsMapping = {};

        const properties = Array.isArray(nodeTypeInfo.properties)
          ? nodeTypeInfo.properties
          : [];

        // Find credential-type properties and extract their values from node parameters
        for (const property of properties) {
          if (
            property.type === "credential" &&
            property.allowedTypes &&
            property.allowedTypes.length > 0
          ) {
            // Get the credential ID from parameters using the field name
            const credentialId = node.parameters?.[property.name];

            if (credentialId && typeof credentialId === "string") {
              // Map credential type to ID
              // property.allowedTypes[0] is the credential type (e.g., "mongoDb")
              credentialsMapping[property.allowedTypes[0]] = credentialId;
            }
          }
        }
      }

      const nodeResult = await this.nodeService.executeNode(
        node.type,
        node.parameters,
        inputData,
        credentialsMapping,
        context.executionId,
        context.userId, // Pass the userId from context
        undefined, // options
        context.workflowId // Pass workflowId for variable resolution
      );

      if (!nodeResult.success) {
        throw new Error(nodeResult.error?.message || "Node execution failed");
      }

      const outputData = nodeResult.data; // StandardizedNodeOutput | undefined

      const result: NodeExecutionResult = {
        nodeId,
        status: FlowNodeStatus.COMPLETED,
        data: outputData,
        duration: Date.now() - nodeState.startTime!,
      };

      return result;
    } catch (error) {
      const result: NodeExecutionResult = {
        nodeId,
        status: FlowNodeStatus.FAILED,
        error,
        duration: Date.now() - nodeState.startTime!,
      };

      return result;
    }
  }

  private areNodeDependenciesSatisfied(
    nodeId: string,
    context: FlowExecutionContext
  ): boolean {
    const nodeState = context.nodeStates.get(nodeId);
    if (!nodeState) {
      logger.warn("Node state not found when checking dependencies", {
        nodeId,
        executionId: context.executionId,
      });
      return false;
    }

    logger.debug("Checking node dependencies", {
      nodeId,
      dependencies: nodeState.dependencies,
      executionId: context.executionId,
    });

    for (const depNodeId of nodeState.dependencies) {
      const depState = context.nodeStates.get(depNodeId);
      if (!depState || depState.status !== FlowNodeStatus.COMPLETED) {
        logger.debug("Dependency not satisfied", {
          nodeId,
          dependencyNodeId: depNodeId,
          dependencyStatus: depState?.status || "NO_STATE",
          executionId: context.executionId,
        });
        return false;
      }
    }

    logger.debug("All dependencies satisfied", {
      nodeId,
      executionId: context.executionId,
    });
    return true;
  }

  private async queueDependentNodes(
    nodeId: string,
    context: FlowExecutionContext,
    workflow: Workflow
  ): Promise<void> {
    const nodeState = context.nodeStates.get(nodeId);
    if (!nodeState) {
      logger.warn("Node state not found when queuing dependents", {
        nodeId,
        executionId: context.executionId,
      });
      return;
    }

    const queue = this.nodeQueue.get(context.executionId) || [];
    let queuedCount = 0;

    logger.debug("Queuing dependent nodes", {
      nodeId,
      dependents: nodeState.dependents,
      currentQueueLength: queue.length,
      executionId: context.executionId,
    });

    for (const dependentNodeId of nodeState.dependents) {
      const dependentState = context.nodeStates.get(dependentNodeId);
      if (
        dependentState &&
        dependentState.status === FlowNodeStatus.IDLE &&
        !queue.includes(dependentNodeId)
      ) {
        // Check if this dependent node will have data from its incoming connections
        const willHaveData = this.willNodeHaveInputData(
          dependentNodeId,
          context,
          workflow
        );

        if (!willHaveData) {
          logger.info("Skipping dependent node - no data from incoming branches", {
            sourceNodeId: nodeId,
            dependentNodeId,
            dependentNodeType: workflow.nodes.find(
              (n) => n.id === dependentNodeId
            )?.type,
            executionId: context.executionId,
          });
          // Mark as skipped instead of leaving it idle
          dependentState.status = FlowNodeStatus.SKIPPED;
          continue;
        }

        queue.push(dependentNodeId);
        dependentState.status = FlowNodeStatus.QUEUED;
        queuedCount++;

        logger.info("Queued dependent node", {
          sourceNodeId: nodeId,
          dependentNodeId,
          dependentNodeType: workflow.nodes.find(
            (n) => n.id === dependentNodeId
          )?.type,
          executionId: context.executionId,
        });
      } else {
        logger.debug("Skipping dependent node", {
          dependentNodeId,
          reason: !dependentState
            ? "no state"
            : dependentState.status !== FlowNodeStatus.IDLE
              ? `status: ${dependentState.status}`
              : queue.includes(dependentNodeId)
                ? "already queued"
                : "unknown",
          currentStatus: dependentState?.status,
          executionId: context.executionId,
        });
      }
    }

    this.nodeQueue.set(context.executionId, queue);

    logger.info("Completed queuing dependent nodes", {
      nodeId,
      queuedCount,
      newQueueLength: queue.length,
      totalDependents: nodeState.dependents.length,
      executionId: context.executionId,
    });
  }

  /**
   * Check if a node will have input data from its incoming connections
   * Used to skip nodes connected to empty branches (e.g., IfElse false branch when condition is true)
   */
  private willNodeHaveInputData(
    nodeId: string,
    context: FlowExecutionContext,
    workflow: Workflow
  ): boolean {
    const incomingConnections = workflow.connections.filter(
      (conn) => conn.targetNodeId === nodeId
    );

    // Trigger nodes always have data
    if (incomingConnections.length === 0) {
      return true;
    }

    // Check if any incoming connection has data
    for (const connection of incomingConnections) {
      const sourceNodeState = context.nodeStates.get(connection.sourceNodeId);

      if (!sourceNodeState || !sourceNodeState.outputData) {
        continue;
      }

      const outputData = sourceNodeState.outputData as any;

      // Check standardized format with branches
      if (outputData.metadata && outputData.branches) {
        const branchData = outputData.branches[connection.sourceOutput];
        if (Array.isArray(branchData) && branchData.length > 0) {
          return true;
        }
      } else if (outputData.metadata) {
        // Standardized format without branches
        const sourceOutput = outputData[connection.sourceOutput];
        if (Array.isArray(sourceOutput) && sourceOutput.length > 0) {
          return true;
        }
      } else {
        // Legacy format or direct access
        const sourceOutput = outputData[connection.sourceOutput];
        if (Array.isArray(sourceOutput) && sourceOutput.length > 0) {
          return true;
        }
      }
    }

    // No incoming connections have data
    return false;
  }

  private async collectNodeInputData(
    nodeId: string,
    context: FlowExecutionContext,
    workflow: Workflow
  ): Promise<NodeInputData> {
    const inputData: NodeInputData = { main: [[]] };

    const incomingConnections = workflow.connections.filter(
      (conn) => conn.targetNodeId === nodeId
    );

    if (incomingConnections.length === 0) {
      if (context.triggerData) {
        // Wrap trigger data in the proper format for node execution
        // The trigger data should be wrapped as { json: data }
        inputData.main = [[{ json: context.triggerData }]];
      }
      return inputData;
    }

    // Collect data from each connection separately for proper multi-input support
    const collectedDataPerConnection: any[][] = [];

    for (const connection of incomingConnections) {
      const sourceNodeState = context.nodeStates.get(connection.sourceNodeId);
      const connectionData: any[] = [];

      if (sourceNodeState && sourceNodeState.outputData) {
        // outputData is now standardized format: { main: [...], metadata: {...}, branches?: {...} }
        const outputData = sourceNodeState.outputData as any;

        logger.info(`[FlowExecutionEngine] Collecting input for node ${nodeId} from ${connection.sourceNodeId}`, {
          sourceOutput: connection.sourceOutput,
          hasMetadata: !!outputData.metadata,
          hasBranches: !!outputData.branches,
          branchKeys: outputData.branches ? Object.keys(outputData.branches) : [],
        });

        // Check if this is the standardized format (has metadata)
        if (outputData.metadata) {
          // Standardized format with branches support
          let sourceOutput;

          // For branching nodes, check branches first
          if (outputData.branches && outputData.branches[connection.sourceOutput]) {
            sourceOutput = outputData.branches[connection.sourceOutput];
            logger.info(`[FlowExecutionEngine] Using branch '${connection.sourceOutput}' data`, {
              itemCount: Array.isArray(sourceOutput) ? sourceOutput.length : 0,
            });
          } else {
            // Fallback to direct property access for non-branching nodes
            sourceOutput = outputData[connection.sourceOutput];
            logger.info(`[FlowExecutionEngine] Using direct output '${connection.sourceOutput}'`, {
              itemCount: Array.isArray(sourceOutput) ? sourceOutput.length : 0,
            });
          }

          if (Array.isArray(sourceOutput)) {
            connectionData.push(...sourceOutput);
          } else if (sourceOutput) {
            connectionData.push(sourceOutput);
          }
        } else if (Array.isArray(outputData)) {
          // Legacy format: array of output objects [{main: [...]}, {secondary: [...]}]
          const output = outputData.find(
            (o) => o && o[connection.sourceOutput]
          );
          if (output && output[connection.sourceOutput]) {
            const sourceOutput = output[connection.sourceOutput];
            if (Array.isArray(sourceOutput)) {
              connectionData.push(...sourceOutput);
            } else {
              connectionData.push(sourceOutput);
            }
          }
        } else {
          // Fallback: direct object access
          const sourceOutput = outputData[connection.sourceOutput];
          if (Array.isArray(sourceOutput)) {
            connectionData.push(...sourceOutput);
          } else if (sourceOutput) {
            connectionData.push(sourceOutput);
          }
        }
      }

      // Add this connection's data as a separate array
      collectedDataPerConnection.push(connectionData);
    }

    // For nodes with multiple inputs (like Merge), keep data from each connection separate
    // For nodes with single input, flatten for backward compatibility
    if (collectedDataPerConnection.length > 1) {
      // Multiple connections: keep them separate (2D array)
      inputData.main = collectedDataPerConnection;
    } else if (collectedDataPerConnection.length === 1) {
      // Single connection: use existing format for backward compatibility
      inputData.main = [collectedDataPerConnection[0]];
    }

    return inputData;
  }

  /**
   * Get all nodes reachable from a starting node through forward connections
   * This helps create trigger-specific execution contexts to prevent infinite loops
   * when multiple triggers connect to shared downstream nodes
   */
  private getReachableNodes(
    startNodeId: string,
    connections: any[]
  ): Set<string> {
    const reachable = new Set<string>();
    const visited = new Set<string>();

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) {
        return; // Prevent infinite loops in case of cycles
      }
      visited.add(nodeId);

      // Find all nodes that this node connects to (downstream)
      const downstreamConnections = connections.filter(
        (conn) => conn.sourceNodeId === nodeId
      );

      for (const connection of downstreamConnections) {
        const targetNodeId = connection.targetNodeId;
        if (!reachable.has(targetNodeId)) {
          reachable.add(targetNodeId);
          traverse(targetNodeId); // Recursively traverse downstream
        }
      }
    };

    traverse(startNodeId);
    return reachable;
  }
}
