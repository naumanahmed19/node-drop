// Main entry point for the node drop backend
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { createServer } from "http";

// Import routes
import { authRoutes } from "./routes/auth";
import credentialRoutes from "./routes/credentials";
import { customNodeRoutes } from "./routes/custom-nodes";
import environmentRoutes from "./routes/environment";
import executionControlRoutes from "./routes/execution-control";
import executionHistoryRoutes from "./routes/execution-history";
import executionRecoveryRoutes from "./routes/execution-recovery";
import { executionRoutes } from "./routes/executions";
import flowExecutionRoutes from "./routes/flow-execution";
import googleRoutes from "./routes/google";
import { nodeTypeRoutes } from "./routes/node-types";
import { nodeRoutes } from "./routes/nodes";
import oauthRoutes from "./credentials/oauth/routes";
import { publicFormsRoutes } from "./routes/public-forms";
import { publicChatsRoutes } from "./routes/public-chats";
import aiMemoryRoutes from "./routes/ai-memory.routes";
import triggerRoutes from "./routes/triggers";
import userRoutes from "./routes/user.routes";
import variableRoutes from "./routes/variables";
import webhookRoutes from "./routes/webhook";
import webhookLogsRoutes from "./routes/webhook-logs";
import { workflowRoutes } from "./routes/workflows";

// Import middleware
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

// Import services
import { PrismaClient } from "@prisma/client";
import { CredentialService } from "./services/CredentialService";
import { ExecutionService } from "./services/ExecutionService";
import ExecutionHistoryService from "./services/ExecutionHistoryService";
import { NodeLoader } from "./services/NodeLoader";
import { NodeService } from "./services/NodeService";
import { RealtimeExecutionEngine } from "./services/RealtimeExecutionEngine";
import { SocketService } from "./services/SocketService";
import { logger } from "./utils/logger";

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// Set server timeout to prevent gateway timeouts (5 minutes)
httpServer.timeout = 300000; // 5 minutes
httpServer.keepAliveTimeout = 65000; // 65 seconds (slightly higher than typical load balancer timeout)
httpServer.headersTimeout = 66000; // Slightly higher than keepAliveTimeout

// Initialize services
const prisma = new PrismaClient();
const nodeService = new NodeService(prisma);
const credentialService = new CredentialService();

// Register core credentials (OAuth2, HTTP Basic Auth, API Key, etc.)
try {
  credentialService.registerCoreCredentials();
} catch (error) {
  console.error("❌ Failed to register core credentials:", error);
}

const nodeLoader = new NodeLoader(nodeService, credentialService, prisma);
const socketService = new SocketService(httpServer);

// Initialize ExecutionService (for HTTP endpoints)
const executionHistoryService = new ExecutionHistoryService(prisma);
const executionService = new ExecutionService(
  prisma,
  nodeService,
  executionHistoryService
);

// Initialize RealtimeExecutionEngine (for WebSocket execution)
const realtimeExecutionEngine = new RealtimeExecutionEngine(prisma, nodeService);

// Import WorkflowService, TriggerService singleton, and ScheduleJobManager
import { WorkflowService } from "./services/WorkflowService";
import { initializeTriggerService, getTriggerService } from "./services/triggerServiceSingleton";
import { ScheduleJobManager } from "./scheduled-jobs/ScheduleJobManager";

// Initialize WorkflowService (needed by TriggerService)
const workflowService = new WorkflowService(prisma);

// Initialize ScheduleJobManager (for persistent schedule jobs)
const scheduleJobManager = new ScheduleJobManager(
  prisma,
  executionService,
  {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    },
  }
);

// Connect RealtimeExecutionEngine events to SocketService
realtimeExecutionEngine.on("execution-started", (data) => {
  socketService.broadcastExecutionEvent(data.executionId, {
    executionId: data.executionId,
    type: "started",
    timestamp: data.timestamp,
  });
});

realtimeExecutionEngine.on("node-started", (data) => {
  logger.info('🔵 [RealtimeEngine] node-started event received', {
    executionId: data.executionId,
    nodeId: data.nodeId,
    nodeName: data.nodeName,
    nodeType: data.nodeType,
  });
  
  socketService.broadcastExecutionEvent(data.executionId, {
    executionId: data.executionId,
    type: "node-started",
    nodeId: data.nodeId,
    data: { nodeName: data.nodeName, nodeType: data.nodeType },
    timestamp: data.timestamp,
  });
  
  logger.info('✅ [RealtimeEngine] node-started event broadcast', {
    nodeId: data.nodeId,
  });
});

