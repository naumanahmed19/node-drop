import { PrismaClient } from "@prisma/client";
import { Request, Response, Router } from "express";
import { createServer } from "http";
import { asyncHandler } from "../middleware/asyncHandler";
import { CredentialService } from "../services/CredentialService";
import ExecutionHistoryService from "../services/ExecutionHistoryService";
import { ExecutionService } from "../services/ExecutionService";
import { SocketService } from "../services/SocketService";
import { WorkflowService } from "../services/WorkflowService";
import {
  getTriggerService,
  initializeTriggerService,
} from "../services/triggerServiceSingleton";

const router = Router();
const prisma = new PrismaClient();

/**
 * Helper function to send standardized error response
 * Follows RFC 7231 HTTP standards
 */
function sendErrorResponse(
  res: Response,
  statusCode: number,
  error: string,
  details?: {
    allowedMethods?: string[];
    webhookId?: string;
    [key: string]: any;
  }
): void {
  // Add Allow header for 405 Method Not Allowed responses
  if (statusCode === 405 && details?.allowedMethods) {
    res.setHeader('Allow', details.allowedMethods.join(', '));
  }

  // Standard error response format
  const errorResponse: any = {
    success: false,
    status: statusCode,
    error: getErrorTitle(statusCode),
    message: error,
    timestamp: new Date().toISOString(),
  };

  // Add optional details
  if (details?.allowedMethods) {
    errorResponse.allowed_methods = details.allowedMethods;
  }
  if (details?.webhookId) {
    errorResponse.webhook_id = details.webhookId;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Get standard error title for HTTP status code
 */
function getErrorTitle(statusCode: number): string {
  const titles: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
  };
  return titles[statusCode] || "Error";
}

/**
 * Helper function to send webhook response
 * Handles both custom HTTP Response node data and standard responses
 * Applies webhook options (CORS, custom headers, content-type, etc.)
 */
function sendWebhookResponse(
  res: Response,
  result: any,
  testMode: boolean,
  webhookOptions: any = {}
): void {
  console.log(`🔍 DEBUG sendWebhookResponse called:`, {
    hasResponseData: !!result.responseData,
    hasStatusCode: result.responseData?.statusCode,
    testMode,
    webhookOptions,
  });
  
  // Apply CORS headers from webhook options
  if (webhookOptions.allowedOrigins) {
    const origin = res.req.get('Origin');
    if (webhookOptions.allowedOrigins === '*') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin) {
      // Check if origin is allowed
      const allowedOrigins = webhookOptions.allowedOrigins
        .split(',')
        .map((o: string) => o.trim());
      
      const isAllowed = allowedOrigins.some((allowed: string) => {
        if (allowed === origin) return true;
        if (allowed.startsWith('*.')) {
          const domain = allowed.substring(2);
          return origin.endsWith(domain);
        }
        return false;
      });
      
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  // Apply custom response headers from webhook options
  if (webhookOptions.responseHeaders?.entries) {
    webhookOptions.responseHeaders.entries.forEach((header: any) => {
      if (header.name && header.value) {
        res.setHeader(header.name, header.value);
      }
    });
  }
  
  // Determine content type
  let contentType = 'application/json';
  if (webhookOptions.responseContentType) {
    if (webhookOptions.responseContentType === 'custom' && webhookOptions.customContentType) {
      contentType = webhookOptions.customContentType;
    } else if (webhookOptions.responseContentType !== 'custom') {
      contentType = webhookOptions.responseContentType;
    }
  }
  
  // Check if we have custom HTTP Response data
  if (result.responseData && result.responseData.statusCode) {
    console.log(`📤 Using custom HTTP Response from workflow`, {
      statusCode: result.responseData.statusCode,
      hasBody: !!result.responseData.body,
    });

    // Set cookies if provided
    if (result.responseData.cookies && Array.isArray(result.responseData.cookies)) {
      result.responseData.cookies.forEach((cookie: any) => {
        res.cookie(cookie.name, cookie.value, {
          maxAge: cookie.maxAge,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          path: cookie.path || '/',
          domain: cookie.domain,
          sameSite: cookie.sameSite,
        });
      });
    }

    // Set custom headers from HTTP Response node
    if (result.responseData.headers) {
      Object.entries(result.responseData.headers).forEach(([key, value]) => {
        res.setHeader(key, value as string);
      });
    }
    
    // Override content-type if not set by HTTP Response node
    if (!result.responseData.headers?.['Content-Type'] && !result.responseData.headers?.['content-type']) {
      res.setHeader('Content-Type', contentType);
    }

    // Extract specific property if propertyName is set
    let responseBody = result.responseData.body;
    if (webhookOptions.propertyName && responseBody) {
      responseBody = extractProperty(responseBody, webhookOptions.propertyName);
    }
    
    // Handle noResponseBody option
    if (webhookOptions.noResponseBody) {
      res.status(result.responseData.statusCode).end();
    } else {
      console.log(`📤 Sending response:`, {
        statusCode: result.responseData.statusCode,
        body: responseBody,
      });
      res.status(result.responseData.statusCode).send(responseBody);
    }
  } else {
    // Standard response (when no HTTP Response node or responseMode is "onReceived")
    res.setHeader('Content-Type', contentType);
    
    const responseData = {
      success: true,
      message: testMode
        ? "Webhook received - execution will be visible in editor"
        : "Webhook received and workflow triggered",
      executionId: result.executionId,
      testMode,
      timestamp: new Date().toISOString(),
    };
    
    // Extract specific property if propertyName is set
    let finalResponse: any = responseData;
    if (webhookOptions.propertyName) {
      finalResponse = extractProperty(responseData, webhookOptions.propertyName);
    }
    
    // Handle noResponseBody option
    if (webhookOptions.noResponseBody) {
      res.status(200).end();
    } else {
      // Format response based on content type
      if (contentType.includes('json')) {
        res.status(200).json(finalResponse);
      } else {
        res.status(200).send(String(finalResponse));
      }
    }
  }
}

/**
 * Extract property from object using dot notation or array notation
 * Examples: "data.result", "items[0]", "user.profile.email"
 */
function extractProperty(obj: any, path: string): any {
  if (!path || !obj) return obj;
  
  try {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      // Handle array notation: items[0]
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        result = result[arrayKey]?.[parseInt(index)];
      } else {
        result = result[key];
      }
      
      if (result === undefined) return obj; // Return original if path not found
    }
    
    return result;
  } catch (error) {
    console.error('Error extracting property:', error);
    return obj; // Return original object on error
  }
}

