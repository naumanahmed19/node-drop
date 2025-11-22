/**
 * AI Memory Management API Routes
 * 
 * Provides REST endpoints for managing AI conversation memory.
 * All endpoints require authentication.
 * 
 * @module routes/ai-memory
 */

import { Router } from "express";
import { MemoryManager } from "../utils/ai/MemoryManager";
import { authenticateToken } from "../middleware/auth";

const router = Router();

/**
 * GET /api/ai-memory/conversations/:sessionId
 * 
 * Retrieve conversation memory for a specific session
 * 
 * @route GET /api/ai-memory/conversations/:sessionId
 * @param {string} sessionId - The conversation session ID
 * @returns {Object} 200 - Conversation memory object
 * @returns {Object} 500 - Error message
 * @security JWT
 * 
 * @example
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "sessionId": "user-123",
 *     "messages": [...],
 *     "createdAt": 1234567890,
 *     "updatedAt": 1234567890
 *   }
 * }
 */
router.get("/conversations/:sessionId", authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const memoryManager = MemoryManager.getInstance();
    const memory = await memoryManager.getMemory(sessionId);

    res.json({
      success: true,
      data: memory,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/ai-memory/conversations
 * 
 * List all active conversation sessions
 * 
 * @route GET /api/ai-memory/conversations
 * @returns {Object} 200 - Array of session IDs
 * @returns {Object} 500 - Error message
 * @security JWT
 * 
 * @example
 * Response:
 * {
 *   "success": true,
 *   "data": ["session-1", "session-2", "user-123"]
 * }
 */
router.get("/conversations", authenticateToken, async (req, res) => {
  try {
    const memoryManager = MemoryManager.getInstance();
    const sessions = await memoryManager.getActiveSessions();

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/ai-memory/conversations/:sessionId
 * 
 * Clear all conversation memory for a specific session
 * This action cannot be undone.
 * 
 * @route DELETE /api/ai-memory/conversations/:sessionId
 * @param {string} sessionId - The conversation session ID to clear
 * @returns {Object} 200 - Success message
 * @returns {Object} 500 - Error message
 * @security JWT
 * 
 * @example
 * Response:
 * {
 *   "success": true,
 *   "message": "Conversation user-123 cleared"
 * }
 */
router.delete("/conversations/:sessionId", authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const memoryManager = MemoryManager.getInstance();
    await memoryManager.clearMemory(sessionId);

    res.json({
      success: true,
      message: `Conversation ${sessionId} cleared`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/ai-memory/stats
 * 
 * Get memory usage statistics
 * 
 * @route GET /api/ai-memory/stats
 * @returns {Object} 200 - Memory statistics
 * @returns {Object} 500 - Error message
 * @security JWT
 * 
 * @example
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "activeConversations": 42,
 *     "totalMessages": 1337,
 *     "averageMessagesPerConversation": 32,
 *     "usingRedis": true
 *   }
 * }
 */
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const memoryManager = MemoryManager.getInstance();
    const stats = await memoryManager.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
