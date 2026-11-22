import { z } from 'zod';
import { UserIdSchema, type UserId } from './user';

export const PresenceStatusSchema = z.enum(['ONLINE', 'IDLE', 'DND', 'OFFLINE']);
export type PresenceStatus = z.infer<typeof PresenceStatusSchema>;

export interface UserPresence {
  userId: UserId;
  status: PresenceStatus;
  lastSeenAt: string;
}

export interface TypingEvent {
  roomId: string; // channelId or conversationId
  userId: UserId;
  username: string;
  isTyping: boolean;
}
