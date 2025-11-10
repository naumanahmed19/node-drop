import { PrismaClient } from "@prisma/client";
import * as cron from "node-cron";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../middleware/errorHandler";
import { ExecutionResult } from "../types/database";
import { logger } from "../utils/logger";
import { CredentialService } from "./CredentialService";
import ExecutionHistoryService from "./ExecutionHistoryService";
import { ExecutionService } from "./ExecutionService";
import { NodeService } from "./NodeService";
import { SocketService } from "./SocketService";
import { TriggerExecutionRequest, TriggerManager } from "./TriggerManager";
import { WorkflowService } from "./WorkflowService";

export interface TriggerDefinition {
  id: string;
  type: "webhook" | "schedule" | "manual" | "workflow-called";
  workflowId: string;
  nodeId: string;
  settings: TriggerSettings;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TriggerSettings {
  // Webhook settings
  webhookId?: string;
  webhookUrl?: string; // The generated UUID for the webhook
  webhookPath?: string; // Custom webhook path (e.g., "users", "orders")
  httpMethod?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

  // Authentication settings (old format - stored at settings level)
  authentication?:
    | "none"
    | "basic"
    | "header"
    | "query"
    | {
        type: "none" | "basic" | "header" | "query";
        settings?: Record<string, any>;
      };
  username?: string; // For basic auth (old format)
  password?: string; // For basic auth (old format)
  headerName?: string; // For header auth (old format)
  queryParam?: string; // For query auth (old format)
  expectedValue?: string; // For header/query auth (old format)

  // Schedule settings
  cronExpression?: string;
  timezone?: string;

  // Manual settings (no specific settings needed)

  // Common settings
  description?: string;
  tags?: string[];
}

export interface TriggerEvent {
  id: string;
  triggerId: string;
  workflowId: string;
  type: "webhook" | "schedule" | "manual" | "workflow-called";
  data: any;
  timestamp: Date;
  executionId?: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

export interface WebhookRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, any>;
  body: any;
  ip: string;
  userAgent?: string;
}

export class TriggerService {
  private prisma: PrismaClient;
  private workflowService: WorkflowService;
  private executionService: ExecutionService;
  private socketService: SocketService;
  private executionHistoryService: ExecutionHistoryService;
  private credentialService: CredentialService;
  private triggerManager: TriggerManager;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  // Map webhook key (path or path/uuid) to trigger definition
  private webhookTriggers: Map<string, TriggerDefinition> = new Map();

  constructor(
    prisma: PrismaClient,
    workflowService: WorkflowService,
    executionService: ExecutionService,
    socketService: SocketService,
    nodeService: NodeService,
    executionHistoryService: ExecutionHistoryService,
    credentialService: CredentialService
  ) {
    this.prisma = prisma;
    this.workflowService = workflowService;
    this.executionService = executionService;
    this.socketService = socketService;
    this.executionHistoryService = executionHistoryService;
    this.credentialService = credentialService;

    // Initialize TriggerManager with concurrent execution support
    this.triggerManager = new TriggerManager(
      prisma,
      executionService,
      {
        maxConcurrentTriggers: parseInt(
          process.env.MAX_CONCURRENT_TRIGGERS || "10"
        ),
        maxConcurrentPerWorkflow: parseInt(
          process.env.MAX_CONCURRENT_PER_WORKFLOW || "3"
        ),
        maxConcurrentPerUser: parseInt(
          process.env.MAX_CONCURRENT_PER_USER || "5"
        ),
        enableResourceSharing: process.env.ENABLE_RESOURCE_SHARING !== "false",
        priorityQueuing: process.env.PRIORITY_QUEUING !== "false",
        isolatedExecutionDefault:
          process.env.ISOLATED_EXECUTION_DEFAULT !== "false",
      },
      {
        type: (process.env.TRIGGER_CONFLICT_STRATEGY as any) || "queue",
        options: {
          maxQueueSize: parseInt(process.env.MAX_TRIGGER_QUEUE_SIZE || "100"),
          queueTimeout: parseInt(process.env.TRIGGER_QUEUE_TIMEOUT || "300000"),
        },
      }
    );
  }

  async initialize(): Promise<void> {
    // Load all active triggers from database and activate them
    await this.loadActiveTriggers();
  }

  private async loadActiveTriggers(): Promise<void> {
    try {
      // Get all active workflows with triggers
      const workflows = await this.prisma.workflow.findMany({
        where: { active: true },
        select: {
          id: true,
          userId: true,
          triggers: true,
        },
      });

      for (const workflow of workflows) {
        const triggers = workflow.triggers as any[];
        if (triggers && triggers.length > 0) {
          for (const trigger of triggers) {
            if (trigger.active) {
              await this.activateTrigger(workflow.id, trigger);
            }
          }
        }
      }
    } catch (error) {
      logger.error("Error loading active triggers:", error);
      throw new AppError(
        "Failed to load active triggers",
        500,
        "TRIGGER_LOAD_ERROR"
      );
    }
  }

