/**
 * Redis Client Configuration
 * 
 * Provides a singleton Redis client with automatic reconnection strategy.
 * Used for persistent storage of AI conversation memory across server restarts
 * and distributed backend instances.
 * 
 * @module config/redis
 */

import { createClient } from "redis";

/**
 * Type definition for Redis client instance
 */
export type RedisClient = ReturnType<typeof createClient>;

/**
 * Singleton Redis client instance
 * @private
 */
let redisClient: RedisClient | null = null;

/**
 * Get or create a Redis client connection
 * 
 * Creates a singleton Redis client with automatic reconnection strategy.
 * Uses exponential backoff for reconnection attempts (50ms, 100ms, 200ms, etc.)
 * up to a maximum of 3 seconds between attempts.
 * 
 * @returns {Promise<RedisClient>} Connected Redis client instance
 * @throws {Error} If connection fails after max retry attempts
 * 
 * @example
 * ```typescript
 * const redis = await getRedisClient();
 * await redis.set('key', 'value');
 * const value = await redis.get('key');
 * ```
 */
export async function getRedisClient(): Promise<RedisClient> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error("Redis: Max reconnection attempts reached");
          return new Error("Max reconnection attempts reached");
        }
        // Exponential backoff: 50ms, 100ms, 200ms, etc.
        return Math.min(retries * 50, 3000);
      },
    },
  });

  redisClient.on("error", (err) => {
    console.error("Redis Client Error:", err);
  });

  redisClient.on("connect", () => {
    console.log("Redis: Connected successfully");
  });

  redisClient.on("reconnecting", () => {
    console.log("Redis: Reconnecting...");
  });

  await redisClient.connect();

  return redisClient;
}

/**
 * Close the Redis client connection gracefully
 * 
 * Sends QUIT command to Redis server and cleans up the client instance.
 * Should be called during application shutdown to ensure clean disconnection.
 * 
 * @returns {Promise<void>}
 * 
 * @example
 * ```typescript
 * // During application shutdown
 * process.on('SIGTERM', async () => {
 *   await closeRedisClient();
 *   process.exit(0);
 * });
 * ```
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }
}
