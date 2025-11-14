import { PrismaClient } from "@prisma/client";
import { Response, Router } from "express";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validation";
import { WorkflowService } from "../services/WorkflowService";
import {
  ApiResponse,
  CreateWorkflowSchema,
  IdParamSchema,
  UpdateWorkflowSchema,
  WorkflowQuerySchema,
} from "../types/api";

const router = Router();
const prisma = new PrismaClient();
const workflowService = new WorkflowService(prisma);

// POST /api/workflows/migrate-triggers - Migrate existing workflows to add active property to triggers
router.post(
  "/migrate-triggers",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await workflowService.migrateTriggersActiveProperty();

    const response: ApiResponse = {
      success: true,
      data: {
        ...result,
        message: `Updated ${result.updated} workflows`,
      },
    };

    res.json(response);
  })
);

// GET /api/workflows/for-trigger - Get workflows with active triggers for triggering
router.get(
  "/for-trigger",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get workflows with triggers field included
    const workflows = await prisma.workflow.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        description: true,
        active: true,
        triggers: true,
      },
    });

    // Filter workflows that have active triggers and format for node options
    const workflowOptions = workflows
      .filter((workflow: any) => {
        const triggers = (workflow.triggers as any[]) || [];
        return triggers.some((trigger: any) => trigger.active === true);
      })
      .map((workflow: any) => ({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        active: workflow.active,
        triggers: ((workflow.triggers as any[]) || [])
          .filter((trigger: any) => trigger.active === true)
          .map((trigger: any) => ({
            id: trigger.id,
            type: trigger.type,
            nodeId: trigger.nodeId,
            description:
              trigger.settings?.description || `${trigger.type} trigger`,
          })),
      }));

    const response: ApiResponse = {
      success: true,
      data: workflowOptions,
    };

    res.json(response);
  })
);

// GET /api/workflows/:id/triggers - Get triggers for a specific workflow
router.get(
  "/:id/triggers",
  authenticateToken,
  validateParams(IdParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const workflow = await workflowService.getWorkflow(
      req.params.id,
      req.user!.id
    );

    const triggers = ((workflow.triggers as any[]) || [])
      .filter((trigger: any) => trigger.active === true)
      .map((trigger: any) => ({
        id: trigger.id,
        type: trigger.type,
        nodeId: trigger.nodeId,
        description: trigger.settings?.description || `${trigger.type} trigger`,
        settings: trigger.settings,
      }));

    const response: ApiResponse = {
      success: true,
      data: triggers,
    };

    res.json(response);
  })
);

// GET /api/workflows/:id/upcoming-executions - Get upcoming scheduled executions
router.get(
  "/:id/upcoming-executions",
  authenticateToken,
  validateParams(IdParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const workflow = await workflowService.getWorkflow(
      req.params.id,
      req.user!.id
    );

    const limit = parseInt(req.query.limit as string) || 10;
    const upcomingExecutions = await workflowService.getUpcomingExecutions(
      workflow,
      limit
    );

    const response: ApiResponse = {
      success: true,
      data: upcomingExecutions,
    };

    res.json(response);
  })
);

// GET /api/workflows/categories - Get available workflow categories
router.get(
  "/categories",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const categories = await workflowService.getAvailableCategories(
      req.user!.id
    );

    const response: ApiResponse = {
      success: true,
      data: categories,
    };

    res.json(response);
  })
);

// POST /api/workflows/categories - Create a new category
router.post(
  "/categories",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const category = await workflowService.createCategory(
      req.user!.id,
      req.body
    );

    const response: ApiResponse = {
      success: true,
      data: category,
    };

    res.status(201).json(response);
  })
);

// DELETE /api/workflows/categories/:name - Delete a category
router.delete(
  "/categories/:name",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await workflowService.deleteCategory(
      req.user!.id,
      req.params.name
    );

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    res.json(response);
  })
);

// GET /api/workflows - List workflows
router.get(
  "/",
  authenticateToken,
  validateQuery(WorkflowQuerySchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await workflowService.listWorkflows(
      req.user!.id,
      req.query as any
    );

    const response: ApiResponse = {
      success: true,
      data: result.workflows,
      pagination: result.pagination,
    };

    res.json(response);
  })
);

// POST /api/workflows - Create workflow
router.post(
  "/",
  authenticateToken,
  validateBody(CreateWorkflowSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const workflow = await workflowService.createWorkflow(
      req.user!.id,
      req.body
    );

    const response: ApiResponse = {
      success: true,
      data: workflow,
    };

    res.status(201).json(response);
  })
);

// GET /api/workflows/:id - Get workflow by ID
router.get(
  "/:id",
  authenticateToken,
  validateParams(IdParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const workflow = await workflowService.getWorkflow(
      req.params.id,
      req.user!.id
    );

    const response: ApiResponse = {
      success: true,
      data: workflow,
    };

    res.json(response);
  })
);

// PUT /api/workflows/:id - Update workflow
router.put(
  "/:id",
  authenticateToken,
  validateParams(IdParamSchema),
  validateBody(UpdateWorkflowSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const workflow = await workflowService.updateWorkflow(
      req.params.id,
      req.user!.id,
      req.body
    );

    const response: ApiResponse = {
      success: true,
      data: workflow,
    };

    res.json(response);
  })
);

// DELETE /api/workflows/:id - Delete workflow
router.delete(
  "/:id",
  authenticateToken,
  validateParams(IdParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await workflowService.deleteWorkflow(req.params.id, req.user!.id);

    const response: ApiResponse = {
      success: true,
      data: { message: "Workflow deleted successfully" },
    };

    res.json(response);
  })
);

// POST /api/workflows/:id/duplicate - Duplicate workflow
router.post(
  "/:id/duplicate",
  authenticateToken,
  validateParams(IdParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name } = req.body;
    const workflow = await workflowService.duplicateWorkflow(
      req.params.id,
      req.user!.id,
      name
    );

    const response: ApiResponse = {
      success: true,
      data: workflow,
    };

    res.status(201).json(response);
  })
);

// POST /api/workflows/:id/validate - Validate workflow
router.post(
  "/:id/validate",
  authenticateToken,
  validateParams(IdParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const workflow = await workflowService.getWorkflow(
      req.params.id,
      req.user!.id
    );
    const validation = await workflowService.validateWorkflow(workflow);

    const response: ApiResponse = {
      success: true,
      data: validation,
    };

    res.json(response);
  })
);

export { router as workflowRoutes };