/**
 * Helper function to build webhook request object with binary and raw body support
 */
function buildWebhookRequest(req: Request): any {
  const webhookRequest: any = {
    method: req.method,
    path: req.originalUrl || req.url || req.path,
    headers: req.headers as Record<string, string>,
    query: req.query as Record<string, any>,
    body: req.body,
    ip: req.ip || req.connection.remoteAddress || "unknown",
    userAgent: req.get("User-Agent"),
  };

  // Add binary data if present (convert array to object with field names as keys)
  if ((req as any).binaryData) {
    const binaryFiles = (req as any).binaryData;
    if (Array.isArray(binaryFiles)) {
      webhookRequest.binary = {};
      binaryFiles.forEach((file: any) => {
        // Convert buffer to base64 to avoid memory issues with large files
        const base64Data = Buffer.isBuffer(file.data) 
          ? file.data.toString('base64')
          : file.data;
        
        webhookRequest.binary[file.fieldName] = {
          data: base64Data,
          mimeType: file.mimeType,
          fileName: file.fileName,
          fileSize: file.fileSize,
        };
      });
    } else {
      // Legacy single file support - also convert to base64
      const base64Data = Buffer.isBuffer(binaryFiles.data)
        ? binaryFiles.data.toString('base64')
        : binaryFiles.data;
      
      webhookRequest.binary = {
        ...binaryFiles,
        data: base64Data,
      };
    }
  }

  // Add raw body if present
  if ((req as any).rawBodyString) {
    webhookRequest.rawBody = (req as any).rawBodyString;
  }

  return webhookRequest;
}

