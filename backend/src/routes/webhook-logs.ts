import { PrismaClient } from '@prisma/client'
import { Router, Response } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import { WebhookRequestLogService } from '../services/WebhookRequestLogService'

const prisma = new PrismaClient()
const router = Router()
const webhookLogService = new WebhookRequestLogService(prisma)

// Get all webhook logs for the authenticated user
router.get('/webhook-logs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit, offset, status, startDate, endDate } = req.query
    
    const result = await webhookLogService.getAllLogsForUser(
      req.user!.id,
      {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      }
    )
    
    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get webhook logs',
    })
  }
})

// Get logs for a specific webhook
router.get('/webhooks/:webhookId/logs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { webhookId } = req.params
    const { limit, offset, status, startDate, endDate } = req.query
    
    const result = await webhookLogService.getLogsForWebhook(
      webhookId,
      req.user!.id,
      {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      }
    )
    
    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get webhook logs',
    })
  }
})

// Get a single log entry
router.get('/webhook-logs/:logId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { logId } = req.params
    const log = await webhookLogService.getLog(logId, req.user!.id)
    
    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Log not found',
      })
    }
    
    res.json({
      success: true,
      data: log,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get log',
    })
  }
})

// Get webhook statistics
router.get('/webhooks/:webhookId/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { webhookId } = req.params
    const stats = await webhookLogService.getWebhookStats(webhookId, req.user!.id)
    
    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
    })
  }
})

// Delete logs for a webhook
router.delete('/webhooks/:webhookId/logs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { webhookId } = req.params
    await webhookLogService.deleteLogsForWebhook(webhookId, req.user!.id)
    
    res.json({
      success: true,
      message: 'Logs deleted successfully',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete logs',
    })
  }
})

export default router
