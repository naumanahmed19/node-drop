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
    credentials?: string[]; // Array of credential IDs
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
    nodes: any[]; // Store nodes for service input resolution
    status: "running" | "completed" | "failed" | "cancelled";
    startTime: number;
    currentNodeId?: string;
    saveToDatabase?: boolean; // Whether to save execution to database
}

export class RealtimeExecutionEngine extends EventEmitter {
    private prisma: PrismaClient;
    private nodeService: NodeService;
    private activeExecutions: Map<string, ExecutionContext> = new Map();
    
    // Memory leak prevention
    private readonly MAX_ACTIVE_EXECUTIONS = 50;

    constructor(prisma: PrismaClient, nodeService: NodeService) {
        super();
        this.prisma = prisma;
        this.nodeService = nodeService;
    }

    /**
     * Build credentials mapping from node's credential IDs
     * Maps credential type to credential ID for node execution
     * This matches the approach used in FlowExecutionEngine
     */
    private async buildCredentialsMapping(node: WorkflowNode, userId: string): Promise<Record<string, string>> {
        const credentialsMapping: Record<string, string> = {};

        logger.info(`[RealtimeExecution] Building credentials mapping for node ${node.id}`, {
            nodeType: node.type,
            nodeParameters: Object.keys(node.parameters || {}),
            hasCredentials: !!node.credentials,
            credentialsLength: node.credentials?.length || 0,
        });

        // PRIMARY METHOD: Get node type definition and extract credentials from parameters
        // This is how FlowExecutionEngine does it and is the correct approach
        try {
            const allNodeTypes = await this.nodeService.getNodeTypes();
            const nodeTypeInfo = allNodeTypes.find((nt) => nt.identifier === node.type);

            if (nodeTypeInfo && nodeTypeInfo.properties) {
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
                            // Verify credential exists and belongs to user
                            const cred = await this.prisma.credential.findUnique({
                                where: { id: credentialId },
                                select: { type: true, userId: true }
                            });

                            if (cred) {
                                if (cred.userId !== userId) {
                                    logger.warn(`[RealtimeExecution] Credential ${credentialId} does not belong to user ${userId}`);
                                    continue;
                                }
                                // Map credential type to ID
                                // property.allowedTypes[0] is the credential type (e.g., "postgresDb")
                                credentialsMapping[property.allowedTypes[0]] = credentialId;
                                logger.info(`[RealtimeExecution] Mapped credential type '${property.allowedTypes[0]}' to ID '${credentialId}' from parameter '${property.name}'`);
                            } else {
                                logger.warn(`[RealtimeExecution] Credential ${credentialId} not found in database`);
                            }
                        }
                    }
                }
            } else {
                logger.warn(`[RealtimeExecution] Node type info not found for ${node.type}`);
            }
        } catch (error) {
            logger.error(`[RealtimeExecution] Failed to build credentials mapping from node type definition`, { error });
        }

        // FALLBACK 1: Check if credentials are stored in node.credentials array (legacy format)
        if (Object.keys(credentialsMapping).length === 0 && node.credentials && Array.isArray(node.credentials) && node.credentials.length > 0) {
            logger.info(`[RealtimeExecution] No credentials found via node type, checking node.credentials array`);
            
            for (const credId of node.credentials) {
                try {
                    const cred = await this.prisma.credential.findUnique({
                        where: { id: credId },
                        select: { type: true, userId: true }
                    });
                    if (cred) {
                        if (cred.userId !== userId) {
                            logger.warn(`[RealtimeExecution] Credential ${credId} does not belong to user ${userId}`);
                            continue;
                        }
                        credentialsMapping[cred.type] = credId;
                        logger.info(`[RealtimeExecution] Mapped credential type '${cred.type}' to ID '${credId}' from credentials array`);
                    }
                } catch (error) {
                    logger.error(`[RealtimeExecution] Failed to fetch credential ${credId}`, { error });
                }
            }
        }

        // FALLBACK 2: Scan all parameters for credential IDs (last resort)
        if (Object.keys(credentialsMapping).length === 0 && node.parameters) {
            logger.info(`[RealtimeExecution] No credentials found, scanning all parameters for credential IDs`);
            
            for (const [key, value] of Object.entries(node.parameters)) {
                if (typeof value === 'string' && value.startsWith('cred_')) {
                    try {
                        const cred = await this.prisma.credential.findUnique({
                            where: { id: value },
                            select: { type: true, userId: true }
                        });
                        if (cred && cred.userId === userId) {
                            credentialsMapping[cred.type] = value;
                            logger.info(`[RealtimeExecution] Found credential in parameter '${key}': type '${cred.type}' -> ID '${value}'`);
                        }
                    } catch (error) {
                        // Silently ignore - not all parameters are credentials
                    }
                }
            }
        }

        logger.info(`[RealtimeExecution] Final credentials mapping for node ${node.id}:`, {
            mappingKeys: Object.keys(credentialsMapping),
            mapping: credentialsMapping,
        });

        return credentialsMapping;
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
        connections: WorkflowConnection[],
        options?: { saveToDatabase?: boolean }
    ): Promise<string> {
        // Check limit before creating new execution to prevent memory leaks
        if (this.activeExecutions.size >= this.MAX_ACTIVE_EXECUTIONS) {
            // Clean up oldest completed/failed executions
            const toDelete: string[] = [];
            for (const [id, ctx] of this.activeExecutions.entries()) {
                if (ctx.status !== 'running') {
                    toDelete.push(id);
                    if (toDelete.length >= 10) break; // Remove 10 at a time
                }
            }
            toDelete.forEach(id => {
                this.activeExecutions.delete(id);
                logger.info(`[RealtimeExecution] Cleaned up completed execution: ${id}`);
            });
            
            if (this.activeExecutions.size >= this.MAX_ACTIVE_EXECUTIONS) {
                logger.error(`[RealtimeExecution] Too many concurrent executions: ${this.activeExecutions.size}`);
                throw new Error('Too many concurrent executions. Please try again later.');
            }
        }

        const executionId = uuidv4();

        logger.info(`[RealtimeExecution] Starting execution ${executionId}`, {
            workflowId,
            triggerNodeId,
            activeExecutions: this.activeExecutions.size,
        });

        // Create execution context
        const saveToDatabase = options?.saveToDatabase !== false; // Default to true
        
        const context: ExecutionContext = {
            executionId,
            workflowId,
            userId,
            triggerData,
            nodeOutputs: new Map(),
            connections, // Store connections for branch checking
            nodes, // Store nodes for service input resolution
            status: "running",
            startTime: Date.now(),
            saveToDatabase, // Store in context for later use
        };

        this.activeExecutions.set(executionId, context);

        // Create execution record in database (unless saveToDatabase is false)
        if (saveToDatabase) {
            await this.prisma.execution.create({
                data: {
                    id: executionId,
                    workflow: { connect: { id: workflowId } },
                    status: ExecutionStatus.RUNNING,
                    startedAt: new Date(),
                    triggerData: triggerData || {},
                },
            });
        } else {
            console.log(`⏭️  Skipping database save for realtime execution ${executionId} (saveToDatabase: false)`);
            logger.info(`Skipping database save for realtime execution`, {
                executionId,
                workflowId,
            });
        }

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
     * Check if a node is a service node (has no inputs)
     * Service nodes include model, memory, and tool nodes
     */
    private async isServiceNode(nodeType: string): Promise<boolean> {
        try {
            const allNodeTypes = await this.nodeService.getNodeTypes();
            const nodeTypeInfo = allNodeTypes.find((nt) => nt.identifier === nodeType);
            
            if (!nodeTypeInfo) {
                return false;
            }
            
            // Service nodes have no inputs (inputs: [])
            return Array.isArray(nodeTypeInfo.inputs) && nodeTypeInfo.inputs.length === 0;
        } catch (error) {
            logger.error(`[RealtimeExecution] Failed to check if node is service node`, { nodeType, error });
            return false;
        }
    }

    /**
     * Validate a service node (model, memory, tool)
     */
    private validateServiceNode(
        serviceNode: any,
        nodeDefinition: any,
        inputName: string
    ): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        // Validate that the service node has no inputs (is actually a service node)
        if (nodeDefinition && Array.isArray(nodeDefinition.inputs) && nodeDefinition.inputs.length > 0) {
            errors.push(
                `Invalid service node: ${serviceNode.type} has inputs and cannot be used as a service node`
            );
        }
        
        // Validate required parameters
        if (nodeDefinition && nodeDefinition.properties) {
            const properties = Array.isArray(nodeDefinition.properties) 
                ? nodeDefinition.properties 
                : [];
            
            for (const property of properties) {
                if (property.required && !serviceNode.parameters?.[property.name]) {
                    errors.push(
                        `${serviceNode.type}: Missing required parameter '${property.displayName || property.name}'`
                    );
                }
            }
        }
        
        // Check if node has credential-type properties that are required
        if (nodeDefinition && nodeDefinition.properties) {
            const properties = Array.isArray(nodeDefinition.properties) 
                ? nodeDefinition.properties 
                : [];
            
            for (const property of properties) {
                if (property.type === 'credential' && property.required) {
                    const hasCredentials = serviceNode.credentials && Object.keys(serviceNode.credentials).length > 0;
                    const hasCredentialInParams = serviceNode.parameters && 
                        Object.values(serviceNode.parameters).some((v: any) => 
                            typeof v === 'string' && v.startsWith('cred_')
                        );
                    
                    if (!hasCredentials && !hasCredentialInParams) {
                        errors.push(
                            `${serviceNode.type}: Missing required credentials. Please configure API credentials.`
                        );
                        break; // Only report once per node
                    }
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors,
        };
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
        
        // Skip service nodes (they are called by other nodes, not executed directly)
        // Service nodes are identified by having no inputs (inputs: [])
        // This includes model nodes, memory nodes, and tool nodes
        const isServiceNode = await this.isServiceNode(node.type);
        
        if (isServiceNode) {
            logger.info(`[RealtimeExecution] Skipping service node ${nodeId} (${node.type}) - will be called by parent node`);
            
            // Still execute downstream nodes
            const downstreamNodes = graph.get(nodeId) || [];
            for (const downstreamNodeId of downstreamNodes) {
                await this.executeNode(executionId, downstreamNodeId, nodeMap, graph, context);
            }
            
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

        // Create node execution record (if saveToDatabase is enabled)
        let nodeExecution: any = null;
        if (context.saveToDatabase !== false) {
            nodeExecution = await this.prisma.nodeExecution.create({
                data: {
                    nodeId,
                    executionId,
                    status: NodeExecutionStatus.RUNNING,
                    startedAt: new Date(),
                },
            });
        }

        try {
            // Get input data from connected nodes
            const inputData = this.getNodeInputData(nodeId, graph, context);

            // Execute the node
            const startTime = Date.now();

            // Build credentials mapping from node's credential IDs
            const credentialsMapping = await this.buildCredentialsMapping(node, context.userId);

            const result = await this.nodeService.executeNode(
                node.type,
                node.parameters,
                inputData,
                credentialsMapping, // Pass credentials mapping
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
                dataKeys: result.data ? Object.keys(result.data) : [],
                mainDataLength: result.data?.main ? result.data.main.length : 0,
            });

            // Check if execution failed
            // If result.success is false but we have data, it means continueOnFail is enabled
            if (!result.success) {
                if (result.data) {
                    // continueOnFail is enabled - treat as success with error data
                    logger.info(`[RealtimeExecution] Node ${nodeId} failed but continuing (continueOnFail enabled)`, {
                        hasData: true,
                        dataKeys: Object.keys(result.data),
                        mainDataLength: result.data.main ? result.data.main.length : 0,
                    });
                } else {
                    // No data returned - actual failure
                    logger.error(`[RealtimeExecution] Node ${nodeId} failed without data - stopping execution`, {
                        error: result.error?.message,
                    });
                    throw new Error(result.error?.message || "Node execution failed");
                }
            }

            // Store output data (even if there was an error but continueOnFail is enabled)
            context.nodeOutputs.set(nodeId, result.data);

            // Update node execution record (if saveToDatabase is enabled)
            if (context.saveToDatabase !== false && nodeExecution) {
                await this.prisma.nodeExecution.update({
                    where: { id: nodeExecution.id },
                    data: {
                        status: NodeExecutionStatus.SUCCESS,
                        outputData: result.data as any,
                        finishedAt: new Date(),
                    },
                });
            }

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

            // Update node execution record (if saveToDatabase is enabled)
            if (context.saveToDatabase !== false && nodeExecution) {
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
            }

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

            // Create node execution record (if saveToDatabase is enabled)
            let nodeExecution: any = null;
            if (context.saveToDatabase !== false) {
                nodeExecution = await this.prisma.nodeExecution.create({
                    data: {
                        nodeId,
                        executionId,
                        status: NodeExecutionStatus.RUNNING,
                        startedAt: new Date(),
                    },
                });
            }

            try {
                // Get input data
                const inputData = this.getNodeInputData(nodeId, graph, context);

                // Execute the loop node
                const startTime = Date.now();

                // Build credentials mapping from node's credential IDs
                const credentialsMapping = await this.buildCredentialsMapping(node, context.userId);

                const result = await this.nodeService.executeNode(
                    node.type,
                    node.parameters,
                    inputData,
                    credentialsMapping, // Pass credentials mapping
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

                // Update node execution record (if saveToDatabase is enabled)
                if (context.saveToDatabase !== false && nodeExecution) {
                    await this.prisma.nodeExecution.update({
                        where: { id: nodeExecution.id },
                        data: {
                            status: NodeExecutionStatus.SUCCESS,
                            outputData: result.data as any,
                            finishedAt: new Date(),
                        },
                    });
                }

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

                if (context.saveToDatabase !== false && nodeExecution) {
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
                }

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

        // Group connections by target input name (for nodes with multiple named inputs like AI Agent)
        const connectionsByInput = new Map<string, typeof incomingConnections>();
        
        for (const connection of incomingConnections) {
            const targetInput = connection.targetInput || 'main';
            if (!connectionsByInput.has(targetInput)) {
                connectionsByInput.set(targetInput, []);
            }
            connectionsByInput.get(targetInput)!.push(connection);
        }

        const inputData: any = {};

        // Process each named input
        for (const [inputName, connections] of connectionsByInput.entries()) {
            // Check if this is a service input (model, memory, tools, etc.)
            // Service inputs should receive node references, not data
            const isServiceInput = inputName !== 'main' && inputName !== 'done';
            
            if (isServiceInput && connections.length > 0) {
                // For service inputs, store references to the connected nodes
                const serviceNodes: any[] = [];
                const validationErrors: string[] = [];
                
                for (const connection of connections) {
                    const sourceNode = context.nodes.find((n: any) => n.id === connection.sourceNodeId);
                    if (sourceNode) {
                        logger.info(`[RealtimeExecution] Processing service node for input '${inputName}'`, {
                            sourceNodeId: sourceNode.id,
                            sourceNodeType: sourceNode.type,
                            hasParameters: !!sourceNode.parameters,
                            hasCredentials: !!sourceNode.credentials,
                            parametersKeys: sourceNode.parameters ? Object.keys(sourceNode.parameters) : [],
                            credentialsKeys: sourceNode.credentials ? Object.keys(sourceNode.credentials) : [],
                        });
                        
                        // Store full node configuration including parameters and credentials
                        // Credentials can be stored in:
                        // 1. A separate credentials field (legacy)
                        // 2. In parameters (for nodes with credential-type properties)
                        const nodeParameters = sourceNode.parameters || {};
                        const nodeCredentials = sourceNode.credentials || {};
                        
                        // Build credentials mapping from parameters
                        // We need to map credential types to credential IDs
                        // For example: { "apiKey": "cred_123" } instead of { "authentication": "cred_123" }
                        const credentialsMapping: Record<string, string> = { ...nodeCredentials };
                        
                        logger.info(`[RealtimeExecution] Initial credentials mapping`, {
                            sourceNodeType: sourceNode.type,
                            credentialsMapping,
                            nodeParameters,
                        });
                        
                        // Get node definition from registry (synchronous access)
                        const nodeDefinition = this.nodeService['nodeRegistry']?.get(sourceNode.type);
                        
                        logger.info(`[RealtimeExecution] Node definition lookup`, {
                            sourceNodeType: sourceNode.type,
                            hasNodeDefinition: !!nodeDefinition,
                            hasProperties: !!(nodeDefinition && nodeDefinition.properties),
                            propertiesCount: nodeDefinition && nodeDefinition.properties ? (Array.isArray(nodeDefinition.properties) ? nodeDefinition.properties.length : 0) : 0,
                        });
                        
                        if (nodeDefinition && nodeDefinition.properties) {
                            const properties = Array.isArray(nodeDefinition.properties) 
                                ? nodeDefinition.properties 
                                : [];
                            
                            logger.info(`[RealtimeExecution] Scanning ${properties.length} properties for credentials`, {
                                sourceNodeType: sourceNode.type,
                                propertyNames: properties.map((p: any) => p.name),
                            });
                            
                            // Find credential properties and map their types to IDs
                            for (const property of properties) {
                                logger.info(`[RealtimeExecution] Checking property`, {
                                    propertyName: property.name,
                                    propertyType: property.type,
                                    isCredential: property.type === 'credential',
                                    hasAllowedTypes: !!(property.allowedTypes && property.allowedTypes.length > 0),
                                    allowedTypes: property.allowedTypes,
                                });
                                
                                if (property.type === 'credential' && property.allowedTypes && property.allowedTypes.length > 0) {
                                    const credentialId = nodeParameters[property.name];
                                    
                                    logger.info(`[RealtimeExecution] Found credential property`, {
                                        propertyName: property.name,
                                        allowedTypes: property.allowedTypes,
                                        credentialId,
                                        isValidCredentialId: credentialId && typeof credentialId === 'string',
                                    });
                                    
                                    // Check if this is a valid credential ID (any non-empty string)
                                    if (credentialId && typeof credentialId === 'string' && credentialId.trim().length > 0) {
                                        // Map the credential type to the credential ID
                                        // Use the first allowed type as the key
                                        const credentialType = property.allowedTypes[0];
                                        credentialsMapping[credentialType] = credentialId;
                                        
                                        logger.info(`[RealtimeExecution] ✅ Mapped credential type '${credentialType}' to ID '${credentialId}' from parameter '${property.name}'`, {
                                            nodeType: sourceNode.type,
                                            parameterName: property.name,
                                            credentialType,
                                            credentialId,
                                        });
                                    }
                                }
                            }
                        }
                        
                        // Fallback: Also scan parameters for any credential IDs not yet mapped
                        logger.info(`[RealtimeExecution] Scanning parameters for unmapped credentials`, {
                            sourceNodeType: sourceNode.type,
                            parameterKeys: Object.keys(nodeParameters),
                        });
                        
                        for (const [key, value] of Object.entries(nodeParameters)) {
                            if (typeof value === 'string' && value.startsWith('cred_')) {
                                // Store with parameter name as key if not already mapped by type
                                if (!Object.values(credentialsMapping).includes(value)) {
                                    credentialsMapping[key] = value;
                                    logger.info(`[RealtimeExecution] Added unmapped credential from parameter`, {
                                        parameterName: key,
                                        credentialId: value,
                                    });
                                }
                            }
                        }
                        
                        logger.info(`[RealtimeExecution] Final credentials mapping for service node`, {
                            sourceNodeType: sourceNode.type,
                            sourceNodeId: sourceNode.id,
                            credentialsMapping,
                            credentialsMappingKeys: Object.keys(credentialsMapping),
                        });
                        
                        // Emit node-started event for service node validation
                        this.emit('node-started', {
                            executionId: context.executionId,
                            nodeId: sourceNode.id,
                            nodeName: sourceNode.parameters?.name || sourceNode.type,
                            nodeType: sourceNode.type,
                            timestamp: new Date(),
                        });
                        
                        // Validate service node based on type
                        const validationResult = this.validateServiceNode(sourceNode, nodeDefinition, inputName);
                        
                        if (!validationResult.valid) {
                            validationErrors.push(...validationResult.errors);
                            logger.error(`[RealtimeExecution] Service node validation failed`, {
                                sourceNodeType: sourceNode.type,
                                sourceNodeId: sourceNode.id,
                                inputName,
                                errors: validationResult.errors,
                            });
                            
                            // Emit node-failed event for the service node itself
                            this.emit('node-failed', {
                                executionId: context.executionId,
                                nodeId: sourceNode.id,
                                nodeName: sourceNode.parameters?.name || sourceNode.type,
                                nodeType: sourceNode.type,
                                error: {
                                    message: validationResult.errors.join(', '),
                                    type: 'validation',
                                },
                                timestamp: new Date(),
                            });
                        } else {
                            // Emit node-completed event for successful validation
                            this.emit('node-completed', {
                                executionId: context.executionId,
                                nodeId: sourceNode.id,
                                nodeName: sourceNode.parameters?.name || sourceNode.type,
                                nodeType: sourceNode.type,
                                timestamp: new Date(),
                            });
                            
                            serviceNodes.push({
                                id: sourceNode.id,
                                type: sourceNode.type,
                                nodeId: connection.sourceNodeId,
                                parameters: nodeParameters,
                                credentials: credentialsMapping,
                            });
                        }
                    }
                }
                
                // If there are validation errors, emit node-failed event and throw error
                if (validationErrors.length > 0) {
                    const errorMessage = `Service node validation failed for '${inputName}': ${validationErrors.join(', ')}`;
                    
                    // Get the target node from context
                    const targetNode = context.nodes.find((n: any) => n.id === nodeId);
                    
                    logger.error(`[RealtimeExecution] ❌ Service validation failed`, {
                        nodeId,
                        inputName,
                        errors: validationErrors,
                    });
                    
                    // Emit node-failed event for the parent node
                    this.emit('node-failed', {
                        executionId: context.executionId,
                        nodeId,
                        nodeName: targetNode?.parameters?.name || targetNode?.type || 'Unknown',
                        nodeType: targetNode?.type || 'unknown',
                        error: {
                            message: errorMessage,
                            type: 'validation',
                        },
                        timestamp: new Date(),
                    });
                    
                    throw new Error(errorMessage);
                }
                
                // Store service node references
                inputData[inputName] = serviceNodes;
                
                logger.info(`[RealtimeExecution] ✅ Prepared service input '${inputName}' for node ${nodeId}`, {
                    serviceNodeCount: serviceNodes.length,
                    serviceNodeTypes: serviceNodes.map((n: any) => n.type),
                    serviceNodesDetails: serviceNodes.map((n: any) => ({
                        type: n.type,
                        nodeId: n.nodeId,
                        credentialKeys: Object.keys(n.credentials || {}),
                        credentials: n.credentials,
                    })),
                });
            } else {
                // Regular data input - process normally
                const inputsPerConnection: any[][] = [];

                for (const connection of connections) {
                    const sourceOutput = context.nodeOutputs.get(connection.sourceNodeId);
                    const connectionData: any[] = [];

                    if (sourceOutput) {
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
                                connectionData.push(...branchData);
                            } else {
                                logger.info(`[RealtimeExecution] Branch '${outputBranch}' is empty`);
                            }
                        } else {
                            // For non-branching nodes, use main output
                            const mainData = sourceOutput.main;
                            if (Array.isArray(mainData) && mainData.length > 0) {
                                logger.info(`[RealtimeExecution] Using main output with ${mainData.length} items`);
                                connectionData.push(...mainData);
                            }
                        }
                    }

                    // Add this connection's data as a separate array
                    inputsPerConnection.push(connectionData);
                }

                // Store data for this named input
                if (inputsPerConnection.length > 1) {
                    // Multiple connections to same input: keep them separate (2D array)
                    inputData[inputName] = inputsPerConnection;
                } else if (inputsPerConnection.length === 1) {
                    // Single connection: use existing format for backward compatibility
                    inputData[inputName] = [inputsPerConnection[0]];
                } else {
                    // No connections with data
                    inputData[inputName] = [[]];
                }
            }
        }

        // Ensure 'main' input exists for backward compatibility
        if (!inputData.main) {
            inputData.main = [[]];
        }

        return inputData;
    }

    /**
     * Complete execution
     */
    private async completeExecution(executionId: string): Promise<void> {
        const context = this.activeExecutions.get(executionId);
        if (!context) return;

        context.status = "completed";

        if (context.saveToDatabase !== false) {
            await this.prisma.execution.update({
                where: { id: executionId },
                data: {
                    status: ExecutionStatus.SUCCESS,
                    finishedAt: new Date(),
                },
            });
        }

        this.emit("execution-completed", {
            executionId,
            duration: Date.now() - context.startTime,
            timestamp: new Date(),
        });

        logger.info(`[RealtimeExecution] Execution ${executionId} completed`);

        // Cleanup after a short delay (reduced from 60s to 5s to prevent memory leaks)
        setTimeout(() => {
            this.activeExecutions.delete(executionId);
            
            // Cleanup socket room if socketService is available
            if (global.socketService) {
                global.socketService.cleanupExecutionRoom(executionId);
            }
            
            logger.debug(`[RealtimeExecution] Cleaned up execution context: ${executionId}`);
        }, 5000); // Reduced from 60000ms to 5000ms
    }

    /**
     * Fail execution
     */
    private async failExecution(executionId: string, error: any): Promise<void> {
        const context = this.activeExecutions.get(executionId);
        if (!context) return;

        context.status = "failed";

        if (context.saveToDatabase !== false) {
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
        }

        this.emit("execution-failed", {
            executionId,
            error: {
                message: error.message,
                stack: error.stack,
            },
            timestamp: new Date(),
        });

        logger.error(`[RealtimeExecution] Execution ${executionId} failed:`, error);

        // Cleanup after a short delay (reduced from 60s to 5s to prevent memory leaks)
        setTimeout(() => {
            this.activeExecutions.delete(executionId);
            
            // Cleanup socket room if socketService is available
            if (global.socketService) {
                global.socketService.cleanupExecutionRoom(executionId);
            }
            
            logger.debug(`[RealtimeExecution] Cleaned up failed execution context: ${executionId}`);
        }, 5000); // Reduced from 60000ms to 5000ms
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

        if (context.saveToDatabase !== false) {
            await this.prisma.execution.update({
                where: { id: executionId },
                data: {
                    status: ExecutionStatus.CANCELLED,
                    finishedAt: new Date(),
                },
            });
        }

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
