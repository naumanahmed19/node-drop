import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { WorkflowEnvironmentService } from "../services/WorkflowEnvironmentService";
import { EnvironmentType } from "../types/environment";
import { AppError } from "../utils/errors";

const router = Router();
const prisma = new PrismaClient();
const environmentService = new WorkflowEnvironmentService(prisma);

/**
 * GET /api/workflows/:workflowId/environments
 * Get all environments for a workflow
 */
router.get(
  "/workflows/:workflowId/environments",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workflowId } = req.params;
      const userId = req.user!.id;

      const environments = await environmentService.getWorkflowEnvironments(
        workflowId,
        userId
      );

      res.json({
        success: true,
        data: environments,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/workflows/:workflowId/environments/summary
 * Get summary of all environments
 */
router.get(
  "/workflows/:workflowId/environments/summary",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workflowId } = req.params;
      const userId = req.user!.id;

      const summaries = await environmentService.getEnvironmentSummaries(
        workflowId,
        userId
      );

      res.json({
        success: true,
        data: summaries,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/workflows/:workflowId/environments/:environment
 * Get a specific environment
 */
router.get(
  "/workflows/:workflowId/environments/:environment",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workflowId, environment } = req.params;
      const userId = req.user!.id;

      if (
        !Object.values(EnvironmentType).includes(environment as EnvironmentType)
      ) {
        throw new AppError("Invalid environment type", 400);
      }

      const env = await environmentService.getEnvironment(
        workflowId,
        environment as EnvironmentType,
        userId
      );

      if (!env) {
        throw new AppError("Environment not found", 404);
      }

      res.json({
        success: true,
        data: env,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/workflows/:workflowId/environments
 * Create a new environment
 */
router.post(
  "/workflows/:workflowId/environments",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workflowId } = req.params;
      const userId = req.user!.id;
      const { environment, version, deploymentNote } = req.body;

      if (!environment) {
        throw new AppError("Environment type is required", 400);
      }

      if (!Object.values(EnvironmentType).includes(environment)) {
        throw new AppError("Invalid environment type", 400);
      }

      const newEnvironment = await environmentService.createEnvironment(
        userId,
        {
          workflowId,
          environment,
          version,
          deploymentNote,
        }
      );

      res.status(201).json({
        success: true,
        data: newEnvironment,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/workflows/:workflowId/environments/deploy
 * Deploy from one environment to another
 */
router.post(
  "/workflows/:workflowId/environments/deploy",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workflowId } = req.params;
      const userId = req.user!.id;
      const {
        sourceEnvironment,
        targetEnvironment,
        version,
        deploymentNote,
        copyVariables,
        activateAfterDeploy,
      } = req.body;

      if (!sourceEnvironment || !targetEnvironment) {
        throw new AppError("Source and target environments are required", 400);
      }

      if (
        !Object.values(EnvironmentType).includes(sourceEnvironment) ||
        !Object.values(EnvironmentType).includes(targetEnvironment)
      ) {
        throw new AppError("Invalid environment type", 400);
      }

      const result = await environmentService.deployToEnvironment(
        workflowId,
        userId,
        {
          sourceEnvironment,
          targetEnvironment,
          version,
          deploymentNote,
          copyVariables,
          activateAfterDeploy,
        }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/workflows/:workflowId/environments/:environment/update
 * Update environment with current workflow state
 */
router.post(
  "/workflows/:workflowId/environments/:environment/update",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workflowId, environment } = req.params;
      const userId = req.user!.id;
      const { version, deploymentNote, copyVariables } = req.body;

      if (
        !Object.values(EnvironmentType).includes(environment as EnvironmentType)
      ) {
        throw new AppError("Invalid environment type", 400);
      }

      const result = await environmentService.updateEnvironment(
        workflowId,
        userId,
        {
          environment: environment as EnvironmentType,
          version,
          deploymentNote,
          copyVariables,
        }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/workflows/:workflowId/environments/:environment/promote
 * Promote environment to next level
 */
router.post(
  "/workflows/:workflowId/environments/:environment/promote",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workflowId, environment } = req.params;
      const userId = req.user!.id;
      const { version, deploymentNote, activateAfterDeploy } = req.body;

      if (
        !Object.values(EnvironmentType).includes(environment as EnvironmentType)
      ) {
        throw new AppError("Invalid environment type", 400);
      }

      const result = await environmentService.promoteEnvironment(
        workflowId,
        environment as EnvironmentType,
        userId,
        {
          version,
          deploymentNote,
          activateAfterDeploy,
        }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/workflows/:workflowId/environments/:environment/rollback
 * Rollback environment to previous deployment
 */
router.post(
  "/workflows/:workflowId/environments/:environment/rollback",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workflowId, environment } = req.params;
      const userId = req.user!.id;
      const { deploymentId, deploymentNote } = req.body;

      if (!deploymentId) {
        throw new AppError("Deployment ID is required", 400);
      }

      if (
        !Object.values(EnvironmentType).includes(environment as EnvironmentType)
      ) {
        throw new AppError("Invalid environment type", 400);
      }

      const result = await environmentService.rollbackEnvironment(
        workflowId,
        environment as EnvironmentType,
        userId,
        {
          deploymentId,
          deploymentNote,
        }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/workflows/:workflowId/environments/:environment/deployments
 * Get deployment history
 */
router.get(
  "/workflows/:workflowId/environments/:environment/deployments",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workflowId, environment } = req.params;
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (
        !Object.values(EnvironmentType).includes(environment as EnvironmentType)
      ) {
        throw new AppError("Invalid environment type", 400);
      }

      const history = await environmentService.getDeploymentHistory(
        workflowId,
        environment as EnvironmentType,
        userId,
        page,
        limit
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/workflows/:workflowId/environments/compare
 * Compare two environments
 */
router.get(
  "/workflows/:workflowId/environments/compare",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workflowId } = req.params;
      const userId = req.user!.id;
      const { source, target } = req.query;

      if (!source || !target) {
        throw new AppError("Source and target environments are required", 400);
      }

      if (
        !Object.values(EnvironmentType).includes(source as EnvironmentType) ||
        !Object.values(EnvironmentType).includes(target as EnvironmentType)
      ) {
        throw new AppError("Invalid environment type", 400);
      }

      const comparison = await environmentService.compareEnvironments(
        workflowId,
        source as EnvironmentType,
        target as EnvironmentType,
        userId
      );

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/workflows/:workflowId/environments/:environment/activate
 * Activate an environment
 */
router.put(
  "/workflows/:workflowId/environments/:environment/activate",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workflowId, environment } = req.params;
      const userId = req.user!.id;

      if (
        !Object.values(EnvironmentType).includes(environment as EnvironmentType)
      ) {
        throw new AppError("Invalid environment type", 400);
      }

      const result = await environmentService.activateEnvironment(
        workflowId,
        environment as EnvironmentType,
        userId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/workflows/:workflowId/environments/:environment/deactivate
 * Deactivate an environment
 */
router.put(
  "/workflows/:workflowId/environments/:environment/deactivate",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workflowId, environment } = req.params;
      const userId = req.user!.id;

      if (
        !Object.values(EnvironmentType).includes(environment as EnvironmentType)
      ) {
        throw new AppError("Invalid environment type", 400);
      }

      const result = await environmentService.deactivateEnvironment(
        workflowId,
        environment as EnvironmentType,
        userId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/workflows/:workflowId/environments/:environment
 * Delete an environment
 */
router.delete(
  "/workflows/:workflowId/environments/:environment",
  authenticateToken,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workflowId, environment } = req.params;
      const userId = req.user!.id;

      if (
        !Object.values(EnvironmentType).includes(environment as EnvironmentType)
      ) {
        throw new AppError("Invalid environment type", 400);
      }

      await environmentService.deleteEnvironment(
        workflowId,
        environment as EnvironmentType,
        userId
      );

      res.json({
        success: true,
        message: "Environment deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
