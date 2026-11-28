import { z } from 'zod';

import { type UserId, type PublicUser } from './user';
import { type Message } from './message';
import { type UserPresence } from './presence';

// ==========================================
// Shared WebSocket Types
// ==========================================

export const RoomTypeSchema = z.enum([
  'CHANNEL',
  'CONVERSATION',
]);

export type RoomType = z.infer<typeof RoomTypeSchema>;

// ==========================================
// Client -> Server Event Schemas
// ==========================================

export const AuthEventSchema = z.object({
  type: z.literal('AUTH'),
  payload: z.object({
    token: z.string().min(1),
  }),
});

export const RoomJoinEventSchema = z.object({
  type: z.literal('ROOM_JOIN'),
  payload: z.object({
    roomId: z.string().min(1),
    roomType: RoomTypeSchema,
  }),
});

export const RoomLeaveEventSchema = z.object({
  type: z.literal('ROOM_LEAVE'),
  payload: z.object({
    roomId: z.string().min(1),
    roomType: RoomTypeSchema,
  }),
});

export const MessageSendEventSchema = z.object({
  type: z.literal('MESSAGE_SEND'),
  payload: z.object({
    clientTempId: z.string().min(1),
    roomId: z.string().min(1),
    roomType: RoomTypeSchema,
    content: z.string().min(1).max(4000),
  }),
});

export const TypingUpdateEventSchema = z.object({
  type: z.literal('TYPING_UPDATE'),
  payload: z.object({
    roomId: z.string().min(1),
    roomType: RoomTypeSchema,
    isTyping: z.boolean(),
  }),
});

export const PresenceSetEventSchema = z.object({
  type: z.literal('PRESENCE_SET'),
  payload: z.object({
    status: z.enum(['ONLINE', 'IDLE', 'DND']),
  }),
});

export const HistoryRequestEventSchema = z.object({
  type: z.literal('HISTORY_REQUEST'),
  payload: z.object({
    roomId: z.string().min(1),
    roomType: RoomTypeSchema,
    limit: z.number().int().min(1).max(100),
    before: z.string().min(1).optional(),
  }),
});

// ==========================================
// Client -> Server Event Union
// ==========================================

export const ClientWsEventSchema = z.discriminatedUnion('type', [
  AuthEventSchema,
  RoomJoinEventSchema,
  RoomLeaveEventSchema,
  MessageSendEventSchema,
  TypingUpdateEventSchema,
  PresenceSetEventSchema,
  HistoryRequestEventSchema,
]);

export type ClientWsEvent = z.infer<typeof ClientWsEventSchema>;

// ==========================================
// Server -> Client Events
// ==========================================

export type ServerWsEvent =
  | {
    type: 'AUTH_SUCCESS';
    payload: {
      user: PublicUser;
    };
  }
  | {
    type: 'MESSAGE_NEW';
    payload: {
      message: Message;
      roomId: string;
      roomType: RoomType;
      clientTempId?: string;
    };
  }
  | {
    type: 'MESSAGE_ACK';
    payload: {
      clientTempId: string;
      message: Message;
      isDuplicate: boolean;
    };
  }
  | {
    type: 'TYPING_UPDATE';
    payload: {
      roomId: string;
      roomType: RoomType;
      userId: UserId;
      username: string;
      isTyping: boolean;
    };
  }
  | {
    type: 'PRESENCE_UPDATE';
    payload: UserPresence;
  }
  | {
    type: 'ERROR';
    payload: {
      code: string;
      message: string;
    };
  }
  | {
    type: 'HISTORY_RESPONSE';
    payload: {
      roomId: string;
      roomType: RoomType;
      messages: Message[];
      hasMore: boolean;
      nextCursor: string | null;
    };
  };
