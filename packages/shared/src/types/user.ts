import { z } from 'zod';

export const UserIdSchema = z.string().min(1);
export type UserId = z.infer<typeof UserIdSchema>;

// Full database entity
export const UserSchema = z.object({
  id: UserIdSchema,
  username: z.string().min(3).max(32).regex(/^[a-z0-9_]+$/, 'Alphanumeric and underscores only'),
  email: z.string().email(),
  displayName: z.string().min(1).max(64),
  avatarUrl: z.string().url().nullable().optional(),
  bio: z.string().max(256).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof UserSchema>;

// Public user profile (safe to share with other clients)
export const PublicUserSchema = UserSchema.pick({
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

// Auth DTOs
export const RegisterInputSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64).optional(),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export interface AuthSession {
  user: PublicUser;
  token: string;
  expiresAt: string;
}
