import { PrismaClient } from "@prisma/client";
import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
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
import { WorkflowService } from "../services/WorkflowService";

const router = Router();

// Apply dynamic CORS based on chat node settings
router.use((req, res, next) => {
  // For now, allow all origins (will be made configurable per chat node)
  // TODO: Read allowedOrigins from chat node parameters
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Rate limiter for chat fetching (GET requests)
// Allow 30 requests per minute for chat configuration
const chatFetchLimiter = rateLimit({
  windowMs: rateLimitConfig.publicChatFetch.windowMs,
  max: rateLimitConfig.publicChatFetch.max,
  message: {
    success: false,
    error: rateLimitConfig.publicChatFetch.message,
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => shouldSkipRateLimit(req.ip),
});

// Rate limiter for chat message submission (POST requests)
// More restrictive: 10 messages per minute to prevent spam
const chatSubmitLimiter = rateLimit({
  windowMs: rateLimitConfig.publicChatSubmit.windowMs,
  max: rateLimitConfig.publicChatSubmit.max,
  message: {
    success: false,
    error: rateLimitConfig.publicChatSubmit.message,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkipRateLimit(req.ip),
  // Custom handler for when limit is exceeded
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "Too many messages from this IP, please try again later",
      retryAfter: Math.ceil(rateLimitConfig.publicChatSubmit.windowMs / 1000), // seconds
    });
  },
});

const prisma = new PrismaClient();

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

/**
 * GET /api/public/chats/:chatId
 * Fetch chat configuration for public display
 * No authentication required
 * Rate limited: 30 requests per minute per IP
 */
router.get(
  "/:chatId",
  chatFetchLimiter, // Apply rate limiting
  asyncHandler(async (req: Request, res: Response) => {
    const { chatId } = req.params;

    try {
      // Find workflow with chat node that has this chatId
      const workflows = await prisma.workflow.findMany({
        where: {
          active: true,
        },
        select: {
          id: true,
          name: true,
          nodes: true,
          active: true,
        },
      });

      let chatConfig = null;
      let workflowId = null;
      let workflowName = null;

      // Search through workflows for matching chatId
      for (const workflow of workflows) {
        const workflowNodes =
          typeof workflow.nodes === "string"
            ? JSON.parse(workflow.nodes)
            : workflow.nodes;

        // Find chat node with matching chatUrl
        const chatNode = (workflowNodes as any[])?.find((node: any) => {
          const isChatNode = node.type === "chat";
          const hasChatUrl = node.parameters?.chatUrl;
          const matches = hasChatUrl === chatId;

          return isChatNode && matches;
        });

        if (chatNode) {
          const params = chatNode.parameters || {};

          chatConfig = {
            chatTitle: params.chatTitle || "AI Assistant",
            chatDescription: params.chatDescription || "",
            welcomeMessage: params.welcomeMessage || "Hello! How can I help you today?",
            placeholderText: params.placeholderText || "Type your message...",
            widgetTheme: params.widgetTheme || "light",
            widgetPosition: params.widgetPosition || "bottom-right",
            bubbleColor: params.bubbleColor || "#3b82f6",
            headerColor: params.headerColor || "#1f2937",
            workflowName: workflow.name,
            isActive: workflow.active,
          };

          workflowId = workflow.id;
          workflowName = workflow.name;
          break;
        }
      }

      if (!chatConfig) {
        return res.status(404).json({
          success: false,
          error: "Chat not found or is not active",
        });
      }

      res.json({
        success: true,
        chat: chatConfig,
        chatId,
        workflowId,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: "Failed to fetch chat configuration",
        message: error.message,
      });
    }
  })
);

/**
 * POST /api/public/chats/:chatId/message
 * Handle public chat message submission and trigger workflow
 * No authentication required
 * Rate limited: 10 messages per minute per IP
 */
router.post(
  "/:chatId/message",
  chatSubmitLimiter, // Apply rate limiting
  asyncHandler(async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { message, sessionId } = req.body;

    try {
      // Validate message
      if (!message || typeof message !== "string") {
        return res.status(400).json({
          success: false,
          error: "Message is required",
        });
      }

      if (message.length > 1000) {
        return res.status(400).json({
          success: false,
          error: "Message too long (max 1000 characters)",
        });
      }

      if (message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Message cannot be empty",
        });
      }

      // Find workflow with chat node that has this chatId
      const workflows = await prisma.workflow.findMany({
        where: {
          active: true,
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

      let targetWorkflow = null;

      // Search through workflows for matching chatId
      for (const workflow of workflows) {
        const workflowNodes =
          typeof workflow.nodes === "string"
            ? JSON.parse(workflow.nodes)
            : workflow.nodes;

        // Find chat node with matching chatUrl
        const chatNode = (workflowNodes as any[])?.find((node: any) => {
          const isChatNode = node.type === "chat";
          const hasChatUrl = node.parameters?.chatUrl;
          const matches = hasChatUrl === chatId;

          return isChatNode && matches;
        });

        if (chatNode) {
          targetWorkflow = workflow;
          break;
        }
      }

      if (!targetWorkflow) {
        return res.status(404).json({
          success: false,
          error: "Workflow not found",
        });
      }

      if (!targetWorkflow.active) {
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

      // Find chat node with matching chatId
      const chatNode = (workflowNodes as any[])?.find(
        (n: any) =>
          n.type === "chat" && n.parameters?.chatUrl === chatId
      );

      if (!chatNode) {
        return res.status(404).json({
          success: false,
          error: "Chat not found or is not active",
        });
      }

      // Prepare trigger data
      const timestamp = new Date().toISOString();
      const finalSessionId = sessionId || `chat_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      const triggerData = {
        timestamp,
        source: "public-chat",
        triggeredBy: "public",
        workflowName: targetWorkflow.name,
        nodeCount: workflowNodes.length,
        triggerNodeId: chatNode.id,
        triggerNodeType: "chat",
        // Chat-specific data
        chatId,
        message,
        sessionId: finalSessionId,
        submittedAt: timestamp,
      };

      // Build workflowData structure
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

      // Update the chat node parameters with submitted message
      const updatedNodes = workflowData.nodes.map((node: any) => {
        if (node.id === chatNode.id) {
          return {
            ...node,
            parameters: {
              ...node.parameters,
              userMessage: message,
              lastMessage: message,
              submittedAt: timestamp,
            },
          };
        }
        return node;
      });

      workflowData.nodes = updatedNodes;

      // Execute workflow using ExecutionService
      const executionResult = await getExecutionService().executeWorkflow(
        targetWorkflow.id,
        targetWorkflow.userId, // Use actual workflow owner's user ID
        triggerData,
        {
          timeout: 300000, // 5 minutes timeout
          manual: true, // Mark as manual-like execution
        },
        chatNode.id, // triggerNodeId
        workflowData // Pass the workflow data with updated node parameters
      );

      // Check execution result
      if (!executionResult.success) {
        return res.status(500).json({
          success: false,
          error: "Failed to process message",
          message: executionResult.error?.message || "Unknown error",
        });
      }

      console.log("Execution result:", JSON.stringify(executionResult, null, 2));

      // Extract AI response from execution result
      let aiResponse = "Message received successfully";
      
      const executionId = executionResult.data?.executionId;
      

      
      // Try to extract response from execution data
      try {
        // Check multiple possible paths for the execution data
        let runData = null;
        
        // Path 1: Direct from executionData
        if (executionResult.data?.executionData?.resultData?.runData) {
          runData = executionResult.data.executionData.resultData.runData;
        }
        
        // Path 2: Check if it's directly in data
        else if (executionResult.data?.runData) {
          runData = executionResult.data.runData;
        }
        
        if (runData) {
          const nodeIds = Object.keys(runData);
          
          // Try each node to find a response
          for (const nodeId of nodeIds) {
            const nodeData = runData[nodeId];
            
            if (nodeData && nodeData[0] && nodeData[0].data && nodeData[0].data.main) {
              const mainData = nodeData[0].data.main;
              if (mainData && mainData[0] && mainData[0].json) {
                const output = mainData[0].json;
                
                // Look for response fields
                if (output.response && typeof output.response === 'string') {
                  aiResponse = output.response;
                  break;
                } else if (output.aiResponse && typeof output.aiResponse === 'string') {
                  aiResponse = output.aiResponse;
                  break;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error extracting response:", error);
      }

      res.json({
        success: true,
        response: aiResponse,
        sessionId: finalSessionId,
        timestamp: new Date().toISOString(),
        executionId,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: "Failed to process message",
        message: error.message,
      });
    }
  })
);

export { router as publicChatsRoutes };
export default router;
