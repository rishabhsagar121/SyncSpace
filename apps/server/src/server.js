import http from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectPrisma, disconnectPrisma } from './config/prisma.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { initSockets } from './sockets/index.js';

const server = http.createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${env.PORT} is already in use. Please close the other process or pick another port.`);
  } else {
    logger.error(`Server error: ${err.message}`);
  }
  process.exit(1);
});

async function start() {
  try {
    await connectPrisma();
  } catch (err) {
    logger.error(`Database connection failed: ${err.message}. Please ensure PostgreSQL is running.`);
  }
  await connectRedis();
  initSockets(server);

  server.listen(env.PORT, () => {
    logger.info(`SyncSpace server listening on port ${env.PORT}`);
  });
}

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    await disconnectPrisma();
    await disconnectRedis();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});