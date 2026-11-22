import { type UserId, type PublicUser } from './user';
import { type Message, type MessageId } from './message';
import { type UserPresence } from './presence';

// ==========================================
// Client -> Server Events
// ==========================================
export type ClientWsEvent =
  | {
    type: 'AUTH';
    payload: { token: string };
  }
  | {
    type: 'ROOM_JOIN'; // Joins a channel or conversation room
    payload: { roomId: string };
  }
  | {
    type: 'ROOM_LEAVE';
    payload: { roomId: string };
  }
  | {
    type: 'MESSAGE_SEND';
    payload: {
      clientTempId: string; // Used for frontend optimistic rendering
      roomId: string; // channelId or conversationId
      isDm?: boolean;
      content: string;
    };
  }
  | {
    type: 'TYPING_UPDATE';
    payload: {
      roomId: string;
      isTyping: boolean;
    };
  }
  | {
    type: 'PRESENCE_SET';
    payload: {
      status: 'ONLINE' | 'IDLE' | 'DND';
    };
  };

// ==========================================
// Server -> Client Events
// ==========================================
export type ServerWsEvent =
  | {
    type: 'AUTH_SUCCESS';
    payload: { user: PublicUser };
  }
  | {
    type: 'MESSAGE_NEW';
    payload: {
      message: Message;
      roomId: string;
      clientTempId?: string; // Reconciles optimistic UI in frontend
    };
  }
  | {
    type: 'TYPING_UPDATE';
    payload: {
      roomId: string;
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
  };
