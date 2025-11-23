import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import {
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  WorkflowQueryRequest,
} from "../types/api";
import {
  getTriggerService,
  isTriggerServiceInitialized,
} from "./triggerServiceSingleton";
import { validateWorkflow } from "../utils/workflowValidator";
import { prepareTriggersForSave } from "../utils/triggerUtils";

interface WorkflowFilters {
  search?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
}

export class WorkflowService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }





  async createWorkflow(userId: string, data: CreateWorkflowRequest) {
    try {
      // Prepare triggers (extract, convert, normalize)
      const normalizedTriggers = prepareTriggersForSave(data, global.nodeService) || [];

      const workflow = await this.prisma.workflow.create({
        data: {
          name: data.name,
          description: data.description,
          category: data.category,
          tags: data.tags || [],
          userId,
          teamId: data.teamId,
          nodes: data.nodes as any,
          connections: data.connections,
          triggers: normalizedTriggers,
          settings: data.settings,
          active: data.active,
        },
      });

      return workflow;
    } catch (error) {
      console.error("Error creating workflow:", error);
      throw new AppError(
        "Failed to create workflow",
        500,
        "WORKFLOW_CREATE_ERROR"
      );
    }
  }

  async getWorkflow(id: string, userId?: string) {
    try {
      const workflow = await this.prisma.workflow.findFirst({
        where: {
          id,
          ...(userId && { userId }),
        },
      });

      if (!workflow) {
        throw new AppError("Workflow not found", 404, "WORKFLOW_NOT_FOUND");
      }



      return workflow;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Error fetching workflow:", error);
      throw new AppError(
        "Failed to fetch workflow",
        500,
        "WORKFLOW_FETCH_ERROR"
      );
    }
  }

  /**
   * Validate workflow structure if nodes or connections are being updated
   */
  private async validateWorkflowUpdate(data: UpdateWorkflowRequest): Promise<void> {
    if (!data.nodes && !data.connections) {
      return;
    }

    // Only validate if we have nodes data
    if (data.nodes) {
      const triggersToValidate = prepareTriggersForSave(data, global.nodeService);
      
      const workflowData = {
        nodes: data.nodes,
        connections: data.connections,
        triggers: triggersToValidate,
        settings: data.settings,
      };

      const validation = validateWorkflow(workflowData);
      if (!validation.isValid) {
        throw new AppError(
          `Workflow validation failed: ${validation.errors.join(", ")}`,
          400,
          "WORKFLOW_VALIDATION_ERROR"
        );
      }
    }
  }

  /**
   * Build the update data object for Prisma
   */
  private buildUpdateData(data: UpdateWorkflowRequest, normalizedTriggers?: any[]): any {
    return {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.teamId !== undefined && { teamId: data.teamId }),
      ...(data.nodes && { nodes: data.nodes as any }),
      ...(data.connections && { connections: data.connections as any }),
      ...(normalizedTriggers && { triggers: normalizedTriggers as any }),
      ...(data.settings !== undefined && { settings: data.settings as any }),
      ...(data.active !== undefined && { active: data.active }),
      updatedAt: new Date(),
    };
  }

  /**
   * Sync triggers with TriggerService asynchronously
   */
  private syncTriggersAsync(workflowId: string, normalizedTriggers?: any[], activeChanged?: boolean): void {
    const shouldSync = normalizedTriggers || activeChanged;
    
    if (!isTriggerServiceInitialized() || !shouldSync) {
      console.log(`⏭️  Skipping trigger sync for workflow ${workflowId}`, {
        triggerServiceInitialized: isTriggerServiceInitialized(),
        hasNormalizedTriggers: !!normalizedTriggers,
        hasActiveChange: activeChanged,
      });
      return;
    }

    // Fire and forget - don't await
    getTriggerService()
      .syncWorkflowTriggers(workflowId)
      .then(() => {
        console.log(`✅ Triggers synced successfully for workflow ${workflowId}`);
      })
      .catch((error) => {
        console.error(`❌ Error syncing triggers for workflow ${workflowId}:`, error);
      });
    
    console.log(`🔄 Trigger sync initiated for workflow ${workflowId} (async)`);
  }

  /**
   * Sync schedule jobs with ScheduleJobManager asynchronously
   */
  private syncScheduleJobsAsync(workflowId: string, normalizedTriggers?: any[], activeChanged?: boolean): void {
    const shouldSync = normalizedTriggers || activeChanged;
    
    if (!global.scheduleJobManager || !shouldSync) {
      return;
    }

    // Fire and forget - don't await
    global.scheduleJobManager
      .syncWorkflowJobs(workflowId)
      .then(() => {
        console.log(`✅ Schedule jobs synced successfully for workflow ${workflowId}`);
      })
      .catch((error) => {
        console.error(`❌ Error syncing schedule jobs for workflow ${workflowId}:`, error);
      });
    
    console.log(`🔄 Schedule job sync initiated for workflow ${workflowId} (async)`);
  }

  async updateWorkflow(
    id: string,
    userId: string,
    data: UpdateWorkflowRequest
  ) {
    try {
      // Verify workflow exists and belongs to user
      await this.getWorkflow(id, userId);

      // Validate workflow structure if needed
      await this.validateWorkflowUpdate(data);

      // Prepare triggers for update
      const normalizedTriggers = prepareTriggersForSave(data, global.nodeService);

      // Build update data
      const updateData = this.buildUpdateData(data, normalizedTriggers);

      // Update workflow in database
      const workflow = await this.prisma.workflow.update({
        where: { id },
        data: updateData,
      });

      // Sync triggers and schedule jobs asynchronously
      const activeChanged = data.active !== undefined;
      this.syncTriggersAsync(id, normalizedTriggers, activeChanged);
      this.syncScheduleJobsAsync(id, normalizedTriggers, activeChanged);

      return workflow;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Error updating workflow:", error);
      throw new AppError(
        "Failed to update workflow",
        500,
        "WORKFLOW_UPDATE_ERROR"
      );
    }
  }

  async deleteWorkflow(id: string, userId: string) {
    try {
      // Check if workflow exists and belongs to user
      await this.getWorkflow(id, userId);

      await this.prisma.workflow.delete({
        where: { id },
      });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Error deleting workflow:", error);
      throw new AppError(
        "Failed to delete workflow",
        500,
        "WORKFLOW_DELETE_ERROR"
      );
    }
  }

  async listWorkflows(userId: string, query: WorkflowQueryRequest) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        sortBy = "updatedAt",
        sortOrder = "desc",
      } = query;
      const skip = (page - 1) * limit;

      const where: any = { userId };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const [workflows, total] = await Promise.all([
        this.prisma.workflow.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            tags: true,
            active: true,
            teamId: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                executions: true,
              },
            },
          },
        }),
        this.prisma.workflow.count({ where }),
      ]);

      return {
        workflows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("Error listing workflows:", error);
      throw new AppError(
        "Failed to list workflows",
        500,
        "WORKFLOW_LIST_ERROR"
      );
    }
  }

  async searchWorkflows(
    userId: string,
    filters: WorkflowFilters & {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        tags,
        createdAfter,
        createdBefore,
        sortBy = "updatedAt",
        sortOrder = "desc",
      } = filters;
      const skip = (page - 1) * limit;

      const where: any = { userId };

      // Text search across name and description
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      // Date range filters
      if (createdAfter || createdBefore) {
        where.createdAt = {};
        if (createdAfter) where.createdAt.gte = createdAfter;
        if (createdBefore) where.createdAt.lte = createdBefore;
      }

      // Tag filtering (if tags are stored in workflow settings or as separate field)
      if (tags && tags.length > 0) {
        where.settings = {
          path: ["tags"],
          array_contains: tags,
        };
      }

      const [workflows, total] = await Promise.all([
        this.prisma.workflow.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true,
            name: true,
            description: true,
            active: true,
            settings: true,
            nodes: true,
            connections: true,
            createdAt: true,
            updatedAt: true,
            userId: true,
            teamId: true,
            category: true,
            tags: true,
            _count: {
              select: {
                executions: true,
              },
            },
            executions: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                status: true,
                startedAt: true,
                finishedAt: true,
              },
            },
          },
        }),
        this.prisma.workflow.count({ where }),
      ]);

      return {
        workflows: workflows.map((workflow) => ({
          ...workflow,
          lastExecution: workflow.executions[0] || null,
          executions: undefined, // Remove the executions array, keep only lastExecution
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("Error searching workflows:", error);
      throw new AppError(
        "Failed to search workflows",
        500,
        "WORKFLOW_SEARCH_ERROR"
      );
    }
  }

  async duplicateWorkflow(id: string, userId: string, newName?: string) {
    try {
      const originalWorkflow = await this.getWorkflow(id, userId);

      const duplicatedWorkflow = await this.prisma.workflow.create({
        data: {
          name: newName || `${originalWorkflow.name} (Copy)`,
          description: originalWorkflow.description,
          userId,
          nodes: originalWorkflow.nodes as any,
          connections: originalWorkflow.connections as any,
          triggers: originalWorkflow.triggers as any,
          settings: originalWorkflow.settings as any,
          active: false, // Always create duplicates as inactive
        },
      });

      return duplicatedWorkflow;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Error duplicating workflow:", error);
      throw new AppError(
        "Failed to duplicate workflow",
        500,
        "WORKFLOW_DUPLICATE_ERROR"
      );
    }
  }



  async getWorkflowStats(userId: string) {
    try {
      const [
        totalWorkflows,
        activeWorkflows,
        totalExecutions,
        recentExecutions,
      ] = await Promise.all([
        this.prisma.workflow.count({ where: { userId } }),
        this.prisma.workflow.count({ where: { userId, active: true } }),
        this.prisma.execution.count({
          where: {
            workflow: { userId },
          },
        }),
        this.prisma.execution.count({
          where: {
            workflow: { userId },
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),
      ]);

      return {
        totalWorkflows,
        activeWorkflows,
        inactiveWorkflows: totalWorkflows - activeWorkflows,
        totalExecutions,
        recentExecutions,
      };
    } catch (error) {
      console.error("Error getting workflow stats:", error);
      throw new AppError(
        "Failed to get workflow statistics",
        500,
        "WORKFLOW_STATS_ERROR"
      );
    }
  }

  async bulkUpdateWorkflows(
    userId: string,
    workflowIds: string[],
    updates: Partial<UpdateWorkflowRequest>
  ) {
    try {
      // Verify all workflows belong to the user
      const workflows = await this.prisma.workflow.findMany({
        where: {
          id: { in: workflowIds },
          userId,
        },
        select: { id: true },
      });

      if (workflows.length !== workflowIds.length) {
        throw new AppError(
          "Some workflows not found or access denied",
          404,
          "WORKFLOWS_NOT_FOUND"
        );
      }

      const result = await this.prisma.workflow.updateMany({
        where: {
          id: { in: workflowIds },
          userId,
        },
        data: {
          ...(updates.active !== undefined && { active: updates.active }),
          ...(updates.description !== undefined && {
            description: updates.description,
          }),
          updatedAt: new Date(),
        },
      });

      return {
        updated: result.count,
        workflowIds,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Error bulk updating workflows:", error);
      throw new AppError(
        "Failed to bulk update workflows",
        500,
        "WORKFLOW_BULK_UPDATE_ERROR"
      );
    }
  }

  async bulkDeleteWorkflows(userId: string, workflowIds: string[]) {
    try {
      // Verify all workflows belong to the user
      const workflows = await this.prisma.workflow.findMany({
        where: {
          id: { in: workflowIds },
          userId,
        },
        select: { id: true },
      });

      if (workflows.length !== workflowIds.length) {
        throw new AppError(
          "Some workflows not found or access denied",
          404,
          "WORKFLOWS_NOT_FOUND"
        );
      }

      // Delete workflows (cascading will handle executions)
      const result = await this.prisma.workflow.deleteMany({
        where: {
          id: { in: workflowIds },
          userId,
        },
      });

      return {
        deleted: result.count,
        workflowIds,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Error bulk deleting workflows:", error);
      throw new AppError(
        "Failed to bulk delete workflows",
        500,
        "WORKFLOW_BULK_DELETE_ERROR"
      );
    }
  }



  /**
   * Get upcoming scheduled executions for a workflow
   */
  async getUpcomingExecutions(workflow: any, limit: number = 10) {
    try {
      const { getNextExecutionTimes, describeCronExpression } = await import(
        "../utils/cronUtils"
      );

      const triggers = (workflow.triggers as any[]) || [];
      const scheduleTriggers = triggers.filter((t) => {
        // If active is undefined, treat as true (for backwards compatibility)
        const isActive = t.active !== undefined ? t.active : true;
        return t.type === "schedule" && isActive;
      });

      if (scheduleTriggers.length === 0) {
        return {
          workflowId: workflow.id,
          workflowName: workflow.name,
          active: workflow.active,
          upcomingExecutions: [],
          message: "No active schedule triggers found",
        };
      }

      const upcomingExecutions: any[] = [];

      for (const trigger of scheduleTriggers) {
        const cronExpression = trigger.settings?.cronExpression;
        const timezone = trigger.settings?.timezone || "UTC";
        const scheduleMode = trigger.settings?.scheduleMode || "cron";

        if (!cronExpression) continue;

        try {
          const nextTimes = getNextExecutionTimes(cronExpression, limit, timezone);
          const description = describeCronExpression(cronExpression);

          upcomingExecutions.push({
            triggerId: trigger.id,
            triggerNodeId: trigger.nodeId,
            triggerType: "schedule",
            scheduleMode,
            cronExpression,
            timezone,
            description,
            nextExecutions: nextTimes,
          });
        } catch (error) {
          console.error(
            `Error calculating next execution times for trigger ${trigger.id}:`,
            error
          );
        }
      }

      return {
        workflowId: workflow.id,
        workflowName: workflow.name,
        active: workflow.active,
        upcomingExecutions,
        totalTriggers: scheduleTriggers.length,
      };
    } catch (error) {
      console.error("Error getting upcoming executions:", error);
      throw new AppError(
        "Failed to get upcoming executions",
        500,
        "UPCOMING_EXECUTIONS_ERROR"
      );
    }
  }
}
