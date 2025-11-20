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

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

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

  /**
   * Extract triggers from trigger nodes in the workflow
   */
  private extractTriggersFromNodes(nodes: any[]): any[] {
    if (!Array.isArray(nodes)) {
      return [];
    }

    const nodeService = global.nodeService;
    if (!nodeService) {
      console.warn("NodeService not available, cannot extract triggers");
      return [];
    }

    return nodes
      .filter((node) => {
        const nodeDef = nodeService.getNodeDefinitionSync(node.type);
        return nodeDef?.triggerType !== undefined;
      })
      .map((node) => {
        const nodeDef = nodeService.getNodeDefinitionSync(node.type);
        const triggerType = nodeDef?.triggerType;
        
        return {
          id: `trigger-${node.id}`,
          type: triggerType,
          nodeId: node.id,
          active: !node.disabled,
          settings: {
            description: node.parameters?.description || `${triggerType} trigger`,
            ...node.parameters,
          },
        };
      });
  }

  /**
   * Normalize triggers to ensure they have the active property set
   */
  private normalizeTriggers(triggers: any[]): any[] {
    if (!Array.isArray(triggers)) {
      return [];
    }

    return triggers.map((trigger) => ({
      ...trigger,
      // Set active to true if not explicitly set
      active: trigger.active !== undefined ? trigger.active : true,
    }));
  }

  /**
   * Migrate existing workflows to ensure triggers have active property
   */
  async migrateTriggersActiveProperty(): Promise<{ updated: number }> {
    try {
      // Get all workflows
      const workflows = await this.prisma.workflow.findMany({
        select: {
          id: true,
          triggers: true,
        },
      });

      let updatedCount = 0;

      for (const workflow of workflows) {
        const triggers = workflow.triggers as any[];
        if (Array.isArray(triggers) && triggers.length > 0) {
          // Check if any trigger is missing the active property
          const needsUpdate = triggers.some(
            (trigger) => trigger.active === undefined
          );

          if (needsUpdate) {
            const normalizedTriggers = this.normalizeTriggers(triggers);

            await this.prisma.workflow.update({
              where: { id: workflow.id },
              data: {
                triggers: normalizedTriggers,
                updatedAt: new Date(),
              },
            });

            updatedCount++;
          }
        }
      }

      return { updated: updatedCount };
    } catch (error) {
      console.error("Error migrating triggers active property:", error);
      throw new AppError(
        "Failed to migrate triggers",
        500,
        "TRIGGER_MIGRATION_ERROR"
      );
    }
  }

  async createWorkflow(userId: string, data: CreateWorkflowRequest) {
    try {
      // Extract triggers from nodes if triggers array is empty or not provided
      let triggersToSave = data.triggers || [];
      if (data.nodes && triggersToSave.length === 0) {
        triggersToSave = this.extractTriggersFromNodes(data.nodes);
      }

      // Normalize triggers to ensure they have active property
      const normalizedTriggers = this.normalizeTriggers(triggersToSave);

      const workflow = await this.prisma.workflow.create({
        data: {
          name: data.name,
          description: data.description,
          category: data.category,
          tags: data.tags || [],
          userId,
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

  async updateWorkflow(
    id: string,
    userId: string,
    data: UpdateWorkflowRequest
  ) {
    try {
      // Check if workflow exists and belongs to user
      await this.getWorkflow(id, userId);

      // Validate workflow data if nodes or connections are being updated
      if (data.nodes || data.connections) {
        // Extract triggers from nodes if triggers array is empty or not provided
        let triggersToValidate = data.triggers;
        if (data.nodes && (!data.triggers || data.triggers.length === 0)) {
          triggersToValidate = this.extractTriggersFromNodes(data.nodes);
        }

        const workflowData = {
          nodes: data.nodes,
          connections: data.connections,
          triggers: triggersToValidate,
          settings: data.settings,
        };

        // Only validate if we have nodes data
        if (data.nodes) {
          const validation = await this.validateWorkflow(workflowData);
          if (!validation.isValid) {
            throw new AppError(
              `Workflow validation failed: ${validation.errors.join(", ")}`,
              400,
              "WORKFLOW_VALIDATION_ERROR"
            );
          }
        }
      }

      // Extract triggers from nodes if triggers array is empty or not provided
      let triggersToSave = data.triggers;
      if (data.nodes && (!data.triggers || data.triggers.length === 0)) {
        triggersToSave = this.extractTriggersFromNodes(data.nodes);
        console.log('🔍 Extracted triggers from nodes:', JSON.stringify(triggersToSave, null, 2));
      }

      // Normalize triggers if they are being updated
      const normalizedTriggers = triggersToSave
        ? this.normalizeTriggers(triggersToSave)
        : undefined;
      
      if (normalizedTriggers) {
        console.log('🔍 Normalized triggers:', JSON.stringify(normalizedTriggers, null, 2));
      }



      console.log('🔍 Updating workflow with settings:', data.settings);
      
      const workflow = await this.prisma.workflow.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.tags !== undefined && { tags: data.tags }),
          ...(data.nodes && { nodes: data.nodes as any }),
          ...(data.connections && { connections: data.connections as any }),
          ...(normalizedTriggers && { triggers: normalizedTriggers as any }),
          ...(data.settings !== undefined && { settings: data.settings as any }), // Changed to check undefined instead of truthy
          ...(data.active !== undefined && { active: data.active }),
          updatedAt: new Date(),
        },
      });
      
      console.log('✅ Workflow updated, settings saved:', workflow.settings);


      // Sync triggers with TriggerService if triggers or active status changed
      if (
        isTriggerServiceInitialized() &&
        (normalizedTriggers || data.active !== undefined)
      ) {
        try {
          console.log(`🔄 Syncing triggers for workflow ${id}...`);
          await getTriggerService().syncWorkflowTriggers(id);
          console.log(`✅ Triggers synced successfully for workflow ${id}`);
        } catch (error) {
          console.error(`❌ Error syncing triggers for workflow ${id}:`, error);
          // Don't fail the update if trigger sync fails
        }
      } else {
        console.log(`⏭️  Skipping trigger sync for workflow ${id}`, {
          triggerServiceInitialized: isTriggerServiceInitialized(),
          hasNormalizedTriggers: !!normalizedTriggers,
          hasActiveChange: data.active !== undefined,
        });
      }

      // Sync schedule jobs with ScheduleJobManager
      if (global.scheduleJobManager && (normalizedTriggers || data.active !== undefined)) {
        try {
          await global.scheduleJobManager.syncWorkflowJobs(id);
        } catch (error) {
          console.error(`Error syncing schedule jobs for workflow ${id}:`, error);
          // Don't fail the update if job sync fails
        }
      }

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

  async validateWorkflow(workflowData: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!workflowData.nodes || workflowData.nodes.length === 0) {
      errors.push("Workflow must contain at least one node");
      return { isValid: false, errors, warnings };
    }

    const nodeIds = new Set(workflowData.nodes.map((node: any) => node.id));
    const nodeIdArray = Array.from(nodeIds);

    // Check for duplicate node IDs
    if (nodeIdArray.length !== workflowData.nodes.length) {
      errors.push("Workflow contains duplicate node IDs");
    }

    // Validate individual nodes
    for (const node of workflowData.nodes) {
      if (!node.id || typeof node.id !== "string") {
        errors.push("All nodes must have a valid ID");
      }
      if (!node.type || typeof node.type !== "string") {
        errors.push(`Node ${node.id} must have a valid type`);
      }
      // Allow empty names for group nodes, but require valid string type
      if (node.type === "group") {
        if (typeof node.name !== "string") {
          errors.push(`Node ${node.id} must have a valid name`);
        }
      } else {
        if (!node.name || typeof node.name !== "string") {
          errors.push(`Node ${node.id} must have a valid name`);
        }
      }
      // Validate optional description field
      if (
        node.description !== undefined &&
        typeof node.description !== "string"
      ) {
        errors.push(
          `Node ${node.id} must have a valid description (string or undefined)`
        );
      }
      if (
        !node.position ||
        typeof node.position.x !== "number" ||
        typeof node.position.y !== "number"
      ) {
        errors.push(`Node ${node.id} must have valid position coordinates`);
      }
      if (!node.parameters || typeof node.parameters !== "object") {
        errors.push(`Node ${node.id} must have valid parameters object`);
      }
    }

    // Validate node connections
    const connectionIds = new Set();
    if (workflowData.connections && workflowData.connections.length > 0) {
      for (const connection of workflowData.connections) {
        // Check for duplicate connection IDs
        if (connectionIds.has(connection.id)) {
          errors.push(`Duplicate connection ID: ${connection.id}`);
        }
        connectionIds.add(connection.id);

        // Validate connection structure
        if (!connection.id || typeof connection.id !== "string") {
          errors.push("All connections must have a valid ID");
        }
        if (!connection.sourceNodeId || !nodeIds.has(connection.sourceNodeId)) {
          errors.push(
            `Invalid connection: source node ${connection.sourceNodeId} not found`
          );
        }
        if (!connection.targetNodeId || !nodeIds.has(connection.targetNodeId)) {
          errors.push(
            `Invalid connection: target node ${connection.targetNodeId} not found`
          );
        }
        if (
          !connection.sourceOutput ||
          typeof connection.sourceOutput !== "string"
        ) {
          errors.push(
            `Connection ${connection.id} must have a valid source output`
          );
        }
        if (
          !connection.targetInput ||
          typeof connection.targetInput !== "string"
        ) {
          errors.push(
            `Connection ${connection.id} must have a valid target input`
          );
        }

        // Check for self-connections
        if (connection.sourceNodeId === connection.targetNodeId) {
          errors.push(
            `Node ${connection.sourceNodeId} cannot connect to itself`
          );
        }
      }
    }

    // Check for circular dependencies
    const circularDependency = this.detectCircularDependencies(
      workflowData.nodes,
      workflowData.connections || []
    );
    if (circularDependency) {
      errors.push("Workflow contains circular dependencies");
    }

    // Check for orphaned nodes (nodes with no connections)
    if (workflowData.connections && workflowData.connections.length > 0) {
      const connectedNodes = new Set();
      workflowData.connections.forEach((conn: any) => {
        connectedNodes.add(conn.sourceNodeId);
        connectedNodes.add(conn.targetNodeId);
      });

      const orphanedNodes = nodeIdArray.filter(
        (nodeId) => !connectedNodes.has(nodeId)
      );
      if (orphanedNodes.length > 0) {
        warnings.push(`Orphaned nodes detected: ${orphanedNodes.join(", ")}`);
      }
    }

    // Validate triggers
    if (workflowData.triggers && workflowData.triggers.length > 0) {
      for (const trigger of workflowData.triggers) {
        if (!trigger.id || typeof trigger.id !== "string") {
          errors.push("All triggers must have a valid ID");
        }
        if (!trigger.type || typeof trigger.type !== "string") {
          errors.push(`Trigger ${trigger.id} must have a valid type`);
        }
        if (!trigger.nodeId || !nodeIds.has(trigger.nodeId)) {
          errors.push(
            `Trigger ${trigger.id} references non-existent node ${trigger.nodeId}`
          );
        }
      }
    }

    // Validate workflow settings
    if (workflowData.settings) {
      const settings = workflowData.settings;
      if (settings.timezone && typeof settings.timezone !== "string") {
        errors.push("Workflow timezone must be a valid string");
      }
      if (
        settings.saveExecutionProgress !== undefined &&
        typeof settings.saveExecutionProgress !== "boolean"
      ) {
        errors.push("saveExecutionProgress must be a boolean");
      }
      if (
        settings.saveDataErrorExecution !== undefined &&
        !["all", "none"].includes(settings.saveDataErrorExecution)
      ) {
        errors.push('saveDataErrorExecution must be "all" or "none"');
      }
      if (
        settings.saveDataSuccessExecution !== undefined &&
        !["all", "none"].includes(settings.saveDataSuccessExecution)
      ) {
        errors.push('saveDataSuccessExecution must be "all" or "none"');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private detectCircularDependencies(
    nodes: any[],
    connections: any[]
  ): boolean {
    const graph = new Map<string, string[]>();
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // Build adjacency list
    nodes.forEach((node) => graph.set(node.id, []));
    connections.forEach((conn) => {
      const sourceConnections = graph.get(conn.sourceNodeId) || [];
      sourceConnections.push(conn.targetNodeId);
      graph.set(conn.sourceNodeId, sourceConnections);
    });

    // DFS to detect cycles
    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) return true;
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Check each node for cycles
    for (const node of nodes) {
      if (!visited.has(node.id) && hasCycle(node.id)) {
        return true;
      }
    }

    return false;
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

  async getAvailableCategories(userId: string) {
    try {
      // Get categories from the database
      const categories = await this.prisma.category.findMany({
        where: {
          active: true,
        },
        select: {
          name: true,
          displayName: true,
          description: true,
          color: true,
          icon: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      // If no categories found in database, return some defaults
      if (categories.length === 0) {
        return [
          "automation",
          "integration",
          "communication",
          "data-processing",
          "other",
        ];
      }

      // Return just the category names for the API response
      // Frontend can fetch full category details if needed
      return categories.map((category) => category.name);
    } catch (error) {
      console.error("Error getting available categories:", error);
      throw new AppError(
        "Failed to get available categories",
        500,
        "CATEGORIES_FETCH_ERROR"
      );
    }
  }

  async createCategory(
    userId: string,
    categoryData: {
      name: string;
      displayName: string;
      description?: string;
      color?: string;
      icon?: string;
    }
  ) {
    try {
      // Check if category already exists
      const existingCategory = await this.prisma.category.findUnique({
        where: { name: categoryData.name },
      });

      if (existingCategory) {
        throw new AppError(
          "Category with this name already exists",
          400,
          "CATEGORY_EXISTS"
        );
      }

      // Create the category
      const category = await this.prisma.category.create({
        data: {
          name: categoryData.name.toLowerCase().replace(/\s+/g, "-"),
          displayName: categoryData.displayName,
          description: categoryData.description,
          color: categoryData.color || "#6B7280",
          icon: categoryData.icon || "📁",
          active: true,
        },
      });

      return category;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Error creating category:", error);
      throw new AppError(
        "Failed to create category",
        500,
        "CATEGORY_CREATE_ERROR"
      );
    }
  }

  async deleteCategory(userId: string, categoryName: string) {
    try {
      // Check if category exists
      const category = await this.prisma.category.findUnique({
        where: { name: categoryName },
      });

      if (!category) {
        throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
      }

      // Check if any workflows are using this category
      const workflowsWithCategory = await this.prisma.workflow.findFirst({
        where: {
          category: categoryName,
          userId: userId,
        },
      });

      if (workflowsWithCategory) {
        throw new AppError(
          "Cannot delete category that is being used by workflows",
          400,
          "CATEGORY_IN_USE"
        );
      }

      // Delete the category
      await this.prisma.category.delete({
        where: { name: categoryName },
      });

      return { message: "Category deleted successfully" };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Error deleting category:", error);
      throw new AppError(
        "Failed to delete category",
        500,
        "CATEGORY_DELETE_ERROR"
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
