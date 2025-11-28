/**
 * Execution Resume Routes
 * 
 * Handles resuming paused executions when human responds to ask_human tool.
 * Used for human-in-the-loop functionality.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Import the execution pause manager
// Note: This will be loaded from the custom node at runtime
let executionPauseManager: any = null;

// Lazy load the execution pause manager
function getExecutionPauseManager() {
  if (!executionPauseManager) {
    try {
      executionPauseManager = require('../../custom-nodes/ai-agent/utils/executionPauseManager');
    } catch (error) {
      console.error('[Execution Resume] Failed to load executionPauseManager:', error);
      throw new Error('Execution pause manager not available');
    }
  }
  return executionPauseManager;
}

/**
 * POST /api/executions/:executionId/resume
 * Resume a paused execution with user's response
 */
router.post('/:executionId/resume', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const { response } = req.body;

    if (!response || typeof response !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Response is required and must be a string',
      });
    }

    const manager = getExecutionPauseManager();

    // Check if execution is paused
    if (!manager.isPaused(executionId)) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found or not paused',
      });
    }

    // Resume execution with user's response
    const resumed = manager.resumeWithResponse(executionId, response);

    if (!resumed) {
      return res.status(500).json({
        success: false,
        error: 'Failed to resume execution',
      });
    }

    res.json({
      success: true,
      message: 'Execution resumed successfully',
      executionId,
    });
  } catch (error: any) {
    console.error('[Execution Resume] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resume execution',
    });
  }
});

/**
 * GET /api/executions/:executionId/status
 * Check if execution is paused and waiting for response
 */
router.get('/:executionId/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const manager = getExecutionPauseManager();

    const isPaused = manager.isPaused(executionId);
    const info = manager.getPausedExecution(executionId);

    res.json({
      success: true,
      executionId,
      isPaused,
      info,
    });
  } catch (error: any) {
    console.error('[Execution Resume] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check execution status',
    });
  }
});

/**
 * GET /api/executions/paused
 * Get all paused executions
 */
router.get('/paused', authenticateToken, async (req: Request, res: Response) => {
  try {
    const manager = getExecutionPauseManager();
    const pausedExecutions = manager.getAllPausedExecutions();

    res.json({
      success: true,
      count: pausedExecutions.length,
      executions: pausedExecutions,
    });
  } catch (error: any) {
    console.error('[Execution Resume] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get paused executions',
    });
  }
});

/**
 * POST /api/executions/:executionId/cancel
 * Cancel a paused execution
 */
router.post('/:executionId/cancel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const { reason } = req.body;

    const manager = getExecutionPauseManager();

    const cancelled = manager.cancelExecution(
      executionId,
      reason || 'Cancelled by user'
    );

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found or not paused',
      });
    }

    res.json({
      success: true,
      message: 'Execution cancelled successfully',
      executionId,
    });
  } catch (error: any) {
    console.error('[Execution Resume] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel execution',
    });
  }
});

export default router;
