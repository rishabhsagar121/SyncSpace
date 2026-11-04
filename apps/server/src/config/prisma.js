import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from './logger.js';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectPrisma() {
  await prisma.$connect();
  logger.info('Prisma connected to database');
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}

export default prisma;
