/**
 * AI Conversation Memory Manager
 * 
 * Manages conversation history for AI nodes (OpenAI, Anthropic, etc.) with
 * Redis persistence and in-memory fallback. Supports distributed systems by
 * storing conversations in Redis, allowing multiple backend instances to share
 * conversation state.
 * 
 * Features:
 * - Redis persistence with 24-hour TTL
 * - Automatic fallback to in-memory storage if Redis unavailable
 * - Message pruning to prevent context overflow (max 50 messages)
 * - Automatic cleanup of old conversations (24 hours)
 * - Preserves system messages during pruning
 * 
 * @module utils/ai/MemoryManager
 */

import { AIMessage, ConversationMemory } from "../../types/ai.types";
import { getRedisClient, RedisClient } from "../../config/redis";

/**
 * Singleton class for managing AI conversation memory
 * 
 * @class MemoryManager
 * @example
 * ```typescript
 * const memoryManager = MemoryManager.getInstance();
 * 
 * // Add a message
 * await memoryManager.addMessage('session-123', {
 *   role: 'user',
 *   content: 'Hello!',
 *   timestamp: Date.now()
 * });
 * 
 * // Get conversation history
 * const memory = await memoryManager.getMemory('session-123');
 * console.log(memory.messages);
 * ```
 */