realtimeExecutionEngine.on("node-completed", (data) => {
  logger.info('🟢 [RealtimeEngine] node-completed event received', {
    executionId: data.executionId,
    nodeId: data.nodeId,
    nodeName: data.nodeName,
    nodeType: data.nodeType,
  });
  
  socketService.broadcastExecutionEvent(data.executionId, {
    executionId: data.executionId,
    type: "node-completed",
    nodeId: data.nodeId,
    data: { 
      outputData: data.outputData, 
      duration: data.duration,
      activeConnections: data.activeConnections, // NEW: Include active connections for edge animation
    },
    timestamp: data.timestamp,
  });
  
  logger.info('✅ [RealtimeEngine] node-completed event broadcast', {
    nodeId: data.nodeId,
  });
});

realtimeExecutionEngine.on("node-failed", (data) => {
  logger.error('🔴 [RealtimeEngine] node-failed event received', {
    executionId: data.executionId,
    nodeId: data.nodeId,
    nodeName: data.nodeName,
    nodeType: data.nodeType,
    error: data.error,
  });
  
  socketService.broadcastExecutionEvent(data.executionId, {
    executionId: data.executionId,
    type: "node-failed",
    nodeId: data.nodeId,
    error: data.error,
    timestamp: data.timestamp,
  });
  
  logger.error('✅ [RealtimeEngine] node-failed event broadcast', {
    nodeId: data.nodeId,
    error: data.error,
  });
});

realtimeExecutionEngine.on("execution-completed", (data) => {
  socketService.broadcastExecutionEvent(data.executionId, {
    executionId: data.executionId,
    type: "completed",
    data: { duration: data.duration },
    timestamp: data.timestamp,
  });
});

realtimeExecutionEngine.on("execution-failed", (data) => {
  socketService.broadcastExecutionEvent(data.executionId, {
    executionId: data.executionId,
    type: "failed",
    error: data.error,
    timestamp: data.timestamp,
  });
});

realtimeExecutionEngine.on("execution-cancelled", (data) => {
  socketService.broadcastExecutionEvent(data.executionId, {
    executionId: data.executionId,
    type: "cancelled",
    timestamp: data.timestamp,
  });
});

// Make services available globally for other services
declare global {
  var socketService: SocketService;
  var nodeLoader: NodeLoader;
  var nodeService: NodeService;
  var credentialService: CredentialService;
  var executionService: ExecutionService;
  var realtimeExecutionEngine: RealtimeExecutionEngine;
  var workflowService: WorkflowService;
  var scheduleJobManager: ScheduleJobManager;
  var triggerService: any;
  var prisma: PrismaClient;
}
global.socketService = socketService;
global.nodeLoader = nodeLoader;
global.nodeService = nodeService;
global.credentialService = credentialService;
global.executionService = executionService;
global.realtimeExecutionEngine = realtimeExecutionEngine;
global.workflowService = workflowService;
global.scheduleJobManager = scheduleJobManager;
global.prisma = prisma;

// Initialize node systems
async function initializeNodeSystems() {
  try {
    // First, ensure built-in nodes are loaded
    await nodeService.waitForInitialization();

    // Check if nodes were successfully registered
    const nodeTypes = await nodeService.getNodeTypes();

    if (nodeTypes.length === 0) {
      try {
        await nodeService.registerDiscoveredNodes();
        const newNodeTypes = await nodeService.getNodeTypes();
        console.log(`✅ Registered ${newNodeTypes.length} nodes`);
      } catch (registrationError) {
        console.error("Failed to register nodes:", registrationError);
      }
    } else {
      // Nodes already registered

      // Even if some nodes were found, try to register any missing ones
      try {
        // Import and use node discovery directly
        const { nodeDiscovery } = await import("./utils/NodeDiscovery");
        const allNodeDefinitions = await nodeDiscovery.getAllNodeDefinitions();

        let newRegistrations = 0;
        for (const nodeDefinition of allNodeDefinitions) {
          try {
            const result = await nodeService.registerNode(nodeDefinition);
            if (result.success) {
              newRegistrations++;
            }
          } catch (error) {
            // Silently continue on registration errors
          }
        }

        if (newRegistrations > 0) {
          console.log(`✅ Registered ${newRegistrations} nodes`);
        }
      } catch (registrationError) {
        console.warn("Failed to register additional nodes");
      }
    }

    // Then, load custom nodes
    await nodeLoader.initialize();
    
    // Show total nodes loaded
    const totalNodes = await nodeService.getNodeTypes();
    console.log(`✅ Loaded ${totalNodes.length} nodes`);
  } catch (error) {
    console.error("❌ Failed to initialize node systems:", error);
    // Don't throw the error - allow the application to start
  }
}