  async createTrigger(
    workflowId: string,
    userId: string,
    triggerData: Omit<
      TriggerDefinition,
      "id" | "workflowId" | "createdAt" | "updatedAt"
    >
  ): Promise<TriggerDefinition> {
    try {
      // Verify workflow exists and belongs to user
      const workflow = await this.workflowService.getWorkflow(
        workflowId,
        userId
      );

      // Validate trigger settings
      this.validateTriggerSettings(triggerData.type, triggerData.settings);

      // Generate unique ID for trigger
      const triggerId = uuidv4();

      // Create trigger definition
      const trigger: TriggerDefinition = {
        id: triggerId,
        workflowId,
        nodeId: triggerData.nodeId,
        type: triggerData.type,
        settings: triggerData.settings,
        active: triggerData.active,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Update workflow with new trigger
      const currentTriggers = (workflow.triggers as any[]) || [];
      const updatedTriggers = [...currentTriggers, trigger];

      await this.prisma.workflow.update({
        where: { id: workflowId },
        data: {
          triggers: updatedTriggers,
          updatedAt: new Date(),
        },
      });

      // Activate trigger if it's active and workflow is active
      if (trigger.active && workflow.active) {
        await this.activateTrigger(workflowId, trigger);
      }


      return trigger;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Error creating trigger:", error);
      throw new AppError(
        "Failed to create trigger",
        500,
        "TRIGGER_CREATE_ERROR"
      );
    }
  }

  async updateTrigger(
    workflowId: string,
    triggerId: string,
    userId: string,
    updates: Partial<TriggerDefinition>
  ): Promise<TriggerDefinition> {
    try {
      // Get workflow and verify ownership
      const workflow = await this.workflowService.getWorkflow(
        workflowId,
        userId
      );
      const triggers = (workflow.triggers as any[]) || [];

      const triggerIndex = triggers.findIndex((t) => t.id === triggerId);
      if (triggerIndex === -1) {
        throw new AppError("Trigger not found", 404, "TRIGGER_NOT_FOUND");
      }

      const currentTrigger = triggers[triggerIndex];

      // Validate updated settings if provided
      if (updates.settings) {
        this.validateTriggerSettings(
          updates.type || currentTrigger.type,
          updates.settings
        );
      }

      // Update trigger
      const updatedTrigger = {
        ...currentTrigger,
        ...updates,
        updatedAt: new Date(),
      };

      triggers[triggerIndex] = updatedTrigger;

      // Update workflow
      await this.prisma.workflow.update({
        where: { id: workflowId },
        data: {
          triggers: triggers,
          updatedAt: new Date(),
        },
      });

      // Handle activation/deactivation
      if (updates.active !== undefined) {
        if (updates.active && workflow.active) {
          await this.activateTrigger(workflowId, updatedTrigger);
        } else {
          await this.deactivateTrigger(triggerId);
        }
      }


      return updatedTrigger;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Error updating trigger:", error);
      throw new AppError(
        "Failed to update trigger",
        500,
        "TRIGGER_UPDATE_ERROR"
      );
    }
  }

  async deleteTrigger(
    workflowId: string,
    triggerId: string,
    userId: string
  ): Promise<void> {
    try {
      // Get workflow and verify ownership
      const workflow = await this.workflowService.getWorkflow(
        workflowId,
        userId
      );
      const triggers = (workflow.triggers as any[]) || [];

      const triggerIndex = triggers.findIndex((t) => t.id === triggerId);
      if (triggerIndex === -1) {
        throw new AppError("Trigger not found", 404, "TRIGGER_NOT_FOUND");
      }

      // Deactivate trigger first
      await this.deactivateTrigger(triggerId);

      // Remove trigger from workflow
      triggers.splice(triggerIndex, 1);

      await this.prisma.workflow.update({
        where: { id: workflowId },
        data: {
          triggers: triggers,
          updatedAt: new Date(),
        },
      });


    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Error deleting trigger:", error);
      throw new AppError(
        "Failed to delete trigger",
        500,
        "TRIGGER_DELETE_ERROR"
      );
    }
  }

  async activateTrigger(
    workflowId: string,
    trigger: TriggerDefinition
  ): Promise<void> {
    try {
      // Ensure trigger has workflowId set
      trigger.workflowId = workflowId;

      switch (trigger.type) {
        case "webhook":
          await this.activateWebhookTrigger(trigger);
          break;
        case "schedule":
          await this.activateScheduleTrigger(trigger);
          break;
        case "manual":
          // Manual triggers don't need activation
          break;
        case "workflow-called":
          // Workflow-called triggers are passive - they don't need active listening
          // They are triggered when another workflow explicitly calls them

          break;
        default:
          throw new AppError(
            `Unknown trigger type: ${trigger.type}`,
            400,
            "INVALID_TRIGGER_TYPE"
          );
      }


    } catch (error) {
      logger.error(`Error activating trigger ${trigger.id}:`, error);
      throw error;
    }
  }

  async deactivateTrigger(triggerId: string): Promise<void> {
    try {
      // Remove from webhook triggers
      for (const [webhookKey, trigger] of this.webhookTriggers.entries()) {
        if (trigger.id === triggerId) {
          this.webhookTriggers.delete(webhookKey);
          logger.info(`🗑️  Deactivated webhook: ${webhookKey} (trigger ID: ${triggerId})`);
          break;
        }
      }

      // Remove from scheduled tasks
      if (this.scheduledTasks.has(triggerId)) {
        const task = this.scheduledTasks.get(triggerId);
        if (task) {
          task.stop();
        }
        this.scheduledTasks.delete(triggerId);
        logger.info(`🗑️  Deactivated scheduled task: ${triggerId}`);
      }


    } catch (error) {
      logger.error(`Error deactivating trigger ${triggerId}:`, error);
      throw error;
    }
  }

  private async activateWebhookTrigger(
    trigger: TriggerDefinition
  ): Promise<void> {
    // First, remove this trigger from any existing webhook keys
    // This ensures we remove old paths when the webhook path is changed
    for (const [webhookKey, existingTrigger] of this.webhookTriggers.entries()) {
      if (existingTrigger.id === trigger.id && existingTrigger.nodeId === trigger.nodeId) {
        this.webhookTriggers.delete(webhookKey);
        logger.info(`🔄 Removing trigger ${trigger.id} from old webhook key: ${webhookKey}`);
      }
    }
    
    // Clean the webhook URL and custom path
    const webhookUrlId = trigger.settings.webhookUrl?.trim() || "";
    const customPath = trigger.settings.webhookPath?.trim().replace(/^\/+|\/+$/g, "") || "";
    
    // Build webhook path: [uuid/]path
    let webhookPath = "";
    
    if (webhookUrlId && customPath) {
      // Both ID and path: uuid/path
      webhookPath = `${webhookUrlId}/${customPath}`;
    } else if (webhookUrlId) {
      // Only ID: uuid
      webhookPath = webhookUrlId;
    } else if (customPath) {
      // Only path (no UUID): path
      webhookPath = customPath;
    } else {
      // Neither - must have at least one, generate UUID as fallback
      trigger.settings.webhookUrl = uuidv4();
      webhookPath = trigger.settings.webhookUrl;
      logger.warn(`⚠️  No webhook ID or path provided, generated UUID: ${webhookPath}`);
    }
    
    // Store the webhook path
    trigger.settings.webhookId = webhookPath;
    
    // Register webhook (same URL for test and production, differentiated by ?test=true)
    this.webhookTriggers.set(webhookPath, trigger);
    logger.info(`✅ Activated webhook: ${webhookPath}`);


  }

  private async activateScheduleTrigger(
    trigger: TriggerDefinition
  ): Promise<void> {
    const { cronExpression, timezone } = trigger.settings;

    if (!cronExpression) {
      throw new AppError(
        "Cron expression is required for schedule triggers",
        400,
        "MISSING_CRON_EXPRESSION"
      );
    }

    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new AppError(
        "Invalid cron expression",
        400,
        "INVALID_CRON_EXPRESSION"
      );
    }

    // Create scheduled task
    const task = cron.schedule(
      cronExpression,
      async () => {
        try {
          await this.handleScheduleTrigger(trigger);
        } catch (error) {
          logger.error(
            `Error executing scheduled trigger ${trigger.id}:`,
            error
          );
        }
      },
      {
        scheduled: false,
        timezone: timezone || "UTC",
      }
    );

    // Store and start task
    this.scheduledTasks.set(trigger.id, task);
    task.start();


  }

