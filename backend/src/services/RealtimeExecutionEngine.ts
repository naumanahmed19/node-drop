/**
 * RealtimeExecutionEngine - WebSocket-first execution engine
 * 
 * This engine executes workflows node-by-node with real-time WebSocket updates.
 * No blocking, no polling - pure event-driven execution.
 */

import { PrismaClient } from "@prisma/client";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { ExecutionStatus, NodeExecutionStatus } from "../types/database";
import { logger } from "../utils/logger";
import { NodeService } from "./NodeService";

interface WorkflowNode {
    id: string;
    name: string;
    type: string;
    parameters: any;
    settings?: any;
    position?: { x: number; y: number };
    disabled?: boolean;
}

interface WorkflowConnection {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceOutput?: string;
    targetInput?: string;
}

interface ExecutionContext {
    executionId: string;
    workflowId: string;
    userId: string;
    triggerData: any;
    nodeOutputs: Map<string, any>;
    status: "running" | "completed" | "failed" | "cancelled";
    startTime: number;
    currentNodeId?: string;
}

export class RealtimeExecutionEngine extends EventEmitter {
    private prisma: PrismaClient;
    private nodeService: NodeService;
    private activeExecutions: Map<string, ExecutionContext> = new Map();

    constructor(prisma: PrismaClient, nodeService: NodeService) {
        super();
        this.prisma = prisma;
        this.nodeService = nodeService;
    }

    /**
     * Start workflow execution (non-blocking)
     * Returns execution ID immediately and executes in background
     */
    async startExecution(
        workflowId: string,
        userId: string,
        triggerNodeId: string,
        triggerData: any,
        nodes: WorkflowNode[],
        connections: WorkflowConnection[]
    ): Promise<string> {
        const executionId = uuidv4();

        logger.info(`[RealtimeExecution] Starting execution ${executionId}`, {
            workflowId,
            triggerNodeId,
        });

        // Create execution context
        const context: ExecutionContext = {
            executionId,
            workflowId,
            userId,
            triggerData,
            nodeOutputs: new Map(),
            status: "running",
            startTime: Date.now(),
        };

        this.activeExecutions.set(executionId, context);

        // Create execution record in database
        await this.prisma.execution.create({
            data: {
                id: executionId,
                workflow: { connect: { id: workflowId } },
                status: ExecutionStatus.RUNNING,
                startedAt: new Date(),
                triggerData: triggerData || {},
            },
        });

        // Emit execution started event
        this.emit("execution-started", {
            executionId,
            workflowId,
            userId,
            timestamp: new Date(),
        });

        // Execute workflow in background (don't await)
        this.executeWorkflow(executionId, triggerNodeId, nodes, connections).catch(
            (error) => {
                logger.error(`[RealtimeExecution] Execution ${executionId} failed:`, error);
                this.failExecution(executionId, error);
            }
        );

        return executionId;
    }

    /**
     * Execute workflow node by node
     */
    private async executeWorkflow(
        executionId: string,
        startNodeId: string,
        nodes: WorkflowNode[],
        connections: WorkflowConnection[]
    ): Promise<void> {
        const context = this.activeExecutions.get(executionId);
        if (!context) {
            throw new Error(`Execution context not found: ${executionId}`);
        }

        try {
            // Build execution graph
            const nodeMap = new Map(nodes.map((n) => [n.id, n]));
            const graph = this.buildExecutionGraph(nodes, connections);

            // Execute nodes in order starting from trigger
            await this.executeNode(executionId, startNodeId, nodeMap, graph, context);

            // Mark execution as completed
            await this.completeExecution(executionId);
        } catch (error) {
            // Don't throw - just mark execution as failed
            // This prevents the error from propagating and marking completed nodes as failed
            await this.failExecution(executionId, error);
        }
    }

