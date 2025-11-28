import { NodeType } from "@/types";
import { apiClient } from "./api";

export interface TestNodeRequest {
  parameters: Record<string, any>;
  inputData: any;
  credentials?: string[];
}

export interface TestNodeResponse {
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
}

export class NodeService {
  async getNodeTypes(): Promise<NodeType[]> {
    // Use /node-types endpoint to get data from database with active status
    const response: any = await apiClient.get("/node-types");

    if (!response.success) {
      throw new Error("Failed to fetch node types");
    }

    // response.data contains the NodeType[] array from database
    const nodeTypesArray: NodeType[] = response.data || [];
    return nodeTypesArray;
  }

  async getNodeType(type: string): Promise<NodeType> {
    const response = await apiClient.get<NodeType>(`/nodes/${type}`);
    if (!response.success || !response.data) {
      throw new Error("Failed to fetch node type");
    }
    return response.data;
  }

  async testNode(
    nodeType: string,
    request: TestNodeRequest
  ): Promise<TestNodeResponse> {
    const response = await apiClient.post<any>(
      `/nodes/${nodeType}/execute`,
      request
    );
    // Backend returns { success: true/false, data: {...}, error: {...} }
    return {
      success: response.success || false,
      data: response.data,
      error: typeof response.error === 'string' ? response.error : response.error?.message,
    };
  }

  async validateNodeParameters(
    nodeType: string,
    parameters: Record<string, any>
  ): Promise<{
    isValid: boolean;
    errors: Array<{ field: string; message: string }>;
  }> {
    const response = await apiClient.post<{
      isValid: boolean;
      errors: Array<{ field: string; message: string }>;
    }>(`/nodes/${nodeType}/validate`, { parameters });

    return response.data || { isValid: false, errors: [] };
  }

  async getNodeDocumentation(nodeType: string): Promise<{
    description: string;
    examples: any[];
    properties: any[];
  }> {
    const response = await apiClient.get<{
      description: string;
      examples: any[];
      properties: any[];
    }>(`/node-types/${nodeType}/docs`);

    return response.data || { description: "", examples: [], properties: [] };
  }
}

export const nodeService = new NodeService();
