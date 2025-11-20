export interface WebhookRequestLog {
  id: string
  type: 'webhook' | 'form' | 'chat'
  webhookId: string
  workflowId: string
  userId: string
  timestamp: string
  method: string
  path: string
  headers: Record<string, string>
  body?: any
  query?: Record<string, any>
  ip: string
  userAgent?: string
  status: 'success' | 'rejected' | 'failed'
  reason?: string
  executionId?: string
  responseCode: number
  responseTime: number
  testMode: boolean
}

export interface WebhookStats {
  total: number
  last24h: number
  success: number
  rejected: number
  failed: number
  successRate: number
}

export interface WebhookRequestsResponse {
  logs: WebhookRequestLog[]
  total: number
}
