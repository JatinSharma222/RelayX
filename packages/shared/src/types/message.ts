import { z } from 'zod';
import { UserIdSchema, PublicUserSchema } from './user';
import { ChannelIdSchema } from './channel';
import { ConversationIdSchema } from './conversation';

export const MessageIdSchema = z.string().min(1);
export type MessageId = z.infer<typeof MessageIdSchema>;

export const MessageSchema = z.object({
  id: MessageIdSchema,
  senderId: UserIdSchema,
  sender: PublicUserSchema.optional(),
  // Scoped to either a Channel or a DM Conversation:
  channelId: ChannelIdSchema.nullable().optional(),
  conversationId: ConversationIdSchema.nullable().optional(),
  content: z.string().min(1).max(4000), // Discord character limit standard
  isEdited: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Message = z.infer<typeof MessageSchema>;

// Cursor-based pagination query
export const GetMessagesQuerySchema = z.object({
  channelId: ChannelIdSchema.optional(),
  conversationId: ConversationIdSchema.optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  before: MessageIdSchema.optional(), // Fetch older messages before this ID
});
export type GetMessagesQuery = z.infer<typeof GetMessagesQuerySchema>;
