import {
  ApiResponse,
  NodeType,
  PaginatedResponse,
  Workflow,
  WorkflowAnalytics,
  WorkflowImportExport,
  WorkflowShare,
  WorkflowTemplate,
} from "@/types";
import { apiClient as api } from "./api";

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  teamId?: string;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  nodes?: any[];
  connections?: any[];
  settings?: any;
  active?: boolean;
  tags?: string[];
  category?: string;
  isPublic?: boolean;
  teamId?: string | null;
}

export interface WorkflowFilters {
  search?: string;
  tags?: string[];
  category?: string;
  active?: boolean;
  isTemplate?: boolean;
  isPublic?: boolean;
  sortBy?: "name" | "createdAt" | "updatedAt" | "popularity" | "executions";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

class WorkflowService {
  async getWorkflows(
    filters?: WorkflowFilters
  ): Promise<PaginatedResponse<Workflow>> {
    const response = await api.get<Workflow[]>("/workflows", {
      params: filters,
    });

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to fetch workflows");
    }



    // The API returns the response in this format:
    // { success: true, data: [...], pagination: {...} }
    // But TypeScript sees it as ApiResponse<T> which only has data property
    // We need to cast it to access pagination
    const apiResponse = response as any;

    return {
      data: apiResponse.data || [],
      total: apiResponse.pagination?.total || 0,
      page: apiResponse.pagination?.page || 1,
      limit: apiResponse.pagination?.limit || 10,
      totalPages: apiResponse.pagination?.totalPages || 1,
    };
  }

  async getWorkflow(id: string): Promise<Workflow> {
    const response = await api.get<Workflow>(`/workflows/${id}`);

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to fetch workflow");
    }

    if (!response.data) {
      throw new Error("No workflow data received");
    }

