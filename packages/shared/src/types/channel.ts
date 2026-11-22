import { z } from 'zod';
import { ServerIdSchema } from './server';

export const ChannelIdSchema = z.string().cuid2();
export type ChannelId = z.infer<typeof ChannelIdSchema>;

export const ChannelTypeSchema = z.enum(['TEXT', 'VOICE']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export const ChannelSchema = z.object({
  id: ChannelIdSchema,
  serverId: ServerIdSchema,
  name: z.string().min(1).max(64).regex(/^[a-z0-9-_]+$/, 'Lowercase, numbers, dashes and underscores only'),
  topic: z.string().max(512).nullable().optional(),
  type: ChannelTypeSchema.default('TEXT'),
  position: z.number().int().default(0), // Ordering in sidebar
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Channel = z.infer<typeof ChannelSchema>;

export const CreateChannelInputSchema = z.object({
  serverId: ServerIdSchema,
  name: z.string().min(1).max(64).regex(/^[a-z0-9-_]+$/),
  topic: z.string().max(512).optional(),
  type: ChannelTypeSchema.default('TEXT'),
});
export type CreateChannelInput = z.infer<typeof CreateChannelInputSchema>;
