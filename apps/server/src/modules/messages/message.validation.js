import { z } from 'zod';

export const sendMessageSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
  body: z.object({
    content: z.string().min(1).max(4000),
    replyToId: z.string().uuid().optional(),
  }),
});

export const listMessagesSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
  query: z.object({
    cursor: z.string().uuid().optional(),
    take: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const editMessageSchema = z.object({
  params: z.object({ messageId: z.string().uuid() }),
  body: z.object({ content: z.string().min(1).max(4000) }),
});

export const messageIdParamSchema = z.object({
  params: z.object({ messageId: z.string().uuid() }),
});

export const reactionSchema = z.object({
  params: z.object({ messageId: z.string().uuid() }),
  body: z.object({ emoji: z.string().min(1).max(8) }),
});