// Basic middleware
app.use(helmet());
// Configure CORS origins
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://localhost:8080", // For widget examples
    "http://localhost:8081", // Alternative widget port
    "http://localhost:9000", // Widget examples server
    "http://127.0.0.1:8080", // Alternative localhost
    "http://127.0.0.1:8081", // Alternative localhost
    "http://127.0.0.1:9000", // Alternative localhost
  ];

// Dynamic CORS origin function
const corsOriginFunction = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Allow requests with no origin (like mobile apps or curl requests)
  if (!origin) return callback(null, true);

  // Check if origin is in allowed list
  if (corsOrigins.includes(origin)) {
    return callback(null, true);
  }

  // For development, allow all localhost and 127.0.0.1 origins
  if (process.env.NODE_ENV === 'development' &&
    (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    return callback(null, true);
  }

  // Log rejected origins for debugging
  console.warn(`CORS: Rejected origin: ${origin}`);
  return callback(new Error('Not allowed by CORS'), false);
};

// Apply CORS to all routes EXCEPT webhooks (webhooks have their own CORS logic)
app.use((req, res, next) => {
  // Skip global CORS for webhook routes - they handle CORS themselves
  if (req.path.startsWith('/webhook')) {
    return next();
  }
  
  // Apply global CORS for all other routes
  cors({
    origin: corsOriginFunction,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })(req, res, next);
});
app.use(compression());
app.use(cookieParser()); // Parse cookies

// Webhook body parsing middleware - MUST come before express.json()
import { webhookBodyParser } from "./middleware/webhookBodyParser";

// Apply webhook body parser for file uploads and special handling
app.use("/webhook", webhookBodyParser);

// Standard JSON parsing for all routes (including webhooks that aren't multipart)
app.use(express.json({ limit: "10mb", verify: (req: any, res, buf, encoding) => {
  // Store raw body for webhooks that might need it
  if (req.originalUrl && req.originalUrl.startsWith('/webhook')) {
    req.rawBody = buf;
    req.rawBodyString = buf.toString('utf-8');
  }
}}));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const nodeTypes = await nodeService.getNodeTypes();
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "node-drop-backend",
      version: "1.0.0",
      hot_reload: "BACKEND HOT RELOAD WORKING!",
      websocket: {
        connected_users: socketService.getConnectedUsersCount(),
      },
      nodes: {
        registered_count: nodeTypes.length,
        status: nodeTypes.length > 0 ? "ok" : "no_nodes_registered"
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      service: "node-drop-backend",
      version: "1.0.0",
      error: "Failed to check node status",
      nodes: {
        registered_count: 0,
        status: "error"
      },
    });
  }
});

