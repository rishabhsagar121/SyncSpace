import { createClient } from 'redis';
import { env } from './env.js';
import { logger } from './logger.js';

export const redisClient = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 2) return false;
      return 1000;
    },
  },
});

redisClient.on('error', (err) => logger.error(`Redis error: ${err.message}`));
redisClient.on('connect', () => logger.info('Redis connected'));

export async function connectRedis() {
  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
    } catch (err) {
      logger.warn(`Redis connection failed (${err.message}). Continuing without Redis.`);
    }
  }
  return redisClient;
}

export async function disconnectRedis() {
  if (redisClient.isOpen) {
    await redisClient.disconnect();
  }
}

export default redisClient;