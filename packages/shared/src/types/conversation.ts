import { z } from 'zod';
import { UserIdSchema, PublicUserSchema } from './user';

export const ConversationIdSchema = z.string().min(1);
export type ConversationId = z.infer<typeof ConversationIdSchema>;

// Represents a 1:1 DM room
export const ConversationSchema = z.object({
  id: ConversationIdSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const ConversationMemberSchema = z.object({
  id: z.string().min(1),
  conversationId: ConversationIdSchema,
  userId: UserIdSchema,
  joinedAt: z.date(),
  lastReadAt: z.date().nullable().optional(),
  user: PublicUserSchema.optional(), // The other participant's profile
});
export type ConversationMember = z.infer<typeof ConversationMemberSchema>;

// Start DM Input
export const CreateConversationInputSchema = z.object({
  targetUserId: UserIdSchema,
});
export type CreateConversationInput = z.infer<typeof CreateConversationInputSchema>;
