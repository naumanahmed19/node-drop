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
    connections: WorkflowConnection[]; // Store connections for branch checking
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
            connections, // Store connections for branch checking
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

        // Check if this is a loop node - handle specially
        if (node.type === "loop") {
            await this.executeLoopNode(executionId, nodeId, node, nodeMap, graph, context);
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

            // Find which edges/connections will be activated by this node
            // For branching nodes (like IfElse), only include connections where the branch has data
            const allConnections = context.connections.filter((conn) => conn.sourceNodeId === nodeId);
            const activeConnections: any[] = [];

            for (const conn of allConnections) {
                const outputBranch = conn.sourceOutput || "main";

                // Check if this branch has data
                let hasData = false;

                if (result.data?.branches) {
                    // Branching node - check specific branch
                    const branchData = result.data.branches[outputBranch];
                    hasData = Array.isArray(branchData) && branchData.length > 0;
                } else if (result.data?.main) {
                    // Non-branching node - check main output
                    hasData = Array.isArray(result.data.main) && result.data.main.length > 0;
                } else {
                    // No data structure, assume has data
                    hasData = true;
                }

                if (hasData) {
                    activeConnections.push({
                        id: conn.id,
                        sourceNodeId: conn.sourceNodeId,
                        targetNodeId: conn.targetNodeId,
                        sourceOutput: conn.sourceOutput,
                    });
                }
            }

            logger.info(`[RealtimeExecution] Node ${nodeId} completed - active connections:`, {
                totalConnections: allConnections.length,
                activeConnectionsCount: activeConnections.length,
                activeConnections,
                hasBranches: !!result.data?.branches,
            });

            // Emit node completed event with active connections
            this.emit("node-completed", {
                executionId,
                nodeId,
                nodeName: node.name,
                nodeType: node.type,
                outputData: result.data,
                duration,
                timestamp: new Date(),
                activeConnections, // NEW: Include which connections are active
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

        logger.info(`[RealtimeExecution] Node ${nodeId} has ${downstreamNodes.length} downstream nodes`);

        for (const downstreamNodeId of downstreamNodes) {
            // Check if downstream node will have data from this connection
            const willHaveData = this.willNodeHaveData(
                nodeId,
                downstreamNodeId,
                context
            );

            if (!willHaveData) {
                logger.info(`[RealtimeExecution] Skipping downstream node ${downstreamNodeId} - no data from branch`);
                continue;
            }

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
     * Execute a loop node with iteration control
     */
    private async executeLoopNode(
        executionId: string,
        nodeId: string,
        node: WorkflowNode,
        nodeMap: Map<string, WorkflowNode>,
        graph: Map<string, string[]>,
        context: ExecutionContext
    ): Promise<void> {
        logger.info(`[RealtimeExecution] Starting loop node ${nodeId}`);

        // Find connections from this loop node
        const loopConnections = context.connections.filter(
            (conn) => conn.sourceNodeId === nodeId && conn.sourceOutput === "loop"
        );
        const doneConnections = context.connections.filter(
            (conn) => conn.sourceNodeId === nodeId && conn.sourceOutput === "done"
        );

        let loopComplete = false;
        let iterationCount = 0;
        const maxIterations = 100000;

        while (!loopComplete && iterationCount < maxIterations) {
            if (context.status === "cancelled") {
                logger.info(`[RealtimeExecution] Loop cancelled at iteration ${iterationCount}`);
                return;
            }

            iterationCount++;
            logger.info(`[RealtimeExecution] Loop ${nodeId} - Iteration ${iterationCount}`);

            // Execute the loop node itself
            context.currentNodeId = nodeId;

            // Emit node started event
            this.emit("node-started", {
                executionId,
                nodeId,
                nodeName: node.name,
                nodeType: node.type,
                iteration: iterationCount,
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
                // Get input data
                const inputData = this.getNodeInputData(nodeId, graph, context);

                // Execute the loop node
                const startTime = Date.now();
                const result = await this.nodeService.executeNode(
                    node.type,
                    node.parameters,
                    inputData,
                    undefined,
                    executionId,
                    context.userId,
                    { timeout: 30000, nodeId }, // Pass nodeId for state management
                    context.workflowId,
                    node.settings
                );

                const duration = Date.now() - startTime;

                if (!result.success) {
                    throw new Error(result.error?.message || "Loop node execution failed");
                }

                // Store output
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

                // Check loop and done outputs
                const loopData = result.data?.branches?.["loop"] || [];
                const doneData = result.data?.branches?.["done"] || [];

                logger.info(`[RealtimeExecution] Loop ${nodeId} output:`, {
                    loopDataLength: loopData.length,
                    doneDataLength: doneData.length,
                    iteration: iterationCount,
                });

                // Emit node completed event
                this.emit("node-completed", {
                    executionId,
                    nodeId,
                    nodeName: node.name,
                    nodeType: node.type,
                    outputData: result.data,
                    duration,
                    iteration: iterationCount,
                    loopDataLength: loopData.length,
                    doneDataLength: doneData.length,
                    timestamp: new Date(),
                });

                // If loop output has data, execute downstream nodes
                if (loopData.length > 0) {
                    logger.info(`[RealtimeExecution] Loop has data, executing downstream nodes`);

                    // Execute all nodes connected to loop output
                    for (const conn of loopConnections) {
                        await this.executeNode(
                            executionId,
                            conn.targetNodeId,
                            nodeMap,
                            graph,
                            context
                        );
                    }
                }

                // If done output has data, loop is complete
                if (doneData.length > 0) {
                    logger.info(`[RealtimeExecution] Loop ${nodeId} completed after ${iterationCount} iterations`);
                    loopComplete = true;

                    // Execute nodes connected to done output
                    for (const conn of doneConnections) {
                        await this.executeNode(
                            executionId,
                            conn.targetNodeId,
                            nodeMap,
                            graph,
                            context
                        );
                    }
                }

                // If both outputs are empty, loop is stuck
                if (loopData.length === 0 && doneData.length === 0) {
                    throw new Error(`Loop node ${nodeId} produced no output - loop is stuck`);
                }
            } catch (error: any) {
                logger.error(`[RealtimeExecution] Loop node ${nodeId} failed:`, error);

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

                this.emit("node-failed", {
                    executionId,
                    nodeId,
                    nodeName: node.name,
                    nodeType: node.type,
                    error: {
                        message: error.message,
                        stack: error.stack,
                    },
                    iteration: iterationCount,
                    timestamp: new Date(),
                });

                throw error;
            }
        }

        if (iterationCount >= maxIterations) {
            throw new Error(`Loop node ${nodeId} exceeded maximum iterations (${maxIterations})`);
        }

        logger.info(`[RealtimeExecution] Loop node ${nodeId} finished`);
    }

    /**
     * Check if a downstream node will have data from a specific source node
     * Used to skip nodes connected to empty branches (e.g., IfElse false branch when condition is true)
     */
    private willNodeHaveData(
        sourceNodeId: string,
        targetNodeId: string,
        context: ExecutionContext
    ): boolean {
        // Find the connection between source and target
        const connection = context.connections.find(
            (conn) => conn.sourceNodeId === sourceNodeId && conn.targetNodeId === targetNodeId
        );

        if (!connection) {
            logger.warn(`[RealtimeExecution] No connection found between ${sourceNodeId} and ${targetNodeId}`);
            return false;
        }

        // Get source node output
        const sourceOutput = context.nodeOutputs.get(sourceNodeId);
        if (!sourceOutput) {
            logger.warn(`[RealtimeExecution] No output data from source node ${sourceNodeId}`);
            return false;
        }

        const outputBranch = connection.sourceOutput || "main";

        logger.info(`[RealtimeExecution] Checking if node ${targetNodeId} will have data from ${sourceNodeId}`, {
            outputBranch,
            hasMetadata: !!sourceOutput.metadata,
            hasBranches: !!sourceOutput.branches,
            branchKeys: sourceOutput.branches ? Object.keys(sourceOutput.branches) : [],
        });

        // Check if source has branches (like IfElse node)
        if (sourceOutput.branches) {
            const branchData = sourceOutput.branches[outputBranch];
            const hasData = Array.isArray(branchData) && branchData.length > 0;

            logger.info(`[RealtimeExecution] Branch '${outputBranch}' has ${Array.isArray(branchData) ? branchData.length : 0} items`, {
                hasData,
            });

            return hasData;
        }

        // For non-branching nodes, check main output
        const mainData = sourceOutput.main;
        const hasData = Array.isArray(mainData) && mainData.length > 0;

        logger.info(`[RealtimeExecution] Main output has ${Array.isArray(mainData) ? mainData.length : 0} items`, {
            hasData,
        });

        return hasData;
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
        // Find connections targeting this node
        const incomingConnections = context.connections.filter(
            (conn) => conn.targetNodeId === nodeId
        );

        // If no incoming connections, use trigger data
        if (incomingConnections.length === 0) {
            return context.triggerData
                ? { main: [[{ json: context.triggerData }]] }
                : { main: [[]] };
        }

        // Collect output from upstream nodes based on connections
        const inputs: any[] = [];

        for (const connection of incomingConnections) {
            const sourceOutput = context.nodeOutputs.get(connection.sourceNodeId);
            if (!sourceOutput) continue;

            const outputBranch = connection.sourceOutput || "main";

            logger.info(`[RealtimeExecution] Collecting input for ${nodeId} from ${connection.sourceNodeId}`, {
                outputBranch,
                hasBranches: !!sourceOutput.branches,
            });

            // Check if source has branches (like IfElse node)
            if (sourceOutput.branches) {
                const branchData = sourceOutput.branches[outputBranch];
                if (Array.isArray(branchData) && branchData.length > 0) {
                    logger.info(`[RealtimeExecution] Using branch '${outputBranch}' data with ${branchData.length} items`);
                    inputs.push(...branchData);
                } else {
                    logger.info(`[RealtimeExecution] Branch '${outputBranch}' is empty`);
                }
            } else {
                // For non-branching nodes, use main output
                const mainData = sourceOutput.main;
                if (Array.isArray(mainData) && mainData.length > 0) {
                    logger.info(`[RealtimeExecution] Using main output with ${mainData.length} items`);
                    inputs.push(...mainData);
                }
            }
        }

        // Always return an object structure, even if empty
        return inputs.length > 0 ? { main: [inputs] } : { main: [[]] };
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