    /**
     * Execute a single node and its downstream nodes
     */
    private async executeNode(
        executionId: string,
        nodeId: string,
        nodeMap: Map<string, WorkflowNode>,
        graph: Map<string, string[]>,
        context: ExecutionContext
    ): Promise<void> {
        const node = nodeMap.get(nodeId);
        if (!node) {
            logger.warn(`[RealtimeExecution] Node ${nodeId} not found`);
            return;
        }

        // Skip disabled nodes
        if (node.disabled) {
            logger.info(`[RealtimeExecution] Skipping disabled node ${nodeId}`);
            return;
        }

        // Check if execution was cancelled
        if (context.status === "cancelled") {
            logger.info(`[RealtimeExecution] Execution ${executionId} was cancelled`);
            return;
        }

        context.currentNodeId = nodeId;

        logger.info(`[RealtimeExecution] Executing node ${nodeId} (${node.name})`);

        // Emit node started event
        this.emit("node-started", {
            executionId,
            nodeId,
            nodeName: node.name,
            nodeType: node.type,
            timestamp: new Date(),
        });

        // Create node execution record
        const nodeExecution = await this.prisma.nodeExecution.create({
            data: {
                nodeId,
                executionId,
                status: NodeExecutionStatus.RUNNING,
                startedAt: new Date(),
            },
        });

        try {
            // Get input data from connected nodes
            const inputData = this.getNodeInputData(nodeId, graph, context);

            // Execute the node
            const startTime = Date.now();
            const result = await this.nodeService.executeNode(
                node.type,
                node.parameters,
                inputData,
                undefined, // credentials
                executionId,
                context.userId,
                { timeout: 30000 },
                context.workflowId,
                node.settings // Pass node settings (includes continueOnFail)
            );

            const duration = Date.now() - startTime;

            logger.info(`[RealtimeExecution] Node ${nodeId} execution result:`, {
                success: result.success,
                hasData: !!result.data,
                hasError: !!result.error,
            });

            // Check if execution failed
            // If result.success is false but we have data, it means continueOnFail is enabled
            if (!result.success) {
                if (result.data) {
                    // continueOnFail is enabled - treat as success with error data
                    logger.info(`[RealtimeExecution] Node ${nodeId} failed but continuing (continueOnFail enabled)`);
                } else {
                    // No data returned - actual failure
                    throw new Error(result.error?.message || "Node execution failed");
                }
            }

            // Store output data (even if there was an error but continueOnFail is enabled)
            context.nodeOutputs.set(nodeId, result.data);

            // Update node execution record
            await this.prisma.nodeExecution.update({
                where: { id: nodeExecution.id },
                data: {
                    status: NodeExecutionStatus.SUCCESS,
                    outputData: result.data as any,
                    finishedAt: new Date(),
                },
            });

            // Emit node completed event
            this.emit("node-completed", {
                executionId,
                nodeId,
                nodeName: node.name,
                nodeType: node.type,
                outputData: result.data,
                duration,
                timestamp: new Date(),
            });

            logger.info(
                `[RealtimeExecution] Node ${nodeId} completed in ${duration}ms`
            );

            // Execute downstream nodes (outside try-catch so errors don't affect this node)
        } catch (error: any) {
            logger.error(`[RealtimeExecution] Node ${nodeId} failed:`, error);

            // Update node execution record
            await this.prisma.nodeExecution.update({
                where: { id: nodeExecution.id },
                data: {
                    status: NodeExecutionStatus.ERROR,
                    error: {
                        message: error.message,
                        stack: error.stack,
                    },
                    finishedAt: new Date(),
                },
            });

            // Emit node failed event
            this.emit("node-failed", {
                executionId,
                nodeId,
                nodeName: node.name,
                nodeType: node.type,
                error: {
                    message: error.message,
                    stack: error.stack,
                },
                timestamp: new Date(),
            });

            // Throw to stop execution - downstream nodes won't execute
            throw error;
        }

        // Execute downstream nodes AFTER try-catch
        // This way, if a downstream node fails, it doesn't affect this node's status
        const downstreamNodes = graph.get(nodeId) || [];
        for (const downstreamNodeId of downstreamNodes) {
            await this.executeNode(
                executionId,
                downstreamNodeId,
                nodeMap,
                graph,
                context
            );
        }
    }

