import { PrismaClient } from "@prisma/client";
import { Response, Router } from "express";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/errorHandler";
import { validateParams, validateQuery } from "../middleware/validation";
import { ExecutionService } from "../services";
import ExecutionHistoryService from "../services/ExecutionHistoryService";
import { ApiResponse, ExecutionQuerySchema, IdParamSchema } from "../types/api";
import { logger } from "../utils/logger";

const router = Router();
const prisma = new PrismaClient();
// Use lazy initialization to get services when needed
let localNodeService: any = null;

const getNodeService = () => {
  if (!global.nodeService) {
    logger.warn("Global NodeService not available, creating local instance", {
      globalNodeService: typeof global.nodeService,
      globalKeys: Object.keys(global),
    });

    // Create a local instance as fallback
    if (!localNodeService) {
      const { NodeService } = require("../services/NodeService");
      localNodeService = new NodeService(prisma);
      logger.info("Created local NodeService instance as fallback");
    }
    return localNodeService;
  }
  return global.nodeService;
};

let executionHistoryService: ExecutionHistoryService;
let executionService: ExecutionService;

const getExecutionService = () => {
  if (!executionService) {
    executionHistoryService = new ExecutionHistoryService(prisma);
    executionService = new ExecutionService(
      prisma,
      getNodeService(),
      executionHistoryService
    );
  }
  return executionService;
};

// POST /api/executions - Execute a workflow or single node
router.post(
  "/",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      workflowId,
      triggerData,
      options,
      triggerNodeId,
      workflowData,
      nodeId,
      inputData,
      parameters,
      mode = "workflow",
    } = req.body;

    if (!workflowId) {
      throw new AppError("Workflow ID is required", 400, "MISSING_WORKFLOW_ID");
    }

    let result;

    // Handle single node execution if nodeId is provided
    if (nodeId) {
      if (!["single", "workflow"].includes(mode)) {
        throw new AppError(
          "Mode must be 'single' or 'workflow'",
          400,
          "INVALID_MODE"
        );
      }

      result = await getExecutionService().executeSingleNode(
        workflowId,
        nodeId,
        req.user!.id,
        inputData,
        parameters,
        mode,
        workflowData // Pass the optional workflow data
      );
    } else {
      // Handle regular workflow execution
      result = await getExecutionService().executeWorkflow(
        workflowId,
        req.user!.id,
        triggerData,
        options,
        triggerNodeId, // Pass the specific trigger node ID
        workflowData // Pass the optional workflow data
      );
    }

    // Always return success for started executions, but include failure details
    const response: ApiResponse = {
      success: true,
      data: result.data,
      // Include error/warning details if some nodes failed
      ...(result.error && {
        warnings: [
          {
            type: "NODE_FAILURES",
            message: result.error.message,
            details: result.error,
          },
        ],
      }),
    };

    res.status(201).json(response);
  })
);

// GET /api/executions/scheduled - Get upcoming scheduled executions
router.get(
  "/scheduled",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const workflowId = req.query.workflowId as string;

    // Import WorkflowService
    const { WorkflowService } = await import("../services/WorkflowService");
    const workflowService = new WorkflowService(prisma);

    let workflows: any[] = [];

    if (workflowId) {
      // Get specific workflow
      const workflow = await workflowService.getWorkflow(
        workflowId,
        req.user!.id
      );
      workflows = [workflow];
    } else {
      // Get all workflows (not just active ones) with schedule triggers
      const allWorkflows = await prisma.workflow.findMany({
        where: {
          userId: req.user!.id,
        },
        select: {
          id: true,
          name: true,
          active: true,
          triggers: true,
        },
      });

      logger.info(`Found ${allWorkflows.length} workflows for user ${req.user!.id}`);

      // Filter workflows that have active schedule triggers
      workflows = allWorkflows.filter((w) => {
        const triggers = (w.triggers as any[]) || [];
        const hasScheduleTrigger = triggers.some((t) => {
          // If active is undefined, treat as true (for backwards compatibility)
          const isActive = t.active !== undefined ? t.active : true;
          return t.type === "schedule" && isActive;
        });
        if (hasScheduleTrigger) {
          logger.info(`Workflow ${w.id} (${w.name}) has active schedule triggers`);
        }
        return hasScheduleTrigger;
      });

      logger.info(`Filtered to ${workflows.length} workflows with active schedule triggers`);
    }

    // Get upcoming executions for each workflow
    const scheduledExecutions = await Promise.all(
      workflows.map(async (workflow) => {
        try {
          return await workflowService.getUpcomingExecutions(workflow, limit);
        } catch (error) {
          logger.error(
            `Error getting upcoming executions for workflow ${workflow.id}:`,
            error
          );
          return null;
        }
      })
    );

    // Filter out null results and flatten
    const validExecutions = scheduledExecutions.filter((e) => e !== null);

    logger.info(`Returning ${validExecutions.length} workflows with scheduled executions`);

    const response: ApiResponse = {
      success: true,
      data: {
        totalWorkflows: validExecutions.length,
        scheduledExecutions: validExecutions,
      },
    };

    res.json(response);
  })
);