// Basic route
app.get("/", (req, res) => {
  res.json({
    message: "node drop Backend API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      workflows: "/api/workflows",
      executions: "/api/executions",
      nodes: "/api/nodes",
      nodeTypes: "/api/node-types",
      credentials: "/api/credentials",
      variables: "/api/variables",
      triggers: "/api/triggers",
      webhooks: "/webhook/{webhookId}",
      webhookTest: "/webhook/{webhookId}/test",
      forms: "/webhook/forms/{formId}",
      formSubmit: "/webhook/forms/{formId}/submit",
      chats: "/webhook/chats/{chatId}",
      chatMessage: "/webhook/chats/{chatId}/message",
      customNodes: "/api/custom-nodes",
      flowExecution: "/api/flow-execution",
      executionControl: "/api/execution-control",
      executionHistory: "/api/execution-history",
      executionRecovery: "/api/execution-recovery",
      oauth: "/api/oauth",
      google: "/api/google",
      health: "/health",
    },
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api", environmentRoutes); // Environment routes are nested under workflows
app.use("/api/executions", executionRoutes);
app.use("/api/nodes", nodeRoutes);
app.use("/api/node-types", nodeTypeRoutes);
app.use("/api/credentials", credentialRoutes);
app.use("/api/variables", variableRoutes);
app.use("/api/triggers", triggerRoutes);
app.use("/api/custom-nodes", customNodeRoutes);
app.use("/api/flow-execution", flowExecutionRoutes);
app.use("/api/execution-control", executionControlRoutes);
app.use("/api/execution-history", executionHistoryRoutes);
app.use("/api/execution-recovery", executionRecoveryRoutes);
app.use("/api/oauth", oauthRoutes);
app.use("/api/google", googleRoutes);
app.use("/api/ai-memory", aiMemoryRoutes);
app.use("/api", webhookLogsRoutes);

// Webhook routes (public endpoints without /api prefix for easier external integration)
// All webhook-based triggers are under /webhook for consistency
// IMPORTANT: Register specific routes BEFORE generic webhook route
app.use("/webhook/forms", publicFormsRoutes);
app.use("/webhook/chats", publicChatsRoutes);
app.use("/webhook", webhookRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT} - BACKEND HOT RELOAD WORKS!`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 Socket.io enabled for real-time updates`);
  console.log(`🔗 API endpoints:`);
  console.log(`   - Auth: http://localhost:${PORT}/api/auth`);
  console.log(`   - Workflows: http://localhost:${PORT}/api/workflows`);
  console.log(`   - Executions: http://localhost:${PORT}/api/executions`);
  console.log(`   - Nodes: http://localhost:${PORT}/api/nodes`);
  console.log(`   - Node Types: http://localhost:${PORT}/api/node-types`);
  console.log(`   - Credentials: http://localhost:${PORT}/api/credentials`);
  console.log(`   - Variables: http://localhost:${PORT}/api/variables`);
  console.log(`   - Triggers: http://localhost:${PORT}/api/triggers`);
  console.log(`   - Custom Nodes: http://localhost:${PORT}/api/custom-nodes`);
  console.log(`📨 Webhook endpoint (public):`);
  console.log(`   - http://localhost:${PORT}/webhook/{webhookId}`);

  // Initialize node systems after server starts
  await initializeNodeSystems();

  // Initialize TriggerService singleton to load active triggers
  try {
    await initializeTriggerService(
      prisma,
      workflowService,
      executionService,
      socketService,
      nodeService,
      executionHistoryService,
      credentialService
    );
    global.triggerService = getTriggerService();
    console.log(`✅ Initialized triggers & webhooks`);
  } catch (error) {
    console.error(`Failed to initialize TriggerService:`, error);
  }

  // Initialize ScheduleJobManager for persistent schedule jobs
  try {
    await scheduleJobManager.initialize();
    console.log(`✅ Initialized schedule jobs`);
  } catch (error) {
    console.error(`❌ Failed to initialize ScheduleJobManager:`, error);
  }
});

// Memory monitoring to detect leaks
setInterval(() => {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  
  // Memory monitoring (silent)
  
  // Alert if memory usage is high
  if (heapUsedMB > 1024) { // 1GB threshold
    console.warn(`⚠️  High memory usage detected: ${heapUsedMB}MB`);
    
    // Log active resources
    const activeExecutions = (realtimeExecutionEngine as any).activeExecutions?.size || 0;
    const connectedSockets = socketService.getConnectedUsersCount();
    const eventBufferSize = (socketService as any).executionEventBuffer?.size || 0;
    
    console.log(`  Active executions: ${activeExecutions}`);
    console.log(`  Connected sockets: ${connectedSockets}`);
    console.log(`  Event buffer size: ${eventBufferSize}`);
    
    // Force garbage collection if available
    if (global.gc) {
      console.log('  Running garbage collection...');
      global.gc();
    }
  }
}, 30000); // Every 30 seconds

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  
  // Remove all event listeners to prevent memory leaks
  realtimeExecutionEngine.removeAllListeners();
  
  await nodeLoader.cleanup();
  await socketService.shutdown();
  await scheduleJobManager.shutdown();
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  
  // Remove all event listeners to prevent memory leaks
  realtimeExecutionEngine.removeAllListeners();
  
  await nodeLoader.cleanup();
  await socketService.shutdown();
  await scheduleJobManager.shutdown();
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export { app };
export default app;