    /**
     * Build execution graph (node dependencies)
     */
    private buildExecutionGraph(
        nodes: WorkflowNode[],
        connections: WorkflowConnection[]
    ): Map<string, string[]> {
        const graph = new Map<string, string[]>();

        // Initialize graph with all nodes
        nodes.forEach((node) => {
            graph.set(node.id, []);
        });

        // Build connections
        connections.forEach((conn) => {
            const downstream = graph.get(conn.sourceNodeId) || [];
            downstream.push(conn.targetNodeId);
            graph.set(conn.sourceNodeId, downstream);
        });

        return graph;
    }

    /**
     * Get input data for a node from its upstream nodes
     */
    private getNodeInputData(
        nodeId: string,
        graph: Map<string, string[]>,
        context: ExecutionContext
    ): any {
        // Find upstream nodes
        const upstreamNodes: string[] = [];
        graph.forEach((downstream, upstream) => {
            if (downstream.includes(nodeId)) {
                upstreamNodes.push(upstream);
            }
        });

        // If no upstream nodes, use trigger data
        if (upstreamNodes.length === 0) {
            return context.triggerData
                ? { main: [[context.triggerData]] }
                : { main: [[]] };
        }

        // Collect output from upstream nodes
        const inputs: any[] = [];
        upstreamNodes.forEach((upstreamId) => {
            const output = context.nodeOutputs.get(upstreamId);
            if (output) {
                inputs.push(output);
            }
        });

        // Always return an object structure, even if empty
        return inputs.length > 0 ? { main: inputs } : { main: [] };
    }

    /**
     * Complete execution
     */
    private async completeExecution(executionId: string): Promise<void> {
        const context = this.activeExecutions.get(executionId);
        if (!context) return;

        context.status = "completed";

        await this.prisma.execution.update({
            where: { id: executionId },
            data: {
                status: ExecutionStatus.SUCCESS,
                finishedAt: new Date(),
            },
        });

        this.emit("execution-completed", {
            executionId,
            duration: Date.now() - context.startTime,
            timestamp: new Date(),
        });

        logger.info(`[RealtimeExecution] Execution ${executionId} completed`);

        // Cleanup after a delay
        setTimeout(() => {
            this.activeExecutions.delete(executionId);
        }, 60000); // Keep for 1 minute
    }

    /**
     * Fail execution
     */
    private async failExecution(executionId: string, error: any): Promise<void> {
        const context = this.activeExecutions.get(executionId);
        if (!context) return;

        context.status = "failed";

        await this.prisma.execution.update({
            where: { id: executionId },
            data: {
                status: ExecutionStatus.ERROR,
                finishedAt: new Date(),
                error: {
                    message: error.message,
                    stack: error.stack,
                },
            },
        });

        this.emit("execution-failed", {
            executionId,
            error: {
                message: error.message,
                stack: error.stack,
            },
            timestamp: new Date(),
        });

        logger.error(`[RealtimeExecution] Execution ${executionId} failed:`, error);

        // Cleanup after a delay
        setTimeout(() => {
            this.activeExecutions.delete(executionId);
        }, 60000);
    }

    /**
     * Cancel execution
     */
    async cancelExecution(executionId: string): Promise<void> {
        const context = this.activeExecutions.get(executionId);
        if (!context) {
            throw new Error(`Execution ${executionId} not found`);
        }

        context.status = "cancelled";

        await this.prisma.execution.update({
            where: { id: executionId },
            data: {
                status: ExecutionStatus.CANCELLED,
                finishedAt: new Date(),
            },
        });

        this.emit("execution-cancelled", {
            executionId,
            timestamp: new Date(),
        });

        logger.info(`[RealtimeExecution] Execution ${executionId} cancelled`);

        this.activeExecutions.delete(executionId);
    }

    /**
     * Get execution status
     */
    getExecutionStatus(executionId: string): ExecutionContext | undefined {
        return this.activeExecutions.get(executionId);
    }
}
