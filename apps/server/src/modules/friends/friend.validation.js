import { z } from 'zod';

export const sendRequestSchema = z.object({
  body: z.object({ receiverId: z.string().uuid() }),
});

export const respondRequestSchema = z.object({
  params: z.object({ requestId: z.string().uuid() }),
  body: z.object({ accept: z.boolean() }),
});

export const requestIdParamSchema = z.object({
  params: z.object({ requestId: z.string().uuid() }),
});

export const friendIdParamSchema = z.object({
  params: z.object({ friendId: z.string().uuid() }),
});

export const blockUserSchema = z.object({
  body: z.object({ userId: z.string().uuid() }),
});

export const userIdParamSchema = z.object({
  params: z.object({ userId: z.string().uuid() }),
});