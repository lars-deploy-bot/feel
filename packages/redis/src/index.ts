import Redis from 'ioredis';

const DEFAULT_REDIS_URL = 'redis://:dev_password_only@127.0.0.1:6379';

/**
 * Creates a Redis client with automatic connection and error handling.
 *
 * @param connectionUrl - Optional Redis connection URL. Falls back to REDIS_URL env var or default.
 * @returns Configured Redis client instance
 *
 * @example
 * ```typescript
 * import { createRedisClient } from '@alive-brug/redis';
 *
 * const redis = createRedisClient();
 * await redis.set('key', 'value');
 * const value = await redis.get('key');
 * ```
 *
 * @example Custom connection URL
 * ```typescript
 * const redis = createRedisClient('redis://:password@host:6379');
 * ```
 */
export const createRedisClient = (connectionUrl?: string) => {
  const url = connectionUrl || process.env.REDIS_URL || DEFAULT_REDIS_URL;

  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('Redis Client Connected');
  });

  return client;
};

// Export the type for reuse in apps
export type RedisClient = Redis;
