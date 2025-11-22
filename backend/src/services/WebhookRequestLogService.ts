import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'

export interface WebhookRequestLogData {
  type?: 'webhook' | 'form' | 'chat' // Type of request (defaults to 'webhook')
  webhookId: string // Generic ID (webhook ID, form ID, or chat ID)
  workflowId: string
  userId: string
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
  testMode?: boolean
}

export class WebhookRequestLogService {
  private prisma: PrismaClient
  private maxBodySize = 10000 // 10KB max body size
  private maxLogsPerWebhook = 100
  private retentionDays = 7

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Log a request (webhook, form, or chat)
   */
  async logRequest(data: WebhookRequestLogData): Promise<void> {
    try {
      // Sanitize headers (remove sensitive data)
      const sanitizedHeaders = this.sanitizeHeaders(data.headers)
      
      // Truncate body if too large
      const truncatedBody = this.truncateBody(data.body)
      
      // Create log entry
      await this.prisma.webhookRequestLog.create({
        data: {
          type: data.type || 'webhook', // Default to 'webhook' for backward compatibility
          webhookId: data.webhookId,
          workflowId: data.workflowId,
          userId: data.userId,
          method: data.method,
          path: data.path,
          headers: sanitizedHeaders,
          body: truncatedBody,
          query: data.query,
          ip: data.ip,
          userAgent: data.userAgent,
          status: data.status,
          reason: data.reason,
          executionId: data.executionId,
          responseCode: data.responseCode,
          responseTime: data.responseTime,
          testMode: data.testMode || false,
        },
      })
      
      // Cleanup old logs (async, don't wait)
      this.cleanupOldLogs(data.webhookId).catch(err => {
        logger.error('Error cleaning up old webhook logs:', err)
      })
    } catch (error) {
      // Don't fail the webhook if logging fails
      logger.error('Error logging webhook request:', error)
    }
  }

  /**
   * Get logs for a specific ID (webhook, form, or chat)
   */
  async getLogsForWebhook(
    webhookId: string,
    userId: string,
    options?: {
      limit?: number
      offset?: number
      status?: string
      startDate?: Date
      endDate?: Date
      type?: 'webhook' | 'form' | 'chat' // Filter by type
    }
  ) {
    const limit = options?.limit || 50
    const offset = options?.offset || 0
    
    const where: any = {
      webhookId,
      userId, // Ensure user can only see their own logs
    }
    
    if (options?.type) {
      where.type = options.type
    }
    
    if (options?.status) {
      where.status = options.status
    }
    
    if (options?.startDate || options?.endDate) {
      where.timestamp = {}
      if (options.startDate) {
        where.timestamp.gte = options.startDate
      }
      if (options.endDate) {
        where.timestamp.lte = options.endDate
      }
    }
    
    const [logs, total] = await Promise.all([
      this.prisma.webhookRequestLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.webhookRequestLog.count({ where }),
    ])
    
    return { logs, total }
  }

  /**
   * Get all logs for a user
   */
  async getAllLogsForUser(
    userId: string,
    options?: {
      limit?: number
      offset?: number
      status?: string
      startDate?: Date
      endDate?: Date
      type?: 'webhook' | 'form' | 'chat' // Filter by type
    }
  ) {
    const limit = options?.limit || 50
    const offset = options?.offset || 0
    
    const where: any = {
      userId,
    }
    
    if (options?.type) {
      where.type = options.type
    }
    
    if (options?.status) {
      where.status = options.status
    }
    
    if (options?.startDate || options?.endDate) {
      where.timestamp = {}
      if (options.startDate) {
        where.timestamp.gte = options.startDate
      }
      if (options.endDate) {
        where.timestamp.lte = options.endDate
      }
    }
    
    const [logs, total] = await Promise.all([
      this.prisma.webhookRequestLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.webhookRequestLog.count({ where }),
    ])
    
    return { logs, total }
  }

  /**
   * Get logs for a workflow
   */
  async getLogsForWorkflow(
    workflowId: string,
    userId: string,
    options?: {
      limit?: number
      offset?: number
    }
  ) {
    const limit = options?.limit || 50
    const offset = options?.offset || 0
    
    const [logs, total] = await Promise.all([
      this.prisma.webhookRequestLog.findMany({
        where: {
          workflowId,
          userId,
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.webhookRequestLog.count({
        where: { workflowId, userId },
      }),
    ])
    
    return { logs, total }
  }

  /**
   * Get a single log entry
   */
  async getLog(logId: string, userId: string) {
    return this.prisma.webhookRequestLog.findFirst({
      where: {
        id: logId,
        userId, // Ensure user can only see their own logs
      },
    })
  }

  /**
   * Get statistics for a webhook
   */
  async getWebhookStats(webhookId: string, userId: string) {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    const [total, last24hCount, successCount, rejectedCount, failedCount] = await Promise.all([
      this.prisma.webhookRequestLog.count({
        where: { webhookId, userId },
      }),
      this.prisma.webhookRequestLog.count({
        where: {
          webhookId,
          userId,
          timestamp: { gte: last24h },
        },
      }),
      this.prisma.webhookRequestLog.count({
        where: { webhookId, userId, status: 'success' },
      }),
      this.prisma.webhookRequestLog.count({
        where: { webhookId, userId, status: 'rejected' },
      }),
      this.prisma.webhookRequestLog.count({
        where: { webhookId, userId, status: 'failed' },
      }),
    ])
    
    return {
      total,
      last24h: last24hCount,
      success: successCount,
      rejected: rejectedCount,
      failed: failedCount,
      successRate: total > 0 ? (successCount / total) * 100 : 0,
    }
  }

  /**
   * Delete logs for a webhook
   */
  async deleteLogsForWebhook(webhookId: string, userId: string) {
    await this.prisma.webhookRequestLog.deleteMany({
      where: { webhookId, userId },
    })
  }

  /**
   * Cleanup old logs (keep only last N per webhook)
   */
  private async cleanupOldLogs(webhookId: string) {
    // Get count of logs for this webhook
    const count = await this.prisma.webhookRequestLog.count({
      where: { webhookId },
    })
    
    if (count > this.maxLogsPerWebhook) {
      // Get IDs of logs to delete (keep newest N)
      const logsToDelete = await this.prisma.webhookRequestLog.findMany({
        where: { webhookId },
        orderBy: { timestamp: 'desc' },
        skip: this.maxLogsPerWebhook,
        select: { id: true },
      })
      
      if (logsToDelete.length > 0) {
        await this.prisma.webhookRequestLog.deleteMany({
          where: {
            id: { in: logsToDelete.map(l => l.id) },
          },
        })
        
        logger.info(`Cleaned up ${logsToDelete.length} old webhook logs for ${webhookId}`)
      }
    }
    
    // Also delete logs older than retention period
    const cutoffDate = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000)
    await this.prisma.webhookRequestLog.deleteMany({
      where: {
        webhookId,
        timestamp: { lt: cutoffDate },
      },
    })
  }

  /**
   * Sanitize headers (remove sensitive data)
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers }
    
    // Remove or mask sensitive headers
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ]
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]'
      }
    }
    
    return sanitized
  }

  /**
   * Truncate body if too large
   */
  private truncateBody(body: any): any {
    if (!body) return null
    
    const bodyStr = JSON.stringify(body)
    if (bodyStr.length > this.maxBodySize) {
      return {
        _truncated: true,
        _originalSize: bodyStr.length,
        _preview: bodyStr.substring(0, this.maxBodySize),
      }
    }
    
    return body
  }
}
