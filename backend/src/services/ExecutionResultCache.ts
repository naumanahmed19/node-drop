import Redis from "ioredis";
import { ExecutionResult } from "../types/database";
import { logger } from "../utils/logger";

/**
 * Redis-based cache for execution results
 * Used for webhooks with responseMode: "lastNode" to avoid database polling
 */
export class ExecutionResultCache {
  private redis: Redis;
  private readonly TTL = 60; // 60 seconds TTL for cached results
  private readonly KEY_PREFIX = "execution:result:";

  constructor(redisConfig?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  }) {
    this.redis = new Redis({
      host: redisConfig?.host || process.env.REDIS_HOST || "localhost",
      port: redisConfig?.port || parseInt(process.env.REDIS_PORT || "6379"),
      password: redisConfig?.password || process.env.REDIS_PASSWORD,
      db: redisConfig?.db || parseInt(process.env.REDIS_DB || "0"),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on("error", (error) => {
      logger.error("Redis connection error in ExecutionResultCache:", error);
    });

    this.redis.on("connect", () => {
      logger.info("ExecutionResultCache connected to Redis");
    });
  }

  /**
   * Store execution result in Redis with TTL
   */
  async set(executionId: string, result: ExecutionResult): Promise<void> {
    try {
      const key = this.KEY_PREFIX + executionId;
      const value = JSON.stringify(result);
      
      await this.redis.setex(key, this.TTL, value);
      
      logger.debug(`Cached execution result for ${executionId}`, {
        executionId,
        ttl: this.TTL,
      });
    } catch (error) {
      logger.error(`Failed to cache execution result for ${executionId}:`, error);
      // Don't throw - caching is optional
    }
  }

  /**
   * Get execution result from Redis
   */
  async get(executionId: string): Promise<ExecutionResult | null> {
    try {
      const key = this.KEY_PREFIX + executionId;
      const value = await this.redis.get(key);
      
      if (!value) {
        return null;
      }
      
      const result = JSON.parse(value) as ExecutionResult;
      
      logger.debug(`Retrieved cached execution result for ${executionId}`);
      
      return result;
    } catch (error) {
      logger.error(`Failed to get cached execution result for ${executionId}:`, error);
      return null;
    }
  }

  /**
   * Delete execution result from Redis
   */
  async delete(executionId: string): Promise<void> {
    try {
      const key = this.KEY_PREFIX + executionId;
      await this.redis.del(key);
      
      logger.debug(`Deleted cached execution result for ${executionId}`);
    } catch (error) {
      logger.error(`Failed to delete cached execution result for ${executionId}:`, error);
    }
  }

  /**
   * Wait for execution result to be available in Redis
   * Polls Redis until result is available or timeout
   */
  async waitForResult(
    executionId: string,
    timeout: number = 30000
  ): Promise<ExecutionResult | null> {
    const startTime = Date.now();
    const pollInterval = 100; // Poll every 100ms
    
    while (Date.now() - startTime < timeout) {
      const result = await this.get(executionId);
      
      if (result) {
        return result;
      }
      
      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
    
    logger.warn(`Timeout waiting for execution result ${executionId}`);
    return null;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.redis.status === "ready";
  }
}