  /**
   * Match a webhook path against registered patterns
   * Supports parameters like /users/:userId or /orders/:orderId/:itemId
   * Returns ALL matching triggers (allows multiple workflows to use same path)
   */
  private matchWebhookPath(requestPath: string): { 
    triggers: TriggerDefinition[]; 
    params: Record<string, string>;
  } | null {
    // Clean the request path (remove query string and leading/trailing slashes)
    const cleanPath = requestPath.split('?')[0].replace(/^\/+|\/+$/g, '');
    
    logger.info(`🔍 Matching webhook path: "${cleanPath}"`);
    
    const matchedTriggers: TriggerDefinition[] = [];
    let matchedParams: Record<string, string> = {};
    
    // Check all registered webhooks
    for (const [webhookKey, trigger] of this.webhookTriggers.entries()) {
      const webhookPath = trigger.settings.webhookId || "";
      
      // Try exact match first
      if (webhookPath === cleanPath) {
        logger.info(`✅ Exact match: "${cleanPath}" -> ${webhookKey}`);
        matchedTriggers.push(trigger);
        continue;
      }
      
      // Try pattern matching if path contains parameters
      if (webhookPath.includes(':')) {
        // Convert pattern to regex
        // e.g., "users/:userId" -> /^users\/([^\/]+)$/
        const paramNames: string[] = [];
        const regexPattern = webhookPath.replace(/:([^\/]+)/g, (_, paramName) => {
          paramNames.push(paramName);
          return '([^/]+)';
        });
        
        const regex = new RegExp(`^${regexPattern}$`);
        const match = cleanPath.match(regex);
        
        if (match) {
          // Extract parameters
          const params: Record<string, string> = {};
          paramNames.forEach((name, index) => {
            params[name] = match[index + 1];
          });
          
          logger.info(`✅ Pattern match: "${webhookPath}" -> ${webhookKey}`, params);
          matchedTriggers.push(trigger);
          matchedParams = params; // Use params from last match (they should all be the same)
        }
      }
    }
    
    if (matchedTriggers.length > 0) {
      logger.info(`✅ Found ${matchedTriggers.length} matching trigger(s) for path: "${cleanPath}"`);
      return { triggers: matchedTriggers, params: matchedParams };
    }
    
    logger.warn(`❌ No webhook match found for path: "${cleanPath}"`);
    return null;
  }

