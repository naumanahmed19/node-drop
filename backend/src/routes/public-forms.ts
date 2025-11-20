import { PrismaClient } from "@prisma/client";
import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  rateLimitConfig,
  shouldSkipRateLimit,
} from "../rate-limit/rate-limit.config";
import { CredentialService } from "../services/CredentialService";
import ExecutionHistoryService from "../services/ExecutionHistoryService";
import { ExecutionService } from "../services/ExecutionService";
import { SocketService } from "../services/SocketService";
import { WebhookRequestLogService } from "../services/WebhookRequestLogService";
import { WorkflowService } from "../services/WorkflowService";
import {
  getTriggerService,
  initializeTriggerService,
} from "../services/triggerServiceSingleton";
import {
  getWebhookOptions,
  validateWebhookRequest,
  applyCorsHeaders,
  shouldLogRequest,
} from "../utils/webhookValidation";

const router = Router();

// Apply dynamic CORS based on form node settings
// For now, allow all origins by default (will be validated per-node in handlers)
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Rate limiter for form fetching (GET requests)
// Allow more frequent reads since they're less expensive
const formFetchLimiter = rateLimit({
  windowMs: rateLimitConfig.publicFormFetch.windowMs,
  max: rateLimitConfig.publicFormFetch.max,
  message: {
    success: false,
    error: rateLimitConfig.publicFormFetch.message,
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => shouldSkipRateLimit(req.ip),
});

// Rate limiter for form submission (POST requests)
// More restrictive to prevent spam and abuse
const formSubmitLimiter = rateLimit({
  windowMs: rateLimitConfig.publicFormSubmit.windowMs,
  max: rateLimitConfig.publicFormSubmit.max,
  message: {
    success: false,
    error: rateLimitConfig.publicFormSubmit.message,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkipRateLimit(req.ip),
  // Custom handler for when limit is exceeded
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error:
        "Too many form submissions from this IP, please try again after 15 minutes",
      retryAfter: Math.ceil(rateLimitConfig.publicFormSubmit.windowMs / 1000), // seconds
    });
  },
});
const prisma = new PrismaClient();
const webhookLogService = new WebhookRequestLogService(prisma);

/**
 * Helper to conditionally log form requests based on saveRequestLogs option
 */
async function logFormRequestIfEnabled(
  logData: any,
  formNode?: any
): Promise<void> {
  if (!formNode) return;
  
  const options = getWebhookOptions(formNode.parameters);
  
  if (shouldLogRequest(options)) {
    await webhookLogService.logRequest(logData)
      .catch(err => console.error('Failed to log form request:', err));
  } else {
    console.debug('Form request logging disabled for this form');
  }
}

// Use lazy initialization to get services when needed
const getNodeService = () => {
  if (!global.nodeService) {
    throw new Error(
      "NodeService not initialized. Make sure the server is properly started."
    );
  }
  return global.nodeService;
};

// Initialize non-dependent services
const workflowService = new WorkflowService(prisma);
const executionHistoryService = new ExecutionHistoryService(prisma);
const credentialService = new CredentialService();
const httpServer = createServer();
const socketService = new SocketService(httpServer);

// Lazy initialization for services that depend on NodeService
let executionService: ExecutionService;

const getExecutionService = () => {
  if (!executionService) {
    executionService = new ExecutionService(
      prisma,
      getNodeService(),
      executionHistoryService
    );
  }
  return executionService;
};

// Initialize TriggerService singleton on first access
let triggerServiceInitialized = false;
const ensureTriggerServiceInitialized = async () => {
  if (!triggerServiceInitialized) {
    await initializeTriggerService(
      prisma,
      workflowService,
      getExecutionService(),
      socketService,
      getNodeService(),
      executionHistoryService,
      credentialService
    );
    triggerServiceInitialized = true;
  }
  return getTriggerService();
};

/**
 * GET /api/public/forms/:formId
 * Fetch form configuration for public display
 * No authentication required
 * Rate limited: 30 requests per minute per IP
 */
