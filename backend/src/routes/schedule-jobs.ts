import { PrismaClient } from "@prisma/client";
import { Response, Router } from "express";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { ApiResponse } from "../types/api";
import { logger } from "../utils/logger";

const router = Router();
const prisma = new PrismaClient();

// GET /api/schedule-jobs - List all schedule jobs for the user
router.get(
  "/",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const jobs = await global.scheduleJobManager.getAllScheduleJobs();
    
    // Filter jobs by user's workflows
    const userWorkflows = await prisma.workflow.findMany({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    
    const userWorkflowIds = new Set(userWorkflows.map((w) => w.id));
    const userJobs = jobs.filter((job) => userWorkflowIds.has(job.workflowId));

    const response: ApiResponse = {
      success: true,
      data: {
        total: userJobs.length,
        jobs: userJobs,
      },
    };

    res.json(response);
  })
);

// GET /api/schedule-jobs/workflow/:workflowId - Get jobs for a specific workflow
router.get(
  "/workflow/:workflowId",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { workflowId } = req.params;

    // Verify workflow belongs to user
    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        userId: req.user!.id,
      },
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: { message: "Workflow not found", code: "WORKFLOW_NOT_FOUND" },
      });
    }

    const jobs = await global.scheduleJobManager.getWorkflowScheduleJobs(workflowId);

    const response: ApiResponse = {
      success: true,
      data: jobs,
    };

    res.json(response);
  })
);

// POST /api/schedule-jobs/:jobId/pause - Pause a schedule job
router.post(
  "/:jobId/pause",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params;
    const [workflowId] = jobId.split("-");

    // Verify workflow belongs to user
    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        userId: req.user!.id,
      },
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: { message: "Workflow not found", code: "WORKFLOW_NOT_FOUND" },
      });
    }

    await global.scheduleJobManager.pauseScheduleJob(jobId);

    logger.info(`User ${req.user!.id} paused schedule job ${jobId}`);

    const response: ApiResponse = {
      success: true,
      data: { message: "Schedule job paused successfully" },
    };

    res.json(response);
  })
);

// POST /api/schedule-jobs/:jobId/resume - Resume a schedule job
router.post(
  "/:jobId/resume",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params;
    const [workflowId, triggerId] = jobId.split("-");

    // Verify workflow belongs to user
    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        userId: req.user!.id,
      },
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: { message: "Workflow not found", code: "WORKFLOW_NOT_FOUND" },
      });
    }

    await global.scheduleJobManager.resumeScheduleJob(workflowId, triggerId);

    logger.info(`User ${req.user!.id} resumed schedule job ${jobId}`);

    const response: ApiResponse = {
      success: true,
      data: { message: "Schedule job resumed successfully" },
    };

    res.json(response);
  })
);

// DELETE /api/schedule-jobs/:jobId - Delete a schedule job
router.delete(
  "/:jobId",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params;
    const [workflowId] = jobId.split("-");

    // Verify workflow belongs to user
    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        userId: req.user!.id,
      },
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: { message: "Workflow not found", code: "WORKFLOW_NOT_FOUND" },
      });
    }

    await global.scheduleJobManager.removeScheduleJob(jobId);

    logger.info(`User ${req.user!.id} deleted schedule job ${jobId}`);

    const response: ApiResponse = {
      success: true,
      data: { message: "Schedule job deleted successfully" },
    };

    res.json(response);
  })
);

// GET /api/schedule-jobs/stats - Get schedule job statistics
router.get(
  "/stats",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const allJobs = await global.scheduleJobManager.getAllScheduleJobs();
    
    // Filter jobs by user's workflows
    const userWorkflows = await prisma.workflow.findMany({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    
    const userWorkflowIds = new Set(userWorkflows.map((w) => w.id));
    const userJobs = allJobs.filter((job) => userWorkflowIds.has(job.workflowId));

    const stats = {
      total: userJobs.length,
      active: userJobs.filter((j) => j.status === 'active').length,
      paused: userJobs.filter((j) => j.status === 'paused').length,
      failed: userJobs.filter((j) => j.status === 'failed').length,
      nextExecution: userJobs
        .filter((j) => j.nextRun)
        .sort((a, b) => (a.nextRun!.getTime() - b.nextRun!.getTime()))[0],
    };

    const response: ApiResponse = {
      success: true,
      data: stats,
    };

    res.json(response);
  })
);

export { router as scheduleJobsRoutes };