  async handleWebhookTrigger(
    webhookId: string,
    request: WebhookRequest,
    testMode: boolean = false
  ): Promise<{ 
    success: boolean; 
    executionId?: string; 
    error?: string;
    responseData?: any;
  }> {
    try {
      // Try to match the webhook path (supports parameters)
      const match = this.matchWebhookPath(webhookId);
      
      if (!match || match.triggers.length === 0) {
        throw new AppError(
          "Webhook trigger not found",
          404,
          "WEBHOOK_NOT_FOUND"
        );
      }
      
      // If multiple triggers match, execute the first one
      // TODO: In the future, we could execute all of them in parallel
      const trigger = match.triggers[0];
      const pathParams = match.params;
      
      if (match.triggers.length > 1) {
        logger.info(`⚠️  Multiple triggers (${match.triggers.length}) matched webhook path. Executing first one: ${trigger.workflowId}`);
      }

      // Validate HTTP method matches the configured method
      const configuredMethod = trigger.settings.httpMethod;
      if (configuredMethod && request.method !== configuredMethod) {
        logger.warn(`Webhook HTTP method mismatch`, {
          webhookId,
          expected: configuredMethod,
          received: request.method,
          ip: request.ip,
        });
        
        // Create error with allowed methods info for proper HTTP response
        const error = new AppError(
          `The ${request.method} method is not supported for this route. Supported methods: ${configuredMethod}.`,
          405,
          "METHOD_NOT_ALLOWED"
        );
        // Store allowed method for response header
        (error as any).allowedMethods = [configuredMethod];
        throw error;
      }

      // Validate authentication if configured
      // Handle multiple formats:
      // 1. New format: authentication is a credential ID (UUID or CUID string)
      // 2. Old format: authentication is a type string ("basic", "header", etc.)
      // 3. Legacy format: authentication is an object with type and settings
      let authConfig = trigger.settings.authentication;

      // If authentication is a credential ID (UUID or CUID format), fetch the credential
      // CUID format: starts with 'c' followed by alphanumeric characters (25 chars total)
      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const cuidRegex = /^c[a-z0-9]{24}$/i;

      const isCredentialId =
        typeof authConfig === "string" &&
        (uuidRegex.test(authConfig) || cuidRegex.test(authConfig));

      if (isCredentialId) {
        try {
          // Fetch credential using CredentialService (with decryption)
          const credential = await this.credentialService.getCredentialById(
            authConfig as string
          );

          if (credential) {
            // credentialData is already decrypted by CredentialService
            const credentialData = credential.data;

            switch (credential.type) {
              case "httpBasicAuth":
                authConfig = {
                  type: "basic",
                  settings: {
                    username: credentialData.username,
                    password: credentialData.password,
                  },
                };
                break;

              case "httpHeaderAuth":
                authConfig = {
                  type: "header",
                  settings: {
                    headerName: credentialData.name || "Authorization",
                    expectedValue: credentialData.value,
                  },
                };
                break;

              case "webhookQueryAuth":
                authConfig = {
                  type: "query",
                  settings: {
                    queryParam: credentialData.paramName || "token",
                    expectedValue: credentialData.value,
                  },
                };
                break;

              default:
                logger.warn(`Unsupported credential type: ${credential.type}`);
                authConfig = undefined;
            }
          } else {
            logger.warn(`Credential not found for webhook ${webhookId}`);
            authConfig = undefined;
          }
        } catch (error) {
          logger.error(
            `Error fetching credential for webhook ${webhookId}`,
            error
          );
          authConfig = undefined;
        }
      }
      // If authentication is a string (old format), convert to new format
      else if (typeof authConfig === "string" && authConfig !== "none") {
        authConfig = {
          type: authConfig,
          settings: {
            username: trigger.settings.username,
            password: trigger.settings.password,
            headerName: trigger.settings.headerName,
            expectedValue: trigger.settings.expectedValue,
            queryParam: trigger.settings.queryParam,
          },
        };
      }

      if (
        authConfig &&
        typeof authConfig === "object" &&
        authConfig.type !== "none"
      ) {
        const isAuthenticated = await this.validateWebhookAuthentication(
          authConfig,
          request
        );
        if (!isAuthenticated) {
          logger.warn(`Webhook authentication failed`, {
            webhookId,
            authType: authConfig.type,
            ip: request.ip,
          });
          throw new AppError(
            "Webhook authentication failed",
            401,
            "WEBHOOK_AUTH_FAILED"
          );
        }
      }

      // Fetch workflow to get the owner's userId and nodes for responseMode check
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: trigger.workflowId },
        select: { 
          userId: true,
          nodes: true,
          connections: true,
          settings: true,
        },
      });

      if (!workflow) {
        throw new AppError(
          "Workflow not found for webhook trigger",
          404,
          "WORKFLOW_NOT_FOUND"
        );
      }

      // Parse workflow nodes to get webhook trigger node settings
      const workflowNodes = typeof workflow.nodes === "string" 
        ? JSON.parse(workflow.nodes) 
        : workflow.nodes;
      
      const webhookTriggerNode = (workflowNodes as any[])?.find(
        (node: any) => node.id === trigger.nodeId
      );

      const responseMode = webhookTriggerNode?.parameters?.responseMode || "onReceived";
      const shouldWaitForCompletion = responseMode === "lastNode";

      // Check workflow settings for database storage
      const workflowSettings = typeof workflow.settings === "string"
        ? JSON.parse(workflow.settings)
        : workflow.settings;
      
      const saveToDatabase = workflowSettings?.saveExecutionToDatabase !== false; // Default to true

      // Create trigger execution request with webhook data (including path parameters)
      const triggerRequest: TriggerExecutionRequest = {
        triggerId: trigger.id,
        triggerType: "webhook",
        workflowId: trigger.workflowId,
        userId: workflow.userId, // Use workflow owner's userId for credential access
        triggerNodeId: trigger.nodeId,
        triggerData: {
          method: request.method,
          headers: request.headers,
          query: request.query,
          body: request.body,
          params: pathParams, // Add extracted path parameters
          ip: request.ip,
          userAgent: request.userAgent,
        },
        options: {
          isolatedExecution: true, // Webhooks should run in isolation
          priority: 2, // Medium priority for webhooks
          triggerTimeout: 30000, // 30 second timeout for webhooks
          saveToDatabase, // Pass workflow setting
        },
      };

      // Create trigger event for logging
      const triggerEvent: TriggerEvent = {
        id: uuidv4(),
        triggerId: trigger.id,
        workflowId: trigger.workflowId,
        type: "webhook",
        data: triggerRequest.triggerData,
        timestamp: new Date(),
        status: "pending",
      };

      // Log trigger event
      await this.logTriggerEvent(triggerEvent);

      // Execute using TriggerManager
      // If responseMode is "lastNode", wait for completion to get result directly
      // Otherwise, use fire-and-forget execution
      const result = shouldWaitForCompletion
        ? await this.triggerManager.executeTriggerAndWait(triggerRequest, 30000)
        : await this.triggerManager.executeTrigger(triggerRequest);

      if (!result.success) {
        triggerEvent.status = "failed";
        triggerEvent.error = result.reason;
        await this.updateTriggerEvent(triggerEvent);

        return {
          success: false,
          error: result.reason || "Execution failed",
        };
      }

      // Update trigger event with execution ID
      triggerEvent.executionId = result.executionId;
      triggerEvent.status =
        (result as any).status === "started" ? "processing" : "pending";
      await this.updateTriggerEvent(triggerEvent);

      // Emit real-time update to workflow room
      this.socketService.getServer()
        .to(`workflow:${trigger.workflowId}`)
        .emit("trigger-executed", {
          triggerId: trigger.id,
          executionId: result.executionId,
          type: "webhook",
          status: (result as any).status || "started",
          testMode,
          timestamp: new Date().toISOString(),
        });

