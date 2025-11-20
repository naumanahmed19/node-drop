import apiClient from './api'
import type { WebhookRequestLog, WebhookRequestsResponse, WebhookStats } from '@/types/webhook'

export interface GetWebhookLogsParams {
  webhookId?: string
  limit?: number
  offset?: number
  status?: string
  type?: string
  startDate?: string
  endDate?: string
}

export const webhookService = {
  async getWebhookLogs(params: GetWebhookLogsParams): Promise<WebhookRequestsResponse> {
    const queryParams = new URLSearchParams()
    
    if (params.limit) queryParams.append('limit', params.limit.toString())
    if (params.offset) queryParams.append('offset', params.offset.toString())
    if (params.status) queryParams.append('status', params.status)
    if (params.startDate) queryParams.append('startDate', params.startDate)
    if (params.endDate) queryParams.append('endDate', params.endDate)

    const endpoint = params.webhookId 
      ? `/webhooks/${params.webhookId}/logs?${queryParams.toString()}`
      : `/webhook-logs?${queryParams.toString()}`
    
    const response = await apiClient.get(endpoint)
    return response.data
  },

  async getWebhookLog(logId: string): Promise<WebhookRequestLog> {
    const response = await apiClient.get(`/webhook-logs/${logId}`)
    return response.data
  },

  async getWebhookStats(webhookId: string): Promise<WebhookStats> {
    const response = await apiClient.get(`/webhooks/${webhookId}/stats`)
    return response.data
  },

  async deleteWebhookLogs(webhookId: string): Promise<void> {
    await apiClient.delete(`/webhooks/${webhookId}/logs`)
  },

  async getAllWebhookLogs(params?: Omit<GetWebhookLogsParams, 'webhookId'>): Promise<WebhookRequestsResponse> {
    const queryParams = new URLSearchParams()
    
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    if (params?.status) queryParams.append('status', params.status)
    if (params?.type) queryParams.append('type', params.type)
    if (params?.startDate) queryParams.append('startDate', params.startDate)
    if (params?.endDate) queryParams.append('endDate', params.endDate)

    const response = await apiClient.get(`/webhook-logs?${queryParams.toString()}`)
    return response.data
  }
}