// GET /api/executions - List executions
router.get(
  "/",
  authenticateToken,
  validateQuery(ExecutionQuerySchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      page = 1,
      limit = 10,
      workflowId,
      status,
      startedAfter,
      startedBefore,
    } = req.query as any;
    const offset = (page - 1) * limit;

    const filters = {
      workflowId,
      status,
      startDate: startedAfter ? new Date(startedAfter) : undefined,
      endDate: startedBefore ? new Date(startedBefore) : undefined,
      limit: parseInt(limit),
      offset: parseInt(offset.toString()),
    };

    const result = await getExecutionService().listExecutions(
      req.user!.id,
      filters
    );

    const response: ApiResponse = {
      success: true,
      data: result.executions,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };

    res.json(response);
  })
);

// GET /api/executions/:id - Get execution by ID
router.get(
  "/:id",
  authenticateToken,
  validateParams(IdParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const execution = await getExecutionService().getExecution(
      req.params.id,
      req.user!.id
    );

    if (!execution) {
      throw new AppError("Execution not found", 404, "EXECUTION_NOT_FOUND");
    }

    const response: ApiResponse = {
      success: true,
      data: execution,
    };

    res.json(response);
  })
);

// GET /api/executions/:id/progress - Get execution progress
router.get(
  "/:id/progress",
  authenticateToken,
  validateParams(IdParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const progress = await getExecutionService().getExecutionProgress(
      req.params.id,
      req.user!.id
    );

    if (!progress) {
      throw new AppError("Execution not found", 404, "EXECUTION_NOT_FOUND");
    }

    const response: ApiResponse = {
      success: true,
      data: progress,
    };

    res.json(response);
  })
);

// DELETE /api/executions/:id - Delete execution
router.delete(
  "/:id",
  authenticateToken,
  validateParams(IdParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await getExecutionService().deleteExecution(
      req.params.id,
      req.user!.id
    );

    if (!result.success) {
      const errorMessage =
        result.error?.message || "Failed to delete execution";
      const statusCode = errorMessage.includes("not found") ? 404 : 400;
      throw new AppError(errorMessage, statusCode, "EXECUTION_DELETE_FAILED");
    }

    const response: ApiResponse = {
      success: true,
      data: result.data,
    };

    res.json(response);
  })
);

// POST /api/executions/:id/cancel - Cancel execution
router.post(
  "/:id/cancel",
  authenticateToken,
  validateParams(IdParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await getExecutionService().cancelExecution(
      req.params.id,
      req.user!.id
    );

    if (!result.success) {
      const errorMessage =
        result.error?.message || "Failed to cancel execution";
      const statusCode = errorMessage.includes("not found") ? 404 : 400;
      throw new AppError(errorMessage, statusCode, "EXECUTION_CANCEL_FAILED");
    }

    const response: ApiResponse = {
      success: true,
      data: result.data,
    };

    res.json(response);
  })
);

// POST /api/executions/:id/retry - Retry execution
router.post(
  "/:id/retry",
  authenticateToken,
  validateParams(IdParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await getExecutionService().retryExecution(
      req.params.id,
      req.user!.id
    );

    if (!result.success) {
      const errorMessage = result.error?.message || "Failed to retry execution";
      const statusCode = errorMessage.includes("not found") ? 404 : 400;
      throw new AppError(errorMessage, statusCode, "EXECUTION_RETRY_FAILED");
    }

    const response: ApiResponse = {
      success: true,
      data: result.data,
    };

    res.status(201).json(response);
  })
);

// GET /api/executions/stats - Get execution statistics
router.get(
  "/stats",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await getExecutionService().getExecutionStats(req.user!.id);

    const response: ApiResponse = {
      success: true,
      data: stats,
    };

    res.json(response);
  })
);

// GET /api/executions/realtime/info - Get real-time monitoring info
router.get(
  "/realtime/info",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const socketService = global.socketService;

    const response: ApiResponse = {
      success: true,
      data: {
        websocketUrl: `ws://localhost:${process.env.PORT || 4000}`,
        connectedUsers: socketService
          ? socketService.getConnectedUsersCount()
          : 0,
        supportedEvents: [
          "execution-event",
          "execution-progress",
          "execution-log",
          "node-execution-event",
          "execution-status",
        ],
        subscriptionEvents: [
          "subscribe-execution",
          "unsubscribe-execution",
          "subscribe-workflow",
          "unsubscribe-workflow",
        ],
      },
    };

    res.json(response);
  })
);

// GET /api/executions/:id/subscribers - Get execution subscribers count
router.get(
  "/:id/subscribers",
  authenticateToken,
  validateParams(IdParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const socketService = global.socketService;
    const subscribersCount = socketService
      ? socketService.getExecutionSubscribersCount(req.params.id)
      : 0;

    const response: ApiResponse = {
      success: true,
      data: {
        executionId: req.params.id,
        subscribersCount,
      },
    };

    res.json(response);
  })
);

export { router as executionRoutes };