router.get(
  "/:formId",
  formFetchLimiter, // Apply rate limiting
  asyncHandler(async (req: Request, res: Response) => {
    const { formId } = req.params;
    const startTime = Date.now();
    const testMode = req.query.test === 'true';

    try {
      // Find workflow with form generator node that has this formId
      const workflows = await prisma.workflow.findMany({
        where: {
          active: true,
        },
        select: {
          id: true,
          name: true,
          userId: true,
          nodes: true,
          active: true,
        },
      });

      let formConfig = null;
      let workflowId = null;
      let workflowName = null;
      let foundFormNode = null;

      // Search through workflows for matching formId
      for (const workflow of workflows) {
        const workflowNodes =
          typeof workflow.nodes === "string"
            ? JSON.parse(workflow.nodes)
            : workflow.nodes;

        // Find forms node with matching formId
        const formNode = (workflowNodes as any[])?.find((node: any) => {
          const isFormGenerator = node.type === "forms" || node.identifier === "forms";
          const hasFormUrl = node.parameters?.formUrl;
          
          // Normalize both values by removing leading slashes for comparison
          const normalizedFormUrl = hasFormUrl?.replace(/^\/+/, '');
          const normalizedFormId = formId?.replace(/^\/+/, '');
          const matches = normalizedFormUrl === normalizedFormId;

          return isFormGenerator && matches;
        });

        if (formNode) {
          const params = formNode.parameters || {};
          
          // Validate request based on form options
          const options = getWebhookOptions(params);
          const validation = validateWebhookRequest(req, options);
          
          if (!validation.allowed) {
            // Log rejected request
            await webhookLogService.logRequest({
              type: 'form',
              webhookId: formId,
              workflowId: workflow.id,
              userId: workflow.userId,
              method: req.method,
              path: req.path,
              headers: req.headers as Record<string, string>,
              body: req.body,
              query: req.query as Record<string, any>,
              ip: req.ip || req.connection.remoteAddress || 'unknown',
              userAgent: req.get('User-Agent'),
              status: 'rejected',
              reason: validation.reason,
              responseCode: 403,
              responseTime: Date.now() - startTime,
              testMode,
            }).catch(err => console.error('Failed to log form request:', err));
            
            return res.status(403).json({
              success: false,
              error: validation.reason || 'Access denied',
            });
          }

          // Process form fields
          const processFormFields = (fields: any[]) => {
            if (!Array.isArray(fields)) return [];
            const usedNames = new Set<string>();

            return fields.map((field: any, index: number) => {
              const fieldData = field.values || field;

              // Generate unique name
              let fieldName =
                fieldData.name ||
                fieldData.displayName?.toLowerCase().replace(/\s+/g, "_") ||
                `field_${index}`;

              // Ensure uniqueness
              let uniqueName = fieldName;
              let counter = 1;
              while (usedNames.has(uniqueName)) {
                uniqueName = `${fieldName}_${counter}`;
                counter++;
              }
              usedNames.add(uniqueName);

              return {
                name: uniqueName,
                displayName: fieldData.displayName || "",
                type: fieldData.type || "string",
                required: fieldData.required || false,
                default: fieldData.default || "",
                description: fieldData.description || "",
                placeholder: fieldData.placeholder || "",
                options: fieldData.options || [],
                rows: fieldData.rows,
                validation: fieldData.validation,
              };
            });
          };

          formConfig = {
            formTitle: params.formTitle || "Form",
            formDescription: params.formDescription || "",
            formFields: processFormFields(params.formFields || []),
            submitButtonText: params.submitButtonText || "Submit",
            formProtection: params.formProtection || "none",
            formPassword: params.formPassword || null,
            accessKey: params.accessKey || null,
            workflowName: workflow.name,
            isActive: workflow.active,
          };

          workflowId = workflow.id;
          workflowName = workflow.name;
          foundFormNode = formNode;
          break;
        }
      }

      if (!formConfig) {
        // Always log "not found" errors regardless of settings
        await webhookLogService.logRequest({
          type: 'form',
          webhookId: formId,
          workflowId: 'unknown',
          userId: 'unknown',
          method: req.method,
          path: req.path,
          headers: req.headers as Record<string, string>,
          body: req.body,
          query: req.query as Record<string, any>,
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent'),
          status: 'rejected',
          reason: 'Form not found or is not active',
          responseCode: 404,
          responseTime: Date.now() - startTime,
          testMode,
        }).catch(err => console.error('Failed to log form request:', err));
        
        return res.status(404).json({
          success: false,
          error: "Form not found or is not active",
        });
      }

      // Check if form has password protection
      const formProtection = (formConfig as any).formProtection || "none";
      const requiresPassword = formProtection === "password";

      // If password protected, check for password in query or header
      if (requiresPassword) {
        const providedPassword =
          req.query.password || req.headers["x-form-password"];
        const correctPassword = (formConfig as any).formPassword;

        if (!providedPassword) {
          // Log password required if logging is enabled
          await logFormRequestIfEnabled({
            type: 'form',
            webhookId: formId,
            workflowId: workflowId!,
            userId: 'unknown',
            method: req.method,
            path: req.path,
            headers: req.headers as Record<string, string>,
            body: req.body,
            query: req.query as Record<string, any>,
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent'),
            status: 'rejected',
            reason: 'Password required',
            responseCode: 401,
            responseTime: Date.now() - startTime,
            testMode,
          }, foundFormNode);
          
          return res.status(401).json({
            success: false,
            error: "Password required",
            requiresPassword: true,
          });
        }

        if (providedPassword !== correctPassword) {
          // Log invalid password if logging is enabled
          await logFormRequestIfEnabled({
            type: 'form',
            webhookId: formId,
            workflowId: workflowId!,
            userId: 'unknown',
            method: req.method,
            path: req.path,
            headers: req.headers as Record<string, string>,
            body: req.body,
            query: req.query as Record<string, any>,
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent'),
            status: 'rejected',
            reason: 'Invalid password',
            responseCode: 403,
            responseTime: Date.now() - startTime,
            testMode,
          }, foundFormNode);
          
          return res.status(403).json({
            success: false,
            error: "Invalid password",
            requiresPassword: true,
          });
        }
      }

      // Remove sensitive data before sending to client
      const safeFormConfig = { ...formConfig };
      delete (safeFormConfig as any).formPassword;
      delete (safeFormConfig as any).accessKey;

      // Log successful form fetch if logging is enabled
      await logFormRequestIfEnabled({
        type: 'form',
        webhookId: formId,
        workflowId: workflowId!,
        userId: 'unknown', // Public form, no user
        method: req.method,
        path: req.path,
        headers: req.headers as Record<string, string>,
        body: req.body,
        query: req.query as Record<string, any>,
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent'),
        status: 'success',
        responseCode: 200,
        responseTime: Date.now() - startTime,
        testMode,
      }, foundFormNode);

      res.json({
        success: true,
        form: safeFormConfig,
        formId,
        workflowId,
        requiresPassword,
        requiresAccessKey: formProtection === "accessKey",
      });
    } catch (error: any) {
      // Log failed form fetch (no formNode available in catch)
      await webhookLogService.logRequest({
        type: 'form',
        webhookId: formId,
        workflowId: 'unknown',
        userId: 'unknown',
        method: req.method,
        path: req.path,
        headers: req.headers as Record<string, string>,
        body: req.body,
        query: req.query as Record<string, any>,
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent'),
        status: 'failed',
        reason: error.message,
        responseCode: 500,
        responseTime: Date.now() - startTime,
        testMode: req.query.test === 'true',
      }).catch(err => console.error('Failed to log form request:', err));
      
      res.status(500).json({
        success: false,
        error: "Failed to fetch form configuration",
        message: error.message,
      });
    }
  })
);

