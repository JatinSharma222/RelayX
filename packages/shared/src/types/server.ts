import { z } from 'zod';
import { UserIdSchema, PublicUserSchema } from './user';

export const ServerIdSchema = z.string().cuid2();
export type ServerId = z.infer<typeof ServerIdSchema>;

export const ServerRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
export type ServerRole = z.infer<typeof ServerRoleSchema>;

// Server Model
export const ServerSchema = z.object({
  id: ServerIdSchema,
  name: z.string().min(2).max(64),
  description: z.string().max(255).nullable().optional(),
  iconUrl: z.string().url().nullable().optional(),
  ownerId: UserIdSchema,
  inviteCode: z.string().length(8),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Server = z.infer<typeof ServerSchema>;

// Server Member Model
export const ServerMemberSchema = z.object({
  id: z.string().cuid2(),
  serverId: ServerIdSchema,
  userId: UserIdSchema,
  role: ServerRoleSchema,
  nickname: z.string().max(64).nullable().optional(),
  joinedAt: z.date(),
  user: PublicUserSchema.optional(), // Populated when fetching member list
});
export type ServerMember = z.infer<typeof ServerMemberSchema>;

// API Inputs
export const CreateServerInputSchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().max(255).optional(),
});
export type CreateServerInput = z.infer<typeof CreateServerInputSchema>;