/**
 * Helper function to determine HTTP status code from error message
 */
function getStatusCodeFromError(errorMessage: string | undefined): number {
  if (!errorMessage) return 400;
  
  // Check for specific error types in order of priority
  if (errorMessage.includes("not found")) {
    return 404;
  }
  if (errorMessage.includes("Origin not allowed") || 
      errorMessage.includes("IP address not whitelisted") || 
      errorMessage.includes("Bot requests are not allowed")) {
    return 403;
  }
  if (errorMessage.includes("Method") && errorMessage.includes("not supported")) {
    return 405;
  }
  if (errorMessage.includes("authentication") || errorMessage.includes("Unauthorized")) {
    return 401;
  }
  
  return 400; // Default bad request
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

// Initialize non-dependent services immediately
const workflowService = new WorkflowService(prisma);
const executionHistoryService = new ExecutionHistoryService(prisma);
const credentialService = new CredentialService();

// Use the global socketService instead of creating a new instance
// This ensures we use the same Socket.IO server that the frontend is connected to
const getSocketService = () => {
  if (!global.socketService) {
    throw new Error("SocketService not initialized. Make sure the server is properly started.");
  }
  return global.socketService;
};

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
      getSocketService(), // Use global socketService
      getNodeService(),
      executionHistoryService,
      credentialService
    );
    triggerServiceInitialized = true;
  }
  return getTriggerService();
};

/**
 * Debug endpoint - List all registered webhooks
 * MUST come before /:webhookId route to avoid pattern matching conflict
 */
