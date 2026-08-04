import { z } from 'zod';

export const createRoomSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(60),
    visibility: z.enum(['PUBLIC', 'PRIVATE', 'PASSWORD_PROTECTED']).default('PRIVATE'),
    password: z.string().min(4).optional(),
    mode: z.enum(['YOUTUBE', 'LOCAL_VIDEO', 'STREAMING_EXTENSION', 'MUSIC']).default('YOUTUBE'),
  }),
});

export const joinRoomSchema = z.object({
  body: z.object({
    code: z.string().min(1),
    password: z.string().optional(),
  }),
});

export const roomIdParamSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
});

export const targetUserBodySchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
  body: z.object({ userId: z.string().uuid() }),
});

export const muteBodySchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
  body: z.object({ userId: z.string().uuid(), isMuted: z.boolean() }),
});

export const updateSettingsSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
  body: z.object({
    allowGuestControl: z.boolean().optional(),
    allowChat: z.boolean().optional(),
    allowReactions: z.boolean().optional(),
    maxParticipants: z.number().int().min(2).max(50).optional(),
  }),
});

export const updateModeSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
  body: z.object({ mode: z.enum(['YOUTUBE', 'LOCAL_VIDEO', 'STREAMING_EXTENSION', 'MUSIC']) }),
});