    return response.data;
  }

  async createWorkflow(data: CreateWorkflowRequest): Promise<Workflow> {
    const response = await api.post<Workflow>("/workflows", data);

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to create workflow");
    }

    if (!response.data) {
      throw new Error("No workflow data received");
    }

    return response.data;
  }

  async updateWorkflow(
    id: string,
    data: UpdateWorkflowRequest
  ): Promise<Workflow> {
    const response = await api.put<Workflow>(
      `/workflows/${id}`,
      data
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to update workflow");
    }

    return response.data;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await api.delete(`/workflows/${id}`);
  }

  async duplicateWorkflow(id: string, name: string): Promise<Workflow> {
    const response = await api.post<Workflow>(
      `/workflows/${id}/duplicate`,
      { name }
    );

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to duplicate workflow");
    }

    if (!response.data) {
      throw new Error("No workflow data received");
    }

    return response.data;
  }

  async activateWorkflow(id: string): Promise<Workflow> {
    const response = await api.post<Workflow>(
      `/workflows/${id}/activate`
    );

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to activate workflow");
    }

    if (!response.data) {
      throw new Error("No workflow data received");
    }

    return response.data;
  }

  async deactivateWorkflow(id: string): Promise<Workflow> {
    const response = await api.post<Workflow>(
      `/workflows/${id}/deactivate`
    );

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to deactivate workflow");
    }

    if (!response.data) {
      throw new Error("No workflow data received");
    }

    return response.data;
  }

  async getNodeTypes(): Promise<NodeType[]> {
    const response = await api.get<PaginatedResponse<NodeType>>("/nodes");

    if (!response.data) {
      throw new Error("No node types data received");
    }

    return response.data as unknown as NodeType[];
  }

  async validateWorkflow(
    workflow: Partial<Workflow>
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const response = await api.post<{ isValid: boolean; errors: string[] }>(
      "/workflows/validate",
      workflow
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to validate workflow");
    }

    return response.data;
  }

  // Template management
  async getTemplates(
    filters?: Partial<WorkflowFilters>
  ): Promise<PaginatedResponse<WorkflowTemplate>> {
    const response = await api.get<{
      data: WorkflowTemplate[];
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>("/workflows/templates", {
      params: filters,
    });

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to fetch templates");
    }

    return {
      data: response.data?.data || [],
      total: response.data?.pagination?.total || 0,
      page: response.data?.pagination?.page || 1,
      limit: response.data?.pagination?.limit || 10,
      totalPages: response.data?.pagination?.totalPages || 1,
    };
  }

  async createFromTemplate(
    templateId: string,
    name: string
  ): Promise<Workflow> {
    const response = await api.post<Workflow>(
      `/workflows/templates/${templateId}/create`,
      { name }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to create from template");
    }

    return response.data;
  }

  async publishAsTemplate(
    id: string,
    templateData: Partial<WorkflowTemplate>
  ): Promise<WorkflowTemplate> {
    const response = await api.post<WorkflowTemplate>(
      `/workflows/${id}/publish-template`,
      templateData
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to publish as template");
    }

    return response.data;
  }

  // Sharing and collaboration
  async shareWorkflow(
    id: string,
    shares: Omit<WorkflowShare, "sharedAt">[]
  ): Promise<Workflow> {
    const response = await api.post<Workflow>(
      `/workflows/${id}/share`,
      { shares }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to share workflow");
    }

    return response.data;
  }

  async updateWorkflowShare(
    id: string,
    userId: string,
    permission: WorkflowShare["permission"]
  ): Promise<Workflow> {
    const response = await api.put<Workflow>(
      `/workflows/${id}/share/${userId}`,
      { permission }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to update workflow share");
    }

    return response.data;
  }

  async removeWorkflowShare(id: string, userId: string): Promise<Workflow> {
    const response = await api.delete<Workflow>(
      `/workflows/${id}/share/${userId}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to remove workflow share");
    }

    return response.data;
  }

  async getSharedWorkflows(): Promise<PaginatedResponse<Workflow>> {
    const response = await api.get<{
      data: Workflow[];
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>("/workflows/shared");

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to fetch shared workflows");
    }

    return {
      data: response.data?.data || [],
      total: response.data?.pagination?.total || 0,
      page: response.data?.pagination?.page || 1,
      limit: response.data?.pagination?.limit || 10,
      totalPages: response.data?.pagination?.totalPages || 1,
    };
  }

  // Import/Export
  async exportWorkflow(id: string): Promise<WorkflowImportExport> {
    const response = await api.get<WorkflowImportExport>(
      `/workflows/${id}/export`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to export workflow");
    }

    return response.data;
  }

  async importWorkflow(
    workflowData: WorkflowImportExport,
    name?: string
  ): Promise<Workflow> {
    const response = await api.post<Workflow>(
      "/workflows/import",
      {
        workflowData,
        name,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to import workflow");
    }

    return response.data;
  }

  // Analytics
  async getWorkflowAnalytics(id: string): Promise<WorkflowAnalytics> {
    const response = await api.get<WorkflowAnalytics>(
      `/workflows/${id}/analytics`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to fetch workflow analytics");
    }

    return response.data;
  }

  // Tags and categories
  async getAvailableTags(): Promise<string[]> {
    const response = await api.get<{ data: string[] }>("/workflows/tags");

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to fetch available tags");
    }

    return response.data?.data || [];
  }

  async getAvailableCategories(): Promise<string[]> {
    const response = await api.get<string[]>("/workflows/categories");

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to fetch available categories");
    }

    return response.data || [];
  }

  async createCategory(categoryData: {
    name: string;
    displayName: string;
    description?: string;
    color?: string;
    icon?: string;
  }): Promise<any> {
    const response = await api.post<ApiResponse<any>>(
      "/workflows/categories",
      categoryData
    );
    return response.data;
  }

  async deleteCategory(categoryName: string): Promise<void> {
    await api.delete(
      `/workflows/categories/${encodeURIComponent(categoryName)}`
    );
  }

  async updateWorkflowTags(id: string, tags: string[]): Promise<Workflow> {
    const response = await api.put<Workflow>(`/workflows/${id}/tags`, { tags });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to update workflow tags");
    }

    return response.data;
  }

  // WorkflowTrigger node specific methods
  async getWorkflowsForTrigger(): Promise<
    ApiResponse<import("@/types/workflow").WorkflowOption[]>
  > {
    const response = await api.get<import("@/types/workflow").WorkflowOption[]>(
      "/workflows/for-trigger"
    );
    return response;
  }

  async getWorkflowTriggers(
    workflowId: string
  ): Promise<ApiResponse<import("@/types/workflow").TriggerOption[]>> {
    const response = await api.get<import("@/types/workflow").TriggerOption[]>(
      `/workflows/${workflowId}/triggers`
    );
    return response;
  }
}

export const workflowService = new WorkflowService();