router.get(
  "/debug/list",
  asyncHandler(async (req: Request, res: Response) => {
    const triggerService = await ensureTriggerServiceInitialized();
    const webhooks = triggerService.getRegisteredWebhooks();

    res.json({
      success: true,
      count: webhooks.length,
      webhooks,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Public Webhook Endpoint - handles incoming webhook requests
 * This route is accessible without authentication to allow external services to trigger workflows
 *
 * URL format: http://localhost:4000/webhook/{webhookId}
 * Optional path: http://localhost:4000/webhook/{webhookId}/custom-path
 *
 * Supports all HTTP methods: GET, POST, PUT, DELETE, PATCH
 */
router.all(
  "/:webhookId",
  asyncHandler(async (req: Request, res: Response) => {
    const { webhookId } = req.params;
    
    // Extract the full path after /webhook/ for pattern matching
    // e.g., /webhook/users/123 -> users/123
    const fullPath = req.path.replace(/^\//, ''); // Remove leading slash

    console.log(`📨 Webhook received: ${req.method} /webhook/${fullPath}`);
    console.log(`📝 Headers:`, req.headers);
    console.log(`📝 Body:`, req.body);
    console.log(`📝 Query:`, req.query);
    console.log(`📝 Path: ${req.path}, URL: ${req.url}, OriginalURL: ${req.originalUrl}`);
    console.log(`📝 Binary Data:`, (req as any).binaryData ? 'Present' : 'Not present');

    // Check for test mode - if ?test=true or ?visualize=true, notify frontend before executing
    const testMode = req.query.test === 'true' || req.query.visualize === 'true';

    console.log(`🔍 Test mode detection: req.query.test = "${req.query.test}", testMode = ${testMode}`);

    const webhookRequest = buildWebhookRequest(req);

    try {
      const triggerService = await ensureTriggerServiceInitialized();
      const result = await triggerService.handleWebhookTrigger(
        fullPath, // Pass full path for pattern matching
        webhookRequest,
        testMode // Pass test mode flag
      );

      if (result.success) {
        console.log(
          `✅ Webhook processed successfully - Execution ID: ${result.executionId}`
        );
        sendWebhookResponse(res, result, testMode, result.webhookOptions);
      } else {
        console.error(`❌ Webhook processing failed: ${result.error}`);
        const statusCode = getStatusCodeFromError(result.error);

        sendErrorResponse(
          res,
          statusCode,
          result.error || "Failed to process webhook",
          { webhookId }
        );
      }
    } catch (error: any) {
      console.error(`❌ Webhook error:`, error);
      
      // Handle AppError with specific status codes
      const statusCode = error.statusCode || 500;
      
      sendErrorResponse(
        res,
        statusCode,
        error.message || "An unexpected error occurred while processing the webhook",
        {
          webhookId,
          allowedMethods: error.allowedMethods,
        }
      );
    }
  })
);

// Route with path suffix (must come after the test route to avoid conflicts)
router.all(
  "/:webhookId/*",
  asyncHandler(async (req: Request, res: Response) => {
    const { webhookId } = req.params;
    const pathSuffix = req.params[0] || "";
    
    // Extract the full path after /webhook/ for pattern matching
    // e.g., /webhook/users/123/posts -> users/123/posts
    const fullPath = req.path.replace(/^\//, ''); // Remove leading slash

    console.log(
      `📨 Webhook received: ${req.method} /webhook/${fullPath}`
    );
    console.log(`📝 Headers:`, req.headers);
    console.log(`📝 Body:`, req.body);
    console.log(`📝 Query:`, req.query);
    console.log(`📝 Path: ${req.path}, URL: ${req.url}, OriginalURL: ${req.originalUrl}`);

    // Check for test mode - if ?test=true or ?visualize=true, notify frontend before executing
    const testMode = req.query.test === 'true' || req.query.visualize === 'true';

    console.log(`🔍 Test mode detection: req.query.test = "${req.query.test}", testMode = ${testMode}`);

    const webhookRequest = buildWebhookRequest(req);

    try {
      const triggerService = await ensureTriggerServiceInitialized();
      const result = await triggerService.handleWebhookTrigger(
        fullPath, // Pass full path for pattern matching
        webhookRequest,
        testMode // Pass test mode flag
      );

      if (result.success) {
        console.log(
          `✅ Webhook processed successfully - Execution ID: ${result.executionId}`
        );
        sendWebhookResponse(res, result, testMode, result.webhookOptions);
      } else {
        console.error(`❌ Webhook processing failed: ${result.error}`);
        const statusCode = getStatusCodeFromError(result.error);

        sendErrorResponse(
          res,
          statusCode,
          result.error || "Failed to process webhook",
          { webhookId }
        );
      }
    } catch (error: any) {
      console.error(`❌ Webhook error:`, error);
      
      // Handle AppError with specific status codes
      const statusCode = error.statusCode || 500;
      
      sendErrorResponse(
        res,
        statusCode,
        error.message || "An unexpected error occurred while processing the webhook",
        {
          webhookId,
          allowedMethods: error.allowedMethods,
        }
      );
    }
  })
);

/**
 * Webhook Test Endpoint - allows testing webhook without triggering workflow
 * Useful for debugging and validation
 */
router.post(
  "/:webhookId/test",
  asyncHandler(async (req: Request, res: Response) => {
    const { webhookId } = req.params;

    console.log(`🧪 Webhook test: ${webhookId}`);

    // Just validate the webhook exists without triggering
    const triggerService = await ensureTriggerServiceInitialized();
    const webhookExists = (triggerService as any).webhookTriggers?.has(
      webhookId
    );

    if (webhookExists) {
      res.json({
        success: true,
        message: "Webhook is configured and ready to receive requests",
        webhookId,
        timestamp: new Date().toISOString(),
      });
    } else {
      sendErrorResponse(
        res,
        404,
        "Webhook not found or not active",
        { webhookId }
      );
    }
  })
);

export { router as webhookRoutes };
export default router;