export class MemoryManager {
  private static instance: MemoryManager;
  private conversations: Map<string, ConversationMemory> = new Map();
  private readonly MAX_MESSAGES = 50; // Maximum messages to keep in memory
  private readonly MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly REDIS_KEY_PREFIX = "ai:conversation:";
  private readonly REDIS_TTL = 86400; // 24 hours in seconds
  private redisClient: RedisClient | null = null;
  private useRedis: boolean = true;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeRedis();
    // Start cleanup interval
    this.cleanupInterval = setInterval(
      () => this.cleanupOldConversations(),
      60 * 60 * 1000
    ); // Every hour
  }

  /**
   * Get the singleton instance of MemoryManager
   * 
   * @returns {MemoryManager} The singleton instance
   */
  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Initialize Redis connection
   * Falls back to in-memory storage if Redis is unavailable
   * 
   * @private
   * @returns {Promise<void>}
   */
  private async initializeRedis(): Promise<void> {
    try {
      this.redisClient = await getRedisClient();
      this.useRedis = true;
      console.log("MemoryManager: Using Redis for persistence");
    } catch (error) {
      console.warn(
        "MemoryManager: Redis unavailable, falling back to in-memory storage",
        error
      );
      this.useRedis = false;
    }
  }

  /**
   * Ensure Redis connection is available
   * Attempts to reconnect if connection was lost
   * 
   * @private
   * @returns {Promise<boolean>} True if Redis is available, false otherwise
   */
  private async ensureRedis(): Promise<boolean> {
    if (!this.useRedis) return false;

    if (!this.redisClient || !this.redisClient.isOpen) {
      try {
        this.redisClient = await getRedisClient();
        this.useRedis = true;
        return true;
      } catch (error) {
        console.warn("MemoryManager: Redis connection failed", error);
        this.useRedis = false;
        return false;
      }
    }
    return true;
  }

  /**
   * Generate Redis key for a session
   * 
   * @private
   * @param {string} sessionId - The session identifier
   * @returns {string} Redis key with prefix
   */
  private getRedisKey(sessionId: string): string {
    return `${this.REDIS_KEY_PREFIX}${sessionId}`;
  }

  /**
   * Get or create conversation memory for a session
   * 
   * Retrieves conversation from Redis if available, otherwise creates a new one.
   * Updates the TTL on each access to keep active conversations alive.
   * 
   * @param {string} sessionId - Unique identifier for the conversation session
   * @returns {Promise<ConversationMemory>} The conversation memory object
   * 
   * @example
   * ```typescript
   * const memory = await memoryManager.getMemory('user-123-chat');
   * console.log(`Session has ${memory.messages.length} messages`);
   * ```
   */
  async getMemory(sessionId: string): Promise<ConversationMemory> {
    // Try Redis first
    if (await this.ensureRedis()) {
      try {
        const key = this.getRedisKey(sessionId);
        const data = await this.redisClient!.get(key);

        if (data) {
          const memory = JSON.parse(data) as ConversationMemory;
          memory.updatedAt = Date.now();
          // Update TTL
          await this.redisClient!.expire(key, this.REDIS_TTL);
          return memory;
        }
      } catch (error) {
        console.error("MemoryManager: Redis get failed", error);
        // Fall through to in-memory
      }
    }

    // Fall back to in-memory
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, {
        sessionId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const memory = this.conversations.get(sessionId)!;
    memory.updatedAt = Date.now();
    return memory;
  }

  /**
   * Get or create conversation memory synchronously (backward compatibility)
   * 
   * WARNING: This method only works with in-memory storage and does not
   * access Redis. Use getMemory() for full functionality.
   * 
   * @deprecated Use async getMemory() instead
   * @param {string} sessionId - Unique identifier for the conversation session
   * @returns {ConversationMemory} The conversation memory object
   */
  getMemorySync(sessionId: string): ConversationMemory {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, {
        sessionId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const memory = this.conversations.get(sessionId)!;
    memory.updatedAt = Date.now();
    return memory;
  }

  /**
   * Add a message to a conversation
   * 
   * Appends the message to the conversation history and saves to Redis.
   * Automatically prunes old messages if the conversation exceeds MAX_MESSAGES.
   * System messages are preserved during pruning.
   * 
   * @param {string} sessionId - Unique identifier for the conversation session
   * @param {AIMessage} message - The message to add (user, assistant, or system)
   * @returns {Promise<void>}
   * 
   * @example
   * ```typescript
   * await memoryManager.addMessage('session-123', {
   *   role: 'user',
   *   content: 'What is the weather today?',
   *   timestamp: Date.now()
   * });
   * ```
   */
  async addMessage(sessionId: string, message: AIMessage): Promise<void> {
    const memory = await this.getMemory(sessionId);

    message.timestamp = message.timestamp || Date.now();
    memory.messages.push(message);
    memory.updatedAt = Date.now();

    // Prune if needed
    this.pruneMemoryIfNeeded(memory);

    // Save to Redis
    if (await this.ensureRedis()) {
      try {
        const key = this.getRedisKey(sessionId);
        await this.redisClient!.setEx(
          key,
          this.REDIS_TTL,
          JSON.stringify(memory)
        );
      } catch (error) {
        console.error("MemoryManager: Redis save failed", error);
        // Fall through to in-memory
      }
    }

    // Always keep in memory as cache
    this.conversations.set(sessionId, memory);
  }

  /**
   * Get all messages for a conversation session
   * 
   * @param {string} sessionId - Unique identifier for the conversation session
   * @returns {Promise<AIMessage[]>} Array of messages in chronological order
   * 
   * @example
   * ```typescript
   * const messages = await memoryManager.getMessages('session-123');
   * messages.forEach(msg => {
   *   console.log(`${msg.role}: ${msg.content}`);
   * });
   * ```
   */
  async getMessages(sessionId: string): Promise<AIMessage[]> {
    const memory = await this.getMemory(sessionId);
    return [...memory.messages];
  }

  /**
   * Clear all conversation memory for a session
   * 
   * Removes the conversation from both Redis and in-memory cache.
   * This action cannot be undone.
   * 
   * @param {string} sessionId - Unique identifier for the conversation session
   * @returns {Promise<void>}
   * 
   * @example
   * ```typescript
   * // Clear a specific conversation
   * await memoryManager.clearMemory('session-123');
   * ```
   */
  async clearMemory(sessionId: string): Promise<void> {
    // Clear from Redis
    if (await this.ensureRedis()) {
      try {
        const key = this.getRedisKey(sessionId);
        await this.redisClient!.del(key);
      } catch (error) {
        console.error("MemoryManager: Redis delete failed", error);
      }
    }

    // Clear from in-memory
    this.conversations.delete(sessionId);
  }

  /**
   * Get all active conversation session IDs
   * 
   * Returns session IDs from both Redis and in-memory storage.
   * Useful for monitoring and management purposes.
   * 
   * @returns {Promise<string[]>} Array of active session IDs
   * 
   * @example
   * ```typescript
   * const sessions = await memoryManager.getActiveSessions();
   * console.log(`Active conversations: ${sessions.length}`);
   * ```
   */
  async getActiveSessions(): Promise<string[]> {
    const sessions = new Set<string>();

    // Get from Redis
    if (await this.ensureRedis()) {
      try {
        const keys = await this.redisClient!.keys(
          `${this.REDIS_KEY_PREFIX}*`
        );
        keys.forEach((key) => {
          const sessionId = key.replace(this.REDIS_KEY_PREFIX, "");
          sessions.add(sessionId);
        });
      } catch (error) {
        console.error("MemoryManager: Redis keys failed", error);
      }
    }

    // Add in-memory sessions
    this.conversations.forEach((_, sessionId) => {
      sessions.add(sessionId);
    });

    return Array.from(sessions);
  }

  /**
   * Get the total number of active conversations
   * 
   * @returns {Promise<number>} Count of active conversation sessions
   * 
   * @example
   * ```typescript
   * const count = await memoryManager.getConversationCount();
   * console.log(`${count} active conversations`);
   * ```
   */
  async getConversationCount(): Promise<number> {
    const sessions = await this.getActiveSessions();
    return sessions.length;
  }

  /**
   * Prune messages if conversation exceeds MAX_MESSAGES limit
   * 
   * Keeps the system message (if present) and the most recent messages.
   * This prevents conversations from exceeding the AI model's context window.
   * 
   * @private
   * @param {ConversationMemory} memory - The conversation memory to prune
   * @returns {void}
   */
  private pruneMemoryIfNeeded(memory: ConversationMemory): void {
    if (memory.messages.length <= this.MAX_MESSAGES) {
      return;
    }

    // Keep system message (if first) and recent messages
    const systemMessage =
      memory.messages[0]?.role === "system" ? memory.messages[0] : null;

    const recentMessages = memory.messages.slice(-this.MAX_MESSAGES);

    if (systemMessage && recentMessages[0]?.role !== "system") {
      memory.messages = [systemMessage, ...recentMessages];
    } else {
      memory.messages = recentMessages;
    }
  }

  /**
   * Cleanup conversations older than MAX_AGE_MS (24 hours)
   * 
   * Automatically runs every hour to remove stale conversations.
   * Deletes from both Redis and in-memory storage.
   * 
   * @private
   * @returns {Promise<void>}
   */
  private async cleanupOldConversations(): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    // Clean up in-memory conversations
    for (const [sessionId, memory] of this.conversations.entries()) {
      if (now - memory.updatedAt > this.MAX_AGE_MS) {
        toDelete.push(sessionId);
      }
    }

    // Delete old conversations
    for (const sessionId of toDelete) {
      await this.clearMemory(sessionId);
    }

    if (toDelete.length > 0) {
      console.log(
        `MemoryManager: Cleaned up ${toDelete.length} old conversations`
      );
    }
  }

  /**
   * Get memory statistics
   * 
   * Provides insights into memory usage including active conversations,
   * total messages, and whether Redis is being used.
   * 
   * @returns {Promise<Object>} Statistics object
   * @property {number} activeConversations - Number of active sessions
   * @property {number} totalMessages - Total messages across all sessions
   * @property {number} averageMessagesPerConversation - Average messages per session
   * @property {boolean} usingRedis - Whether Redis is currently in use
   * 
   * @example
   * ```typescript
   * const stats = await memoryManager.getStats();
   * console.log(`Active: ${stats.activeConversations}, Using Redis: ${stats.usingRedis}`);
   * ```
   */
  async getStats() {
    const sessions = await this.getActiveSessions();
    let totalMessages = 0;

    // Count messages from in-memory cache
    for (const memory of this.conversations.values()) {
      totalMessages += memory.messages.length;
    }

    // If using Redis, try to get more accurate count
    if (await this.ensureRedis()) {
      try {
        for (const sessionId of sessions) {
          if (!this.conversations.has(sessionId)) {
            const memory = await this.getMemory(sessionId);
            totalMessages += memory.messages.length;
          }
        }
      } catch (error) {
        console.error("MemoryManager: Stats calculation failed", error);
      }
    }

    return {
      activeConversations: sessions.length,
      totalMessages,
      averageMessagesPerConversation:
        sessions.length > 0 ? Math.round(totalMessages / sessions.length) : 0,
      usingRedis: this.useRedis,
    };
  }

  /**
   * Cleanup resources on application shutdown
   * 
   * Stops the cleanup interval to prevent memory leaks.
   * Should be called during graceful shutdown.
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   const memoryManager = MemoryManager.getInstance();
   *   await memoryManager.shutdown();
   * });
   * ```
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
