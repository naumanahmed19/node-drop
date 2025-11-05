import { PrismaClient } from "@prisma/client";
import Bull, { Job, Queue } from "bull";
import { EventEmitter } from "events";
import {
  Connection,
  ExecutionStatus,
  Node,
  NodeExecutionStatus,
} from "../types/database";
import {
  ExecutionContext,
  ExecutionEventData,
  ExecutionGraph,
  ExecutionJobData,
  ExecutionOptions,
  ExecutionProgress,
  ExecutionStats,
  NodeExecutionJob,
  QueueConfig,
  RetryConfig,
} from "../types/execution.types";
import { NodeInputData, NodeOutputData } from "../types/node.types";
import { logger } from "../utils/logger";
import { NodeService } from "./NodeService";

export class ExecutionEngine extends EventEmitter {
  private prisma: PrismaClient;
  private nodeService: NodeService;
  private executionQueue: Queue<ExecutionJobData>;
  private nodeQueue: Queue<NodeExecutionJob>;
  private activeExecutions: Map<string, ExecutionContext>;
  private retryConfig: RetryConfig;

  constructor(
    prisma: PrismaClient,
    nodeService: NodeService,
    queueConfig: QueueConfig
  ) {
    super();
    this.prisma = prisma;
    this.nodeService = nodeService;
    this.activeExecutions = new Map();

    // Initialize retry configuration
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      maxRetryDelay: 30000,
      retryableErrors: ["TIMEOUT", "NETWORK_ERROR", "RATE_LIMIT"],
    };

    // Initialize Bull queues
    this.executionQueue = new Bull("execution-queue", {
      redis: queueConfig.redis,
      defaultJobOptions: queueConfig.defaultJobOptions,
    });

    this.nodeQueue = new Bull("node-queue", {
      redis: queueConfig.redis,
      defaultJobOptions: queueConfig.defaultJobOptions,
    });