      // If in test mode, also emit a webhook-test event for frontend to subscribe to execution
      if (testMode) {
        const eventData = {
          webhookId,
          executionId: result.executionId,
          workflowId: trigger.workflowId,
          triggerNodeId: trigger.nodeId,
          timestamp: new Date().toISOString(),
        };
        
        console.log(`🧪🧪🧪 TEST MODE DETECTED - Emitting webhook-test-triggered to workflow:${trigger.workflowId}`);
        console.log(`🧪🧪🧪 Event data:`, JSON.stringify(eventData, null, 2));
        
        // Debug: Log all workflow rooms
        this.socketService.logWorkflowRooms();
        
        // Check how many clients are in the workflow room
        const room = this.socketService.getServer().sockets.adapter.rooms.get(`workflow:${trigger.workflowId}`);
        const clientCount = room ? room.size : 0;
        console.log(`🧪🧪🧪 Clients in workflow:${trigger.workflowId} room: ${clientCount}`);
        
        if (clientCount === 0) {
          console.log(`⚠️  WARNING: No clients subscribed to workflow:${trigger.workflowId}!`);
          console.log(`⚠️  The frontend might not be subscribed to the workflow room.`);
          console.log(`⚠️  This usually means the socket disconnected or never joined the room.`);
        }
        
        logger.info(`🧪 Emitting webhook-test-triggered to workflow:${trigger.workflowId}`, eventData);
        
        this.socketService.getServer()
          .to(`workflow:${trigger.workflowId}`)
          .emit("webhook-test-triggered", eventData);
        
        console.log(`🧪🧪🧪 Event emitted successfully to ${clientCount} client(s)`);
        
        logger.info(`🧪 Webhook test mode - execution visible in editor`, {
          webhookId,
          executionId: result.executionId,
          workflowId: trigger.workflowId,
        });
      } else {
        console.log(`ℹ️  Test mode NOT detected (testMode = ${testMode})`);
      }

      // If responseMode is "lastNode", extract response data from execution result
      let responseData = null;
      if (shouldWaitForCompletion && result.executionId) {
        try {
          console.log(`✅ Execution completed (responseMode: lastNode)`, {
            executionId: result.executionId,
            webhookId,
            hasResult: !!(result as any).result,
          });

          // Extract response data from the execution result
          if ((result as any).result) {
            responseData = await this.extractResponseDataFromResult((result as any).result);
            
            console.log(`✅ Response data extracted from result`, {
              executionId: result.executionId,
              hasResponseData: !!responseData,
              responseDataKeys: responseData ? Object.keys(responseData) : [],
            });
          }
          
          logger.info(`Execution completed, response data extracted`, {
            executionId: result.executionId,
            hasResponseData: !!responseData,
          });
        } catch (error) {
          console.error(`❌ Error waiting for execution completion`, {
            executionId: result.executionId,
            error: error instanceof Error ? error.message : error,
          });
          logger.error(`Error waiting for execution completion`, {
            executionId: result.executionId,
            error: error instanceof Error ? error.message : error,
          });
          // Continue with standard response if waiting fails
        }
      } else {
        console.log(`ℹ️  Not waiting for completion:`, {
          shouldWaitForCompletion,
          hasExecutionId: !!result.executionId,
        });
      }

