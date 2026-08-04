import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    displayName: z.string().min(1).max(50).optional(),
    bio: z.string().max(280).optional(),
  }),
});

export const searchUsersSchema = z.object({
  query: z.object({
    q: z.string().min(1),
  }),
});

export const updatePrivacySchema = z.object({
  body: z.object({
    showLastSeen: z.boolean().optional(),
    showEmail: z.boolean().optional(),
  }),
});

export const sessionParamSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid(),
  }),
});