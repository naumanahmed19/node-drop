import { WorkflowNode, WorkflowConnection, NodeType, TemplateVariable } from '@/types'
import { apiClient as api } from './api'
import { detectVariablesInNodes } from '@/utils/templateVariables'

export interface CreateTemplateRequest {
  name: string
  displayName: string
  description: string
  icon?: string
  color?: string
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  group?: string[]
}

export interface TemplateNodeType extends NodeType {
  isTemplate: boolean
  templateData: {
    nodes: WorkflowNode[]
    connections: WorkflowConnection[]
    variables?: TemplateVariable[]
  }
}

export class TemplateService {
  private baseUrl = '/node-types/templates'

  /**
   * Create a new template from selected nodes
   */
  async createTemplate(data: CreateTemplateRequest): Promise<TemplateNodeType> {
    // Detect variables in the template nodes
    const detectedVariables = detectVariablesInNodes(data.nodes)
    const variables: TemplateVariable[] = Array.from(detectedVariables).map(varName => ({
      name: varName,
      displayName: varName.replace(/[_.$]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: `Value for ${varName}`,
      type: 'string' as const,
      required: true,
    }))

    console.log('📦 Creating template with detected variables:', variables)

    const response = await api.post<TemplateNodeType>(this.baseUrl, {
      type: data.name,
      displayName: data.displayName,
      name: data.displayName,
      description: data.description,
      icon: data.icon || '📦',
      color: data.color || '#6366f1',
      group: data.group || ['Templates'],
      version: 1,
      defaults: {},
      inputs: ['main'],
      outputs: ['main'],
      properties: [],
      isTemplate: true,
      templateData: {
        nodes: data.nodes,
        connections: data.connections,
        variables: variables.length > 0 ? variables : undefined,
      },
    })

    if (!response.success || !response.data) {
      throw new Error('Failed to create template')
    }

    return response.data
  }

  /**
   * Get all templates
   */
  async getTemplates(): Promise<TemplateNodeType[]> {
    const response = await api.get<TemplateNodeType[]>(this.baseUrl)

    if (!response.success) {
      throw new Error('Failed to fetch templates')
    }

    return response.data || []
  }

  /**
   * Get a specific template
   */
  async getTemplate(type: string): Promise<TemplateNodeType> {
    const response = await api.get<TemplateNodeType>(`${this.baseUrl}/${encodeURIComponent(type)}`)

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch template')
    }

    return response.data
  }

  /**
   * Delete a template
   */
  async deleteTemplate(type: string): Promise<void> {
    const response = await api.delete(`${this.baseUrl}/${encodeURIComponent(type)}`)

    if (!response.success) {
      throw new Error('Failed to delete template')
    }
  }

  /**
   * Update a template
   */
  async updateTemplate(type: string, data: Partial<CreateTemplateRequest>): Promise<TemplateNodeType> {
    const response = await api.patch<TemplateNodeType>(
      `${this.baseUrl}/${encodeURIComponent(type)}`,
      data
    )

    if (!response.success || !response.data) {
      throw new Error('Failed to update template')
    }

    return response.data
  }
}

export const templateService = new TemplateService()