    this.setupQueueProcessors();
    this.setupQueueEvents();
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    userId: string,
    triggerData?: any,
    options: ExecutionOptions = {}
  ): Promise<string> {
    try {
      // Get workflow from database
      const workflow = await this.prisma.workflow.findFirst({
        where: { id: workflowId, userId },
        include: {
          user: { select: { id: true, email: true } },
        },
      });

      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Check if workflow is active (unless this is a manual execution)
      if (!workflow.active && !options.manual) {
        throw new Error(`Workflow ${workflowId} is not active`);
      }

      // Log manual execution of inactive workflow
      if (!workflow.active && options.manual) {
        logger.info(
          `Manual execution of inactive workflow ${workflowId} by user ${userId}`
        );
      }

      // Create execution record
      const execution = await this.prisma.execution.create({
        data: {
          workflowId,
          status: ExecutionStatus.RUNNING,
          startedAt: new Date(),
          triggerData: triggerData || {},
        },
      });

      // Create execution context
      const context: ExecutionContext = {
        executionId: execution.id,
        workflowId,
        userId,
        triggerData,
        startedAt: execution.startedAt,
        nodeExecutions: new Map(),
        nodeOutputs: new Map(),
        cancelled: false,
      };

      this.activeExecutions.set(execution.id, context);

      // Add job to execution queue
      await this.executionQueue.add(
        "execute-workflow",
        {
          executionId: execution.id,
          workflowId,
          userId,
          triggerData,
          retryCount: 0,
        },
        {
          timeout: options.timeout || 300000, // 5 minutes default
          attempts: 1, // Workflow-level retries handled separately
        }
      );

      logger.info(
        `Started execution ${execution.id} for workflow ${workflowId}`
      );

      return execution.id;
    } catch (error) {
      logger.error("Failed to start workflow execution:", error);
      throw error;
    }
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    try {
      const context = this.activeExecutions.get(executionId);
      if (context) {
        context.cancelled = true;
      }

      // Update execution status in database
      await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatus.CANCELLED,
          finishedAt: new Date(),
        },
      });

      // Cancel any pending jobs for this execution
      const jobs = await this.nodeQueue.getJobs(["waiting", "active"]);
      for (const job of jobs) {
        if (job.data.executionId === executionId) {
          await job.remove();
        }
      }

      this.activeExecutions.delete(executionId);

      this.emitExecutionEvent({
        executionId,
        type: "cancelled",
        timestamp: new Date(),
      });

      logger.info(`Cancelled execution ${executionId}`);
    } catch (error) {
      logger.error(`Failed to cancel execution ${executionId}:`, error);
      throw error;
    }
  }

  /**
   * Get execution progress
   */
  async getExecutionProgress(
    executionId: string
  ): Promise<ExecutionProgress | null> {
    try {
      const execution = await this.prisma.execution.findUnique({
        where: { id: executionId },
        include: {
          nodeExecutions: true,
          workflow: { select: { nodes: true } },
        },
      });

      if (!execution) {
        return null;
      }

      const workflowNodes = execution.workflow.nodes as unknown as Node[];
      const totalNodes = workflowNodes.length;
      const completedNodes = execution.nodeExecutions.filter(
        (ne) => ne.status === NodeExecutionStatus.SUCCESS
      ).length;
      const failedNodes = execution.nodeExecutions.filter(
        (ne) => ne.status === NodeExecutionStatus.ERROR
      ).length;
      const runningNode = execution.nodeExecutions.find(
        (ne) => ne.status === NodeExecutionStatus.RUNNING
      );

      return {
        executionId,
        totalNodes,
        completedNodes,
        failedNodes,
        currentNode: runningNode?.nodeId,
        status: execution.status.toLowerCase() as any,
        startedAt: execution.startedAt,
        finishedAt: execution.finishedAt || undefined,
        error: execution.error
          ? {
            message: (execution.error as any).message,
            stack: (execution.error as any).stack,
            nodeId: (execution.error as any).nodeId,
            timestamp: new Date((execution.error as any).timestamp),
          }
          : undefined,
      };
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
  async getExecutionStats(): Promise<ExecutionStats> {
    try {
      const [
        totalExecutions,
        runningExecutions,
        completedExecutions,
        failedExecutions,
        cancelledExecutions,
      ] = await Promise.all([
        this.prisma.execution.count(),
        this.prisma.execution.count({
          where: { status: ExecutionStatus.RUNNING },
        }),
        this.prisma.execution.count({
          where: { status: ExecutionStatus.SUCCESS },
        }),
        this.prisma.execution.count({
          where: { status: ExecutionStatus.ERROR },
        }),
        this.prisma.execution.count({
          where: { status: ExecutionStatus.CANCELLED },
        }),
      ]);

      const queueSize = await this.executionQueue
        .getWaiting()
        .then((jobs) => jobs.length);

      return {
        totalExecutions,
        runningExecutions,
        completedExecutions,
        failedExecutions,
        cancelledExecutions,
        averageExecutionTime: 0, // TODO: Calculate from actual execution times
        queueSize,
      };
    } catch (error) {
      logger.error("Failed to get execution stats:", error);
      throw error;
    }
  }

  /**
   * Setup queue processors
   */
  private setupQueueProcessors(): void {
    // Process workflow execution jobs
    this.executionQueue.process(
      "execute-workflow",
      async (job: Job<ExecutionJobData>) => {
        return this.processWorkflowExecution(job);
      }
    );

    // Process node execution jobs
    this.nodeQueue.process(10, async (job: Job<NodeExecutionJob>) => {
      return this.processNodeExecution(job);
    });
  }

  /**
   * Setup queue event handlers
   */
  private setupQueueEvents(): void {
    this.executionQueue.on("completed", (job, result) => {
      logger.info(`Execution job ${job.id} completed`);
    });

    this.executionQueue.on("failed", (job, err) => {
      logger.error(`Execution job ${job.id} failed:`, err);
    });

    this.nodeQueue.on("completed", (job, result) => {
      logger.debug(`Node execution job ${job.id} completed`);
    });

    this.nodeQueue.on("failed", (job, err) => {
      logger.error(`Node execution job ${job.id} failed:`, err);
    });
  }

  /**
   * Process workflow execution
   */
  private async processWorkflowExecution(
    job: Job<ExecutionJobData>
  ): Promise<void> {
    const { executionId, workflowId, userId, triggerData } = job.data;

    try {
      const context = this.activeExecutions.get(executionId);
      if (!context) {
        throw new Error(`Execution context not found for ${executionId}`);
      }

      if (context.cancelled) {
        throw new Error(`Execution ${executionId} was cancelled`);
      }

      // Get workflow with nodes and connections
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Build execution graph and determine execution order
      const workflowNodes = workflow.nodes as unknown as Node[];
      const workflowConnections =
        workflow.connections as unknown as Connection[];
      const graph = this.buildExecutionGraph(
        workflowNodes,
        workflowConnections
      );

      // Emit execution started event with trigger information
      this.emitExecutionEvent({
        executionId,
        type: "started",
        timestamp: new Date(),
        data: {
          workflowId,
          userId,
          triggerType: this.determineTriggerType(workflowNodes),
          triggerData: context.triggerData,
          nodeCount: workflowNodes.length,
        },
      });

      // Execute nodes in topological order
      await this.executeNodesInOrder(context, graph);

      // Mark execution as completed
      await this.completeExecution(executionId);
    } catch (error) {
      await this.failExecution(executionId, error as Error);
      throw error;
    }
  }

  /**
   * Process individual node execution
   */
  private async processNodeExecution(
    job: Job<NodeExecutionJob>
  ): Promise<NodeOutputData[]> {
    const { nodeId, executionId, inputData, retryCount } = job.data;

    try {
      const context = this.activeExecutions.get(executionId);
      if (!context || context.cancelled) {
        throw new Error(`Execution ${executionId} not found or cancelled`);
      }

      // Get workflow to find the node
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: context.workflowId },
      });

      if (!workflow) {
        throw new Error(`Workflow ${context.workflowId} not found`);
      }

      const workflowNodes = workflow.nodes as unknown as Node[];
      const node = workflowNodes.find((n) => n.id === nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found in workflow`);
      }

      // Create node execution record
      const nodeExecution = await this.prisma.nodeExecution.create({
        data: {
          nodeId,
          executionId,
          status: NodeExecutionStatus.RUNNING,
          startedAt: new Date(),
          inputData,
        },
      });

      context.nodeExecutions.set(nodeId, nodeExecution as any);

      this.emitExecutionEvent({
        executionId,
        type: "node-started",
        nodeId,
        timestamp: new Date(),
      });

      // Emit node-specific event
      this.emitNodeExecutionEvent(executionId, nodeId, "started");

      // Emit progress update
      await this.emitExecutionProgress(executionId);

      // Execute the node securely with enhanced options for manual triggers
      const executionOptions = {
        timeout: 30000, // 30 seconds
        memoryLimit: 128 * 1024 * 1024, // 128MB
        maxOutputSize: 10 * 1024 * 1024, // 10MB
        maxRequestTimeout: 30000,
        maxConcurrentRequests: 5,
      };

      // For manual triggers, add additional context
      if (node.type === "manual-trigger") {
        logger.info(`Executing manual trigger node ${nodeId}`, {
          executionId,
          triggerDataSize: JSON.stringify(context.triggerData || {}).length,
          nodeParameters: Object.keys(node.parameters || {}),
        });
      }

      // For workflow-called triggers, add additional context
      if (node.type === "workflow-called") {
        logger.info(`Executing workflow-called trigger node ${nodeId}`, {
          executionId,
          triggerDataSize: JSON.stringify(context.triggerData || {}).length,
          nodeParameters: Object.keys(node.parameters || {}),
        });
      }

      const result = await this.nodeService.executeNode(
        node.type,
        node.parameters,
        inputData,
        undefined, // credentials - TODO: implement credential retrieval
        executionId,
        context.userId, // userId
        executionOptions, // options
        context.workflowId // workflowId
      );

      if (!result.success) {
        throw new Error(result.error?.message || "Node execution failed");
      }

      // Update node execution record with real execution data
      await this.prisma.nodeExecution.update({
        where: { id: nodeExecution.id },
        data: {
          status: NodeExecutionStatus.SUCCESS,
          outputData: result.data as any,
          finishedAt: new Date(),
          // Store additional execution metadata for manual triggers
          ...(node.type === "manual-trigger" && {
            real_output_data: result.data,
            network_metrics: {
              executionTime:
                new Date().getTime() -
                new Date(nodeExecution.startedAt || new Date()).getTime(),
              triggerType: "manual",
              triggerDataSize: JSON.stringify(context.triggerData || {}).length,
            },
          }),
        },
      });

      // Store output data in context
      // Store the full result.data which includes branches for branching nodes
      if (result.data) {
        context.nodeOutputs.set(nodeId, result.data as any);
      }

      this.emitExecutionEvent({
        executionId,
        type: "node-completed",
        nodeId,
        data: result.data,
        timestamp: new Date(),
      });

      // Emit node-specific event
      this.emitNodeExecutionEvent(
        executionId,
        nodeId,
        "completed",
        result.data
      );

      // Emit progress update
      await this.emitExecutionProgress(executionId);

      // Return output data in the expected format for the queue
      const outputData = result.data ? [{ main: result.data.main }] : [];
      return outputData;
    } catch (error) {
      // Enhanced error handling for manual triggers
      const currentContext = this.activeExecutions.get(executionId);
      if (currentContext) {
        const workflow = await this.prisma.workflow.findUnique({
          where: { id: currentContext.workflowId },
        });
        const workflowNodes = workflow?.nodes as unknown as Node[];
        const currentNode = workflowNodes?.find((n) => n.id === nodeId);

        if (currentNode && currentNode.type === "manual-trigger") {
          logger.error(`Manual trigger node ${nodeId} execution failed`, {
            executionId,
            error: error instanceof Error ? error.message : "Unknown error",
            triggerDataSize: JSON.stringify(currentContext.triggerData || {}).length,
            nodeParameters: Object.keys(currentNode.parameters || {}),
          });
        }

        // Enhanced error handling for workflow-called triggers
        if (currentNode && currentNode.type === "workflow-called") {
          logger.error(
            `Workflow-called trigger node ${nodeId} execution failed`,
            {
              executionId,
              error: error instanceof Error ? error.message : "Unknown error",
              triggerDataSize: JSON.stringify(currentContext.triggerData || {}).length,
              nodeParameters: Object.keys(currentNode.parameters || {}),
            }
          );
        }
      }

      await this.handleNodeExecutionError(
        executionId,
        nodeId,
        error as Error,
        retryCount
      );
      throw error;
    }
  }

  /**
   * Build execution graph from workflow nodes and connections
   */
  private buildExecutionGraph(
    nodes: Node[],
    connections: Connection[]
  ): ExecutionGraph {
    const nodeMap = new Map<string, Node>();
    const adjacencyList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize maps
    for (const node of nodes) {
      nodeMap.set(node.id, node);
      adjacencyList.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    // Build adjacency list and calculate in-degrees
    logger.info(
      `Building execution graph with ${connections.length} connections`,
      {
        connections: connections.map((c) => ({
          source: c.sourceNodeId,
          target: c.targetNodeId,
        })),
      }
    );

    for (const connection of connections) {
      const sourceId = connection.sourceNodeId;
      const targetId = connection.targetNodeId;

      if (adjacencyList.has(sourceId) && inDegree.has(targetId)) {
        adjacencyList.get(sourceId)!.push(targetId);
        inDegree.set(targetId, inDegree.get(targetId)! + 1);
        logger.debug(`Added connection: ${sourceId} -> ${targetId}`);
      } else {
        logger.warn(
          `Invalid connection: ${sourceId} -> ${targetId} (nodes not found)`
        );
      }
    }

    // Perform topological sort
    const executionOrder = this.topologicalSort(adjacencyList, inDegree);

    return {
      nodes: nodeMap,
      connections,
      adjacencyList,
      inDegree,
      executionOrder,
    };
  }

  /**
   * Perform topological sort to determine node execution order
   */
  private topologicalSort(
    adjacencyList: Map<string, string[]>,
    inDegree: Map<string, number>
  ): string[] {
    const queue: string[] = [];
    const result: string[] = [];
    const inDegreeClone = new Map(inDegree);

    // Find all nodes with no incoming edges
    for (const [nodeId, degree] of inDegreeClone) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const currentNode = queue.shift()!;
      result.push(currentNode);

      // Process all neighbors
      const neighbors = adjacencyList.get(currentNode) || [];
      for (const neighbor of neighbors) {
        const newDegree = inDegreeClone.get(neighbor)! - 1;
        inDegreeClone.set(neighbor, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check for cycles
    if (result.length !== adjacencyList.size) {
      throw new Error("Workflow contains cycles - cannot execute");
    }

    return result;
  }

  /**
   * Execute nodes in topological order
   */
  private async executeNodesInOrder(
    context: ExecutionContext,
    graph: ExecutionGraph
  ): Promise<void> {
    logger.info(
      `Executing nodes in order for execution ${context.executionId}`,
      {
        executionOrder: graph.executionOrder,
        totalNodes: graph.executionOrder.length,
        connections: graph.connections.length,
      }
    );

    for (const nodeId of graph.executionOrder) {
      if (context.cancelled) {
        throw new Error("Execution was cancelled");
      }

      const node = graph.nodes.get(nodeId);
      if (!node || node.disabled) {
        logger.info(
          `Skipping node ${nodeId}: ${!node ? "not found" : "disabled"}`
        );
        continue;
      }

      // Check if this node should be executed based on incoming connections
      const shouldExecute = this.shouldExecuteNode(nodeId, graph, context);

      if (!shouldExecute) {
        logger.info(
          `Skipping node ${nodeId} (${node.type}): No data from incoming branches`,
          {
            nodeType: node.type,
            nodeName: node.name,
          }
        );
        continue;
      }

      logger.info(`Executing node ${nodeId} (${node.type})`, {
        nodeType: node.type,
        nodeName: node.name,
      });

      // Prepare input data for the node
      const inputData = this.prepareNodeInputData(nodeId, graph, context);

      // Add node execution job to queue
      await this.nodeQueue.add({
        nodeId,
        executionId: context.executionId,
        inputData,
        retryCount: 0,
      });

      // Wait for node execution to complete
      await this.waitForNodeCompletion(context.executionId, nodeId);

      logger.info(`Node ${nodeId} completed execution`);
    }
  }

  /**
   * Check if a node should be executed based on incoming branch data
   */
  private shouldExecuteNode(
    nodeId: string,
    graph: ExecutionGraph,
    context: ExecutionContext
  ): boolean {
    const node = graph.nodes.get(nodeId);
    logger.info(`[shouldExecuteNode] Checking if node ${nodeId} (${node?.type}) should execute`);
    
    // Find all connections that target this node
    const incomingConnections = graph.connections.filter(
      (conn) => conn.targetNodeId === nodeId
    );

    logger.info(`[shouldExecuteNode] Node ${nodeId} has ${incomingConnections.length} incoming connections`);

    // If no incoming connections, this is a trigger node - always execute
    if (incomingConnections.length === 0) {
      logger.info(`[shouldExecuteNode] Node ${nodeId} is a trigger node - EXECUTE`);
      return true;
    }

    // Check if any incoming connection has data
    for (const connection of incomingConnections) {
      const sourceOutput = context.nodeOutputs.get(connection.sourceNodeId);

      logger.info(`[shouldExecuteNode] Checking connection from ${connection.sourceNodeId} output '${connection.sourceOutput}' to ${nodeId}`);

      if (!sourceOutput) {
        // Source node hasn't executed yet - this shouldn't happen in topological order
        logger.warn(`[shouldExecuteNode] Source node ${connection.sourceNodeId} has no output yet`);
        continue;
      }
      
      logger.info(`[shouldExecuteNode] Source output structure:`, {
        hasMain: !!(sourceOutput as any).main,
        hasBranches: !!(sourceOutput as any).branches,
        mainLength: ((sourceOutput as any).main || []).length,
        branchKeys: Object.keys((sourceOutput as any).branches || {}),
      });

      // Check if this is a branching node
      const hasBranches = (sourceOutput as any).branches;

      if (hasBranches) {
        // For branching nodes, check if the specific branch has data
        const branchName = connection.sourceOutput || "main";
        const branchData = (sourceOutput as any).branches?.[branchName] || [];

        logger.info(
          `[shouldExecuteNode] Checking branch '${branchName}' for node ${nodeId}`,
          {
            sourceNodeId: connection.sourceNodeId,
            branchName,
            branchDataLength: branchData.length,
            allBranches: Object.keys((sourceOutput as any).branches || {}),
          }
        );

        if (branchData.length > 0) {
          // This branch has data, node should execute
          logger.info(`[shouldExecuteNode] Branch '${branchName}' has ${branchData.length} items - EXECUTE node ${nodeId}`);
          return true;
        } else {
          logger.info(`[shouldExecuteNode] Branch '${branchName}' is empty - checking other connections...`);
        }
      } else {
        // For standard nodes, check if main output has data
        const outputItems = (sourceOutput as any).main || [];

        logger.info(`[shouldExecuteNode] Standard node output has ${outputItems.length} items`);

        if (outputItems.length > 0) {
          logger.info(`[shouldExecuteNode] Main output has data - EXECUTE node ${nodeId}`);
          return true;
        }
      }
    }

    // No incoming connections have data - skip this node
    logger.info(`[shouldExecuteNode] No incoming connections have data - SKIP node ${nodeId}`);
    return false;
  }

  /**
   * Prepare input data for a node based on its connections
   */
  private prepareNodeInputData(
    nodeId: string,
    graph: ExecutionGraph,
    context: ExecutionContext
  ): NodeInputData {
    const inputData: NodeInputData = { main: [[]] };

    // Find all connections that target this node
    const incomingConnections = graph.connections.filter(
      (conn) => conn.targetNodeId === nodeId
    );

    if (incomingConnections.length === 0) {
      // This is a trigger node, prepare trigger data properly
      const node = graph.nodes.get(nodeId);

      if (node && node.type === "manual-trigger") {
        // For manual triggers, pass the trigger data as the first item
        // The manual trigger node will handle validation and processing
        const triggerInput = context.triggerData || {};

        // Log trigger data for debugging
        logger.debug(`Preparing manual trigger input data for node ${nodeId}`, {
          triggerDataKeys: Object.keys(triggerInput),
          triggerDataSize: JSON.stringify(triggerInput).length,
        });

        inputData.main = [[{ json: triggerInput }]];
      } else if (node && node.type === "workflow-called") {
        // For workflow-called triggers, pass the trigger data as the first item
        // Similar to manual triggers but specifically for workflow-to-workflow calls
        const triggerInput = context.triggerData || {};

        // Log trigger data for debugging
        logger.debug(
          `Preparing workflow-called trigger input data for node ${nodeId}`,
          {
            triggerDataKeys: Object.keys(triggerInput),
            triggerDataSize: JSON.stringify(triggerInput).length,
          }
        );

        inputData.main = [[{ json: triggerInput }]];
      } else {
        // For other trigger types, use empty trigger data
        inputData.main = [[context.triggerData || {}]];
      }
    } else {
      // Collect data from source nodes
      const sourceData: any[] = [];

      for (const connection of incomingConnections) {
        const sourceOutput = context.nodeOutputs.get(connection.sourceNodeId);

        if (sourceOutput) {
          // Check if this is a branching node (has branches property)
          const hasBranches = (sourceOutput as any).branches;

          if (hasBranches) {
            // For branching nodes (like IfElse), only use data from the specific output branch
            const branchName = connection.sourceOutput || "main";
            const branchData = (sourceOutput as any).branches?.[branchName] || [];

            logger.debug(`Using branch data from ${connection.sourceNodeId}`, {
              branchName,
              itemCount: branchData.length,
              availableBranches: Object.keys((sourceOutput as any).branches || {}),
            });

            sourceData.push(...branchData);
          } else {
            // For standard nodes, use main output
            const outputItems = (sourceOutput as any).main || [];
            sourceData.push(...outputItems);
          }
        }
      }

      // If no source data, provide empty object
      if (sourceData.length === 0) {
        sourceData.push({ json: {} });
      }

      inputData.main = [sourceData];
    }

    return inputData;
  }

  /**
   * Wait for node execution to complete
   */
  private async waitForNodeCompletion(
    executionId: string,
    nodeId: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        try {
          const nodeExecution = await this.prisma.nodeExecution.findFirst({
            where: { executionId, nodeId },
          });

          if (nodeExecution) {
            if (nodeExecution.status === NodeExecutionStatus.SUCCESS) {
              clearInterval(checkInterval);
              resolve();
            } else if (nodeExecution.status === NodeExecutionStatus.ERROR) {
              clearInterval(checkInterval);
              reject(new Error(`Node ${nodeId} execution failed`));
            }
          }
        } catch (error) {
          clearInterval(checkInterval);
          reject(error);
        }
      }, 100); // Check every 100ms

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error(`Node ${nodeId} execution timeout`));
      }, 300000);
    });
  }

  /**
   * Complete execution
   */
  private async completeExecution(executionId: string): Promise<void> {
    await this.prisma.execution.update({
      where: { id: executionId },
      data: {
        status: ExecutionStatus.SUCCESS,
        finishedAt: new Date(),
      },
    });

    this.activeExecutions.delete(executionId);

    this.emitExecutionEvent({
      executionId,
      type: "completed",
      timestamp: new Date(),
    });

    logger.info(`Completed execution ${executionId}`);
  }

  /**
   * Fail execution
   */
  private async failExecution(
    executionId: string,
    error: Error
  ): Promise<void> {
    const executionError = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
    };

    await this.prisma.execution.update({
      where: { id: executionId },
      data: {
        status: ExecutionStatus.ERROR,
        finishedAt: new Date(),
        error: executionError,
      },
    });

    this.activeExecutions.delete(executionId);

    this.emitExecutionEvent({
      executionId,
      type: "failed",
      error: executionError,
      timestamp: new Date(),
    });

    logger.error(`Failed execution ${executionId}:`, error);
  }

  /**
   * Handle node execution error with retry logic
   */
  private async handleNodeExecutionError(
    executionId: string,
    nodeId: string,
    error: Error,
    retryCount: number
  ): Promise<void> {
    const shouldRetry =
      retryCount < this.retryConfig.maxRetries && this.isRetryableError(error);

    if (shouldRetry) {
      const delay = Math.min(
        this.retryConfig.retryDelay *
        Math.pow(this.retryConfig.backoffMultiplier, retryCount),
        this.retryConfig.maxRetryDelay
      );

      logger.warn(
        `Retrying node ${nodeId} execution (attempt ${retryCount + 1
        }) after ${delay}ms`
      );

      // Schedule retry
      setTimeout(async () => {
        const context = this.activeExecutions.get(executionId);
        if (context && !context.cancelled) {
          const inputData = this.prepareNodeInputData(
            nodeId,
            this.buildExecutionGraph([], []), // This needs the actual graph
            context
          );

          await this.nodeQueue.add({
            nodeId,
            executionId,
            inputData,
            retryCount: retryCount + 1,
          });
        }
      }, delay);
    } else {
      // Update node execution as failed
      await this.prisma.nodeExecution.updateMany({
        where: { executionId, nodeId },
        data: {
          status: NodeExecutionStatus.ERROR,
          error: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date(),
          },
          finishedAt: new Date(),
        },
      });

      this.emitExecutionEvent({
        executionId,
        type: "node-failed",
        nodeId,
        error: {
          message: error.message,
          stack: error.stack,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      });

      // Emit node-specific event
      this.emitNodeExecutionEvent(executionId, nodeId, "failed", {
        error: error.message,
      });

      // Emit progress update
      await this.emitExecutionProgress(executionId);

      // Fail the entire execution
      await this.failExecution(executionId, error);
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    return this.retryConfig.retryableErrors.some((retryableError) =>
      error.message.includes(retryableError)
    );
  }

  /**
   * Emit execution event
   */
  private emitExecutionEvent(eventData: ExecutionEventData): void {
    this.emit("execution-event", eventData);
    logger.debug(`Execution event: ${eventData.type}`, eventData);
  }

  /**
   * Emit execution progress update
   */
  private async emitExecutionProgress(executionId: string): Promise<void> {
    try {
      const progress = await this.getExecutionProgress(executionId);
      if (progress) {
        this.emit("execution-progress", progress);
        logger.debug(
          `Execution progress: ${progress.completedNodes}/${progress.totalNodes}`,
          progress
        );
      }
    } catch (error) {
      logger.error(
        `Failed to emit execution progress for ${executionId}:`,
        error
      );
    }
  }

  /**
   * Emit node execution event
   */
  private emitNodeExecutionEvent(
    executionId: string,
    nodeId: string,
    type: "started" | "completed" | "failed",
    data?: any
  ): void {
    this.emit("node-execution-event", {
      executionId,
      nodeId,
      type,
      data,
      timestamp: new Date(),
    });
    logger.debug(`Node execution event: ${type} for ${nodeId}`, {
      executionId,
      nodeId,
      type,
    });
  }

  /**
   * Determine the trigger type for a workflow
   */
  private determineTriggerType(nodes: Node[]): string {
    // Find trigger nodes (nodes with no inputs)
    const triggerNodes = nodes.filter(
      (node) =>
        node.type.includes("trigger") ||
        [
          "manual-trigger",
          "webhook-trigger",
          "schedule-trigger",
          "workflow-called",
        ].includes(node.type)
    );

    if (triggerNodes.length === 0) {
      return "unknown";
    }

    // Return the first trigger type found
    const firstTrigger = triggerNodes[0];
    if (firstTrigger.type === "manual-trigger") {
      return "manual";
    } else if (firstTrigger.type === "webhook-trigger") {
      return "webhook";
    } else if (firstTrigger.type === "schedule-trigger") {
      return "schedule";
    } else if (firstTrigger.type === "workflow-called") {
      return "workflow-called";
    }

    return firstTrigger.type;
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down execution engine...");

    // Close queues
    await this.executionQueue.close();
    await this.nodeQueue.close();

    // Clear active executions
    this.activeExecutions.clear();

    logger.info("Execution engine shutdown complete");
  }
}