      return {
        success: true,
        executionId: result.executionId,
        responseData,
      };
    } catch (error) {
      logger.error(`Error handling webhook trigger ${webhookId}:`, error);
      return {
        success: false,
        error:
          error instanceof AppError ? error.message : "Internal server error",
      };
    }
  }

  private async handleScheduleTrigger(
    trigger: TriggerDefinition
  ): Promise<void> {
    try {
      // Fetch workflow to get settings
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: trigger.workflowId },
        select: { settings: true },
      });

      // Check workflow settings for database storage
      const workflowSettings = workflow?.settings
        ? typeof workflow.settings === "string"
          ? JSON.parse(workflow.settings)
          : workflow.settings
        : {};
      
      const saveToDatabase = workflowSettings?.saveExecutionToDatabase !== false; // Default to true

      // Create trigger execution request for scheduled execution
      const triggerRequest: TriggerExecutionRequest = {
        triggerId: trigger.id,
        triggerType: "schedule",
        workflowId: trigger.workflowId,
        userId: "system", // System user for scheduled triggers
        triggerNodeId: trigger.nodeId,
        triggerData: {
          scheduledAt: new Date(),
          cronExpression: trigger.settings.cronExpression,
          timezone: trigger.settings.timezone,
        },
        options: {
          isolatedExecution: false, // Schedules can share resources
          priority: 3, // Lower priority for scheduled triggers
          triggerTimeout: 300000, // 5 minute timeout for scheduled triggers
          saveToDatabase, // Pass workflow setting
        },
      };

      // Create trigger event for logging
      const triggerEvent: TriggerEvent = {
        id: uuidv4(),
        triggerId: trigger.id,
        workflowId: trigger.workflowId,
        type: "schedule",
        data: triggerRequest.triggerData,
        timestamp: new Date(),
        status: "pending",
      };

      // Log trigger event
      await this.logTriggerEvent(triggerEvent);

      // Execute using TriggerManager for concurrent execution support
      const result = await this.triggerManager.executeTrigger(triggerRequest);

      if (!result.success) {
        triggerEvent.status = "failed";
        triggerEvent.error = result.reason;
        await this.updateTriggerEvent(triggerEvent);

        logger.error(
          `Schedule trigger ${trigger.id} execution failed: ${result.reason}`
        );
        return;
      }

      // Update trigger event
      triggerEvent.executionId = result.executionId;
      triggerEvent.status =
        result.status === "started" ? "processing" : "pending";
      await this.updateTriggerEvent(triggerEvent);

      // Emit real-time update
      this.socketService.emitToUser(trigger.workflowId, "trigger-executed", {
        triggerId: trigger.id,
        executionId: result.executionId,
        type: "schedule",
        status: result.status,
      });


    } catch (error) {
      logger.error(`Error handling schedule trigger ${trigger.id}:`, error);
    }
  }

  async handleManualTrigger(
    workflowId: string,
    triggerId: string,
    userId: string,
    data?: any
  ): Promise<{ success: boolean; executionId?: string; error?: string }> {
    try {
      // Verify workflow and trigger
      const workflow = await this.workflowService.getWorkflow(
        workflowId,
        userId
      );
      const triggers = (workflow.triggers as any[]) || [];
      const trigger = triggers.find(
        (t) =>
          t.id === triggerId && ["manual", "workflow-called"].includes(t.type)
      );

      if (!trigger) {
        throw new AppError(
          "Manual trigger not found",
          404,
          "MANUAL_TRIGGER_NOT_FOUND"
        );
      }

      if (!trigger.active) {
        throw new AppError("Trigger is not active", 400, "TRIGGER_NOT_ACTIVE");
      }

      // Check workflow settings for database storage
      const workflowSettings = typeof workflow.settings === "string"
        ? JSON.parse(workflow.settings)
        : workflow.settings;
      
      const saveToDatabase = workflowSettings?.saveExecutionToDatabase !== false; // Default to true

      // Create trigger execution request for manual execution
      const triggerRequest: TriggerExecutionRequest = {
        triggerId: trigger.id,
        triggerType: "manual",
        workflowId: trigger.workflowId,
        userId: userId,
        triggerNodeId: trigger.nodeId,
        triggerData: data || {},
        options: {
          isolatedExecution: true, // Manual triggers should run in isolation
          priority: 1, // Highest priority for manual triggers
          triggerTimeout: 600000, // 10 minute timeout for manual triggers
          saveToDatabase, // Pass workflow setting
        },
      };

      // Create trigger event for logging
      const triggerEvent: TriggerEvent = {
        id: uuidv4(),
        triggerId: trigger.id,
        workflowId: trigger.workflowId,
        type: "manual",
        data: triggerRequest.triggerData,
        timestamp: new Date(),
        status: "pending",
      };

      // Log trigger event
      await this.logTriggerEvent(triggerEvent);

      // Execute using TriggerManager for concurrent execution support
      const result = await this.triggerManager.executeTrigger(triggerRequest);

      if (!result.success) {
        triggerEvent.status = "failed";
        triggerEvent.error = result.reason;
        await this.updateTriggerEvent(triggerEvent);

        return {
          success: false,
          error: result.reason || "Execution failed",
        };
      }

      // Update trigger event
      triggerEvent.executionId = result.executionId;
      triggerEvent.status =
        result.status === "started" ? "processing" : "pending";
      await this.updateTriggerEvent(triggerEvent);

      // Emit real-time update
      this.socketService.emitToUser(userId, "trigger-executed", {
        triggerId: trigger.id,
        executionId: result.executionId,
        type: "manual",
        status: result.status,
      });

      return {
        success: true,
        executionId: result.executionId,
      };
    } catch (error) {
      if (error instanceof AppError) {
        return { success: false, error: error.message };
      }
      logger.error(`Error handling manual trigger:`, error);
      return { success: false, error: "Internal server error" };
    }
  }

  private validateTriggerSettings(
    type: string,
    settings: TriggerSettings
  ): void {
    switch (type) {
      case "webhook":
        if (!settings.httpMethod) {
          throw new AppError(
            "HTTP method is required for webhook triggers",
            400,
            "MISSING_HTTP_METHOD"
          );
        }
        break;
      case "schedule":
        if (!settings.cronExpression) {
          throw new AppError(
            "Cron expression is required for schedule triggers",
            400,
            "MISSING_CRON_EXPRESSION"
          );
        }
        if (!cron.validate(settings.cronExpression)) {
          throw new AppError(
            "Invalid cron expression",
            400,
            "INVALID_CRON_EXPRESSION"
          );
        }
        break;
      case "manual":
        // No specific validation needed for manual triggers
        break;
      default:
        throw new AppError(
          `Unknown trigger type: ${type}`,
          400,
          "INVALID_TRIGGER_TYPE"
        );
    }
  }

  private async validateWebhookAuthentication(
    auth: any,
    request: WebhookRequest
  ): Promise<boolean> {
    switch (auth.type) {
      case "basic":
        // Validate Basic Authentication (username:password)
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Basic ")) {
          return false;
        }

        try {
          // Extract base64 encoded credentials
          const base64Credentials = authHeader.substring(6); // Remove "Basic " prefix
          const credentials = Buffer.from(base64Credentials, "base64").toString(
            "utf-8"
          );
          const [username, password] = credentials.split(":");

          // Get expected credentials from trigger settings
          const expectedUsername = auth.settings?.username;
          const expectedPassword = auth.settings?.password;

          if (!expectedUsername || !expectedPassword) {
            return false;
          }

          // Validate credentials
          return username === expectedUsername && password === expectedPassword;
        } catch (error) {
          logger.error("Basic auth failed: Error decoding credentials", error);
          return false;
        }

      case "header":
        // Validate custom header authentication
        const headerName = auth.settings?.headerName;
        const expectedValue = auth.settings?.expectedValue;

        if (!headerName || !expectedValue) {
          return false;
        }

        const headerValue = request.headers[headerName.toLowerCase()];
        return headerValue === expectedValue;

      case "query":
        // Validate query parameter authentication
        const queryParam = auth.settings?.queryParam;
        const expectedQueryValue = auth.settings?.expectedValue;

        if (!queryParam || !expectedQueryValue) {
          return false;
        }

        const queryValue = request.query[queryParam];
        return queryValue === expectedQueryValue;

      case "none":
        // No authentication required
        return true;

      default:
        logger.warn(`Unknown authentication type: ${auth.type}`);
        return true; // Default to allowing if unknown type
    }
  }

  private async logTriggerEvent(event: TriggerEvent): Promise<void> {
    // For now, just log to console. In a real implementation,
    // you might want to store this in a separate table or logging system

  }

  private async updateTriggerEvent(event: TriggerEvent): Promise<void> {
    // Update trigger event status

  }

  async getTriggerEvents(
    workflowId: string,
    userId: string,
    filters?: {
      type?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<TriggerEvent[]> {
    // This would typically query a trigger_events table
    // For now, return empty array as we're not storing events in DB yet
    return [];
  }

  async getTriggerStats(
    workflowId: string,
    userId: string
  ): Promise<{
    totalTriggers: number;
    activeTriggers: number;
    triggersByType: Record<string, number>;
    recentEvents: number;
  }> {
    try {
      const workflow = await this.workflowService.getWorkflow(
        workflowId,
        userId
      );
      const triggers = (workflow.triggers as any[]) || [];

      const stats = {
        totalTriggers: triggers.length,
        activeTriggers: triggers.filter((t) => t.active).length,
        triggersByType: triggers.reduce((acc, trigger) => {
          acc[trigger.type] = (acc[trigger.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        recentEvents: 0, // Would be calculated from trigger events table
      };

      return stats;
    } catch (error) {
      logger.error("Error getting trigger stats:", error);
      throw new AppError(
        "Failed to get trigger statistics",
        500,
        "TRIGGER_STATS_ERROR"
      );
    }
  }

  /**
   * Get active trigger executions from TriggerManager
   */
  getActiveTriggerExecutions() {
    return this.triggerManager.getActiveTriggers();
  }

  /**
   * Get queued trigger executions from TriggerManager
   */
  getQueuedTriggerExecutions() {
    return this.triggerManager.getQueuedTriggers();
  }

  /**
   * Cancel a trigger execution
   */
  async cancelTriggerExecution(executionId: string): Promise<boolean> {
    return await this.triggerManager.cancelTrigger(executionId);
  }

  /**
   * Get trigger execution statistics
   */
  getTriggerExecutionStats() {
    return this.triggerManager.getTriggerStats();
  }

  /**
   * Update trigger manager configuration
   */
  updateTriggerManagerConfig(config: any): void {
    this.triggerManager.updateConfig(config);
  }

  // Cleanup method to be called on service shutdown
  async cleanup(): Promise<void> {
    logger.info("Cleaning up TriggerService...");

    // Shutdown TriggerManager first
    await this.triggerManager.shutdown();

    // Stop all scheduled tasks
    for (const [triggerId, task] of this.scheduledTasks) {
      try {
        task.stop();
      } catch (error) {
        logger.error(`Error stopping scheduled task ${triggerId}:`, error);
      }
    }

    this.scheduledTasks.clear();
    this.webhookTriggers.clear();

    logger.info("TriggerService cleanup completed");
  }

  /**
   * Get all registered webhooks for debugging
   */
  getRegisteredWebhooks(): Array<{
    webhookId: string | undefined;
    workflowId: string;
    nodeId: string;
    settings: any;
  }> {
    return Array.from(this.webhookTriggers.values()).map((trigger) => ({
      webhookId: trigger.settings.webhookId,
      workflowId: trigger.workflowId,
      nodeId: trigger.nodeId,
      settings: trigger.settings,
    }));
  }

  /**
   * Sync triggers for a specific workflow
   * This should be called after workflow is saved/updated to register new triggers
   */
  async syncWorkflowTriggers(workflowId: string): Promise<void> {
    try {
      logger.info(`Syncing triggers for workflow ${workflowId}`);

      // Get workflow with triggers
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        select: {
          id: true,
          active: true,
          triggers: true,
        },
      });

      if (!workflow) {
        logger.warn(`Workflow ${workflowId} not found for trigger sync`);
        return;
      }

      const triggers = workflow.triggers as any[];

      // Deactivate existing triggers for this workflow
      const existingTriggers = [
        ...Array.from(this.webhookTriggers.values()),
        ...Array.from(this.scheduledTasks.keys()).map((id) => ({ id })),
      ].filter((t) => (t as any).workflowId === workflowId);

      for (const trigger of existingTriggers) {
        await this.deactivateTrigger(trigger.id);
      }

      // Activate new triggers if workflow is active
      if (workflow.active && triggers && triggers.length > 0) {
        for (const trigger of triggers) {
          if (trigger.active) {
            await this.activateTrigger(workflowId, trigger);
          }
        }
      }

      logger.info(
        `Successfully synced ${
          triggers?.length || 0
        } triggers for workflow ${workflowId}`
      );
    } catch (error) {
      logger.error(`Error syncing triggers for workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Wait for execution to complete and extract response data
   * Used for webhook responseMode: "lastNode"
   */
  private async waitForExecutionCompletion(
    executionId: string,
    timeout: number = 30000
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const startTime = Date.now();
      const pollInterval = 500; // Poll every 500ms
      const initialDelay = 100; // Wait 100ms before first poll to allow execution record to be created

      const checkExecution = async () => {
        try {
          // Check if timeout exceeded
          if (Date.now() - startTime > timeout) {
            reject(new Error("Execution timeout"));
            return;
          }

          // Fetch execution from database
          const execution = await this.prisma.execution.findUnique({
            where: { id: executionId },
          });

          if (!execution) {
            // Don't reject immediately - execution might not be created yet
            // Continue polling until timeout
            console.log(`⏳ Execution record not found yet, continuing to poll...`);
            setTimeout(checkExecution, pollInterval);
            return;
          }

          // Check if execution is complete
          if (execution.status === "SUCCESS" || execution.status === "ERROR" || execution.status === "CANCELLED" || execution.status === "TIMEOUT") {
            // Extract response data from execution
            const responseData = this.extractResponseData(execution);
            resolve(responseData);
            return;
          }

          // Continue polling
          setTimeout(checkExecution, pollInterval);
        } catch (error) {
          reject(error);
        }
      };

      // Start polling after initial delay to allow execution record to be created
      setTimeout(checkExecution, initialDelay);
    });
  }

  /**
   * Extract HTTP Response node data from ExecutionResult (without database query)
   */
  private async extractResponseDataFromResult(executionResult: ExecutionResult): Promise<any> {
    try {
      console.log(`🔍 DEBUG extractResponseDataFromResult - Execution result:`, {
        success: executionResult.success,
        hasData: !!executionResult.data,
        hasExecutionData: !!(executionResult.data as any)?.executionData,
      });
      
      // Get execution data from result
      const executionData = (executionResult.data as any)?.executionData;
      if (!executionData || !executionData.nodeResults) {
        console.log(`⚠️  No execution data in result`);
        return null;
      }
      
      const nodeResults = executionData.nodeResults;
      console.log(`🔍 Found ${Object.keys(nodeResults).length} node results`);
      
      // Iterate through node results to find HTTP Response node
      for (const [nodeId, nodeResult] of Object.entries(nodeResults)) {
        const result = nodeResult as any;
        
        if (!result.data || !result.data.main) {
          continue;
        }
        
        // Check main output
        const mainOutput = result.data.main;
        if (Array.isArray(mainOutput) && mainOutput.length > 0) {
          const firstOutput = mainOutput[0];
          
          if (firstOutput && firstOutput.json) {
            const output = firstOutput.json;
            
            console.log(`🔍 Node ${nodeId} output:`, {
              hasHttpResponseFlag: output._httpResponse === true,
              outputKeys: Object.keys(output),
            });
            
            // Check if this is an HTTP Response node output
            if (output._httpResponse === true) {
              console.log(`✅ Found HTTP Response node output in result`, {
                nodeId,
                statusCode: output.statusCode,
              });
              
              return {
                statusCode: output.statusCode || 200,
                headers: output.headers || {},
                body: output.body,
                cookies: output.cookies || [],
              };
            }
          }
        }
      }
      
      // If no HTTP Response node found, return the last node's output
      const nodeIds = Object.keys(nodeResults);
      if (nodeIds.length > 0) {
        const lastNodeId = nodeIds[nodeIds.length - 1];
        const lastResult = nodeResults[lastNodeId] as any;
        
        if (lastResult.data && lastResult.data.main && Array.isArray(lastResult.data.main) && lastResult.data.main.length > 0) {
          const lastOutput = lastResult.data.main[0];
          
          if (lastOutput && lastOutput.json) {
            console.log(`ℹ️  No HTTP Response node found, returning last node output`, { nodeId: lastNodeId });
            return {
              statusCode: 200,
              headers: { "Content-Type": "application/json" },
              body: lastOutput.json,
              cookies: [],
            };
          }
        }
      }
      
      console.log(`⚠️  No suitable response data found in execution result`);
      return null;
    } catch (error) {
      logger.error("Failed to extract response data from result:", error);
      return null;
    }
  }

  /**
   * Extract HTTP Response node data from execution result (database query)
   */
  private async extractResponseData(execution: any): Promise<any> {
    try {
      console.log(`🔍 DEBUG extractResponseData - Execution status:`, execution.status);
      
      // Fetch node executions for this execution
      const nodeExecutions = await this.prisma.nodeExecution.findMany({
        where: { executionId: execution.id },
        select: {
          nodeId: true,
          outputData: true,
          status: true,
        },
      });

      if (!nodeExecutions || nodeExecutions.length === 0) {
        console.log(`⚠️  DEBUG extractResponseData - No node executions found`);
        return null;
      }

      console.log(`🔍 DEBUG extractResponseData - Found ${nodeExecutions.length} node executions`);
      
      // Iterate through node executions to find one with _httpResponse flag
      for (const nodeExecution of nodeExecutions) {
        if (!nodeExecution.outputData) {
          continue;
        }

        // Parse outputData
        let outputData = nodeExecution.outputData;
        if (typeof outputData === "string") {
          outputData = JSON.parse(outputData);
        }

        // Check if this node has main output data
        const outputDataObj = outputData as any;
        if (outputDataObj.main && Array.isArray(outputDataObj.main) && outputDataObj.main.length > 0) {
          const mainOutput = outputDataObj.main[0];
          
          if (mainOutput && mainOutput.json) {
            const output = mainOutput.json as any;
            
            console.log(`🔍 DEBUG extractResponseData - Node ${nodeExecution.nodeId} output:`, {
              hasHttpResponseFlag: output._httpResponse === true,
              outputKeys: Object.keys(output),
            });
            
            // Check if this is an HTTP Response node output
            if (output._httpResponse === true) {
              console.log(`✅ Found HTTP Response node output`, {
                nodeId: nodeExecution.nodeId,
                statusCode: output.statusCode,
              });
              logger.info("Found HTTP Response node output", {
                nodeId: nodeExecution.nodeId,
                statusCode: output.statusCode,
              });
              
              return {
                statusCode: output.statusCode || 200,
                headers: output.headers || {},
                body: output.body,
                cookies: output.cookies || [],
              };
            }
          }
        }
      }

      // If no HTTP Response node found, return the last node's output
      if (nodeExecutions.length > 0) {
        const lastNodeExecution = nodeExecutions[nodeExecutions.length - 1];
        
        if (lastNodeExecution.outputData) {
          let lastOutputData = lastNodeExecution.outputData;
          if (typeof lastOutputData === "string") {
            lastOutputData = JSON.parse(lastOutputData);
          }
          
          const lastOutputDataObj = lastOutputData as any;
          if (lastOutputDataObj.main && Array.isArray(lastOutputDataObj.main) && lastOutputDataObj.main.length > 0) {
            const lastMainOutput = lastOutputDataObj.main[0];
            
            if (lastMainOutput && lastMainOutput.json) {
              return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: lastMainOutput.json,
                cookies: [],
              };
            }
          }
        }
      }

      console.log(`⚠️  DEBUG extractResponseData - No HTTP Response node found`);
      return null;
    } catch (error) {
      logger.error("Error extracting response data", { error });
      return null;
    }
  }
}