/**
 * POST /api/public/forms/:formId/submit
 * Handle public form submission and trigger workflow
 * No authentication required
 * Rate limited: 5 submissions per 15 minutes per IP
 */
router.post(
  "/:formId/submit",
  formSubmitLimiter, // Apply rate limiting
  asyncHandler(async (req: Request, res: Response) => {
    const { formId } = req.params;
    const { formData, workflowId } = req.body;
    const startTime = Date.now();
    const testMode = req.query.test === 'true';

    try {
      // Fetch the specific workflow directly using workflowId
      const targetWorkflow = await prisma.workflow.findUnique({
        where: {
          id: workflowId,
        },
        select: {
          id: true,
          name: true,
          nodes: true,
          connections: true,
          settings: true,
          active: true,
          userId: true,
        },
      });

      if (!targetWorkflow) {
        // Always log workflow not found (404 errors)
        await webhookLogService.logRequest({
          type: 'form',
          webhookId: formId,
          workflowId: workflowId || 'unknown',
          userId: 'unknown',
          method: req.method,
          path: req.path,
          headers: req.headers as Record<string, string>,
          body: req.body,
          query: req.query as Record<string, any>,
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent'),
          status: 'rejected',
          reason: 'Workflow not found',
          responseCode: 404,
          responseTime: Date.now() - startTime,
          testMode,
        }).catch(err => console.error('Failed to log form request:', err));
        
        return res.status(404).json({
          success: false,
          error: "Workflow not found",
        });
      }

      if (!targetWorkflow.active) {
        // Log workflow not active if logging is enabled
        await logFormRequestIfEnabled({
          type: 'form',
          webhookId: formId,
          workflowId: targetWorkflow.id,
          userId: targetWorkflow.userId,
          method: req.method,
          path: req.path,
          headers: req.headers as Record<string, string>,
          body: req.body,
          query: req.query as Record<string, any>,
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent'),
          status: 'rejected',
          reason: 'Workflow is not active',
          responseCode: 403,
          responseTime: Date.now() - startTime,
          testMode,
        }, null); // No formNode yet
        
        return res.status(403).json({
          success: false,
          error: "Workflow is not active",
        });
      }

      // Parse workflow nodes
      const workflowNodes =
        typeof targetWorkflow.nodes === "string"
          ? JSON.parse(targetWorkflow.nodes)
          : targetWorkflow.nodes;

      // Find forms node with matching formId
      const formNode = (workflowNodes as any[])?.find((n: any) => {
        const isFormNode = n.type === "forms" || n.identifier === "forms";
        // Normalize both values by removing leading slashes for comparison
        const normalizedFormUrl = n.parameters?.formUrl?.replace(/^\/+/, '');
        const normalizedFormId = formId?.replace(/^\/+/, '');
        return isFormNode && normalizedFormUrl === normalizedFormId;
      });

      if (!formNode) {
        // Always log form not found (404 errors)
        await webhookLogService.logRequest({
          type: 'form',
          webhookId: formId,
          workflowId: targetWorkflow.id,
          userId: targetWorkflow.userId,
          method: req.method,
          path: req.path,
          headers: req.headers as Record<string, string>,
          body: req.body,
          query: req.query as Record<string, any>,
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent'),
          status: 'rejected',
          reason: 'Form not found or is not active',
          responseCode: 404,
          responseTime: Date.now() - startTime,
          testMode,
        }).catch(err => console.error('Failed to log form request:', err));
        
        return res.status(404).json({
          success: false,
          error: "Form not found or is not active",
        });
      }

      // Check form protection
      const params = formNode.parameters || {};
      const formProtection = params.formProtection || "none";

      // Check password protection
      if (formProtection === "password") {
        const providedPassword =
          req.body.password || req.headers["x-form-password"];
        const correctPassword = params.formPassword;

        if (!providedPassword || providedPassword !== correctPassword) {
          // Log invalid password if logging is enabled
          await logFormRequestIfEnabled({
            type: 'form',
            webhookId: formId,
            workflowId: targetWorkflow.id,
            userId: targetWorkflow.userId,
            method: req.method,
            path: req.path,
            headers: req.headers as Record<string, string>,
            body: req.body,
            query: req.query as Record<string, any>,
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent'),
            status: 'rejected',
            reason: 'Invalid or missing password',
            responseCode: 403,
            responseTime: Date.now() - startTime,
            testMode,
          }, formNode);
          
          return res.status(403).json({
            success: false,
            error: "Invalid or missing password",
          });
        }
      }

      // Check access key protection
      if (formProtection === "accessKey") {
        const providedKey =
          req.body.accessKey || req.headers["x-form-access-key"];
        const correctKey = params.accessKey;

        if (!providedKey || providedKey !== correctKey) {
          // Log invalid access key if logging is enabled
          await logFormRequestIfEnabled({
            type: 'form',
            webhookId: formId,
            workflowId: targetWorkflow.id,
            userId: targetWorkflow.userId,
            method: req.method,
            path: req.path,
            headers: req.headers as Record<string, string>,
            body: req.body,
            query: req.query as Record<string, any>,
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent'),
            status: 'rejected',
            reason: 'Invalid or missing access key',
            responseCode: 403,
            responseTime: Date.now() - startTime,
            testMode,
          }, formNode);
          
          return res.status(403).json({
            success: false,
            error: "Invalid or missing access key",
          });
        }
      }

      // Prepare trigger data in the same format as manual execution
      // This matches the expected structure from the working execution payload
      const timestamp = new Date().toISOString();
      const submissionId = `form_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const triggerData = {
        timestamp,
        source: "public-form",
        triggeredBy: "public",
        workflowName: targetWorkflow.name,
        nodeCount: workflowNodes.length,
        triggerNodeId: formNode.id,
        triggerNodeType: "forms",
        // Form-specific data
        formId,
        submittedAt: timestamp,
        submissionId,
      };

      // Build workflowData structure like manual execution does
      const workflowData = {
        nodes: workflowNodes,
        connections:
          typeof targetWorkflow.connections === "string"
            ? JSON.parse(targetWorkflow.connections as string)
            : (targetWorkflow.connections as any[]) || [],
        settings:
          typeof targetWorkflow.settings === "string"
            ? JSON.parse(targetWorkflow.settings as string)
            : (targetWorkflow.settings as any) || {},
      };

      // Update the form node parameters with submitted data (like manual execution does)
      const updatedNodes = workflowData.nodes.map((node: any) => {
        if (node.id === formNode.id) {
          return {
            ...node,
            parameters: {
              ...node.parameters,
              submittedFormData: formData,
              lastSubmission: formData,
              submittedAt: timestamp,
            },
          };
        }
        return node;
      });

      workflowData.nodes = updatedNodes;

      // Use ExecutionService directly like manual execution does
      const executionResult = await getExecutionService().executeWorkflow(
        targetWorkflow.id,
        targetWorkflow.userId, // Use actual workflow owner's user ID
        triggerData,
        {
          timeout: 300000, // 5 minutes like manual execution
          manual: true, // Mark as manual-like execution
        },
        formNode.id, // triggerNodeId
        workflowData // Pass the workflow data with updated node parameters
      );

      // Check execution result
      if (!executionResult.success) {
        // Log failed execution if logging is enabled
        await logFormRequestIfEnabled({
          type: 'form',
          webhookId: formId,
          workflowId: targetWorkflow.id,
          userId: targetWorkflow.userId,
          method: req.method,
          path: req.path,
          headers: req.headers as Record<string, string>,
          body: req.body,
          query: req.query as Record<string, any>,
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent'),
          status: 'failed',
          reason: executionResult.error?.message || 'Unknown error',
          responseCode: 500,
          responseTime: Date.now() - startTime,
          testMode,
        }, formNode);
        
        return res.status(500).json({
          success: false,
          error: "Failed to process form submission",
          message: executionResult.error?.message || "Unknown error",
        });
      }

      const executionId = executionResult.data?.executionId;

      // Log successful form submission if logging is enabled
      await logFormRequestIfEnabled({
        type: 'form',
        webhookId: formId,
        workflowId: targetWorkflow.id,
        userId: targetWorkflow.userId,
        method: req.method,
        path: req.path,
        headers: req.headers as Record<string, string>,
        body: req.body,
        query: req.query as Record<string, any>,
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent'),
        status: 'success',
        executionId,
        responseCode: 200,
        responseTime: Date.now() - startTime,
        testMode,
      }, formNode);

      res.json({
        success: true,
        message: "Form submitted successfully",
        executionId,
        submissionId: submissionId,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      // Log exception if logging is enabled
      await logFormRequestIfEnabled({
        type: 'form',
        webhookId: formId,
        workflowId: workflowId || 'unknown',
        userId: 'unknown',
        method: req.method,
        path: req.path,
        headers: req.headers as Record<string, string>,
        body: req.body,
        query: req.query as Record<string, any>,
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent'),
        status: 'failed',
        reason: error.message,
        responseCode: 500,
        responseTime: Date.now() - startTime,
        testMode,
      }, null); // No formNode in catch block
      
      res.status(500).json({
        success: false,
        error: "Failed to submit form",
        message: error.message,
      });
    }
  })
);

export { router as publicFormsRoutes };
export default router;
