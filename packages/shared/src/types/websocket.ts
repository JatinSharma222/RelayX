import { type UserId, type PublicUser } from './user';
import { type Message, type MessageId } from './message';
import { type UserPresence } from './presence';

export type RoomType = 'CHANNEL' | 'CONVERSATION';

// ==========================================
// Client -> Server Events
// ==========================================
export type ClientWsEvent =
  | {
    type: 'AUTH';
    payload: { token: string };
  }
  | {
    type: 'ROOM_JOIN';
    payload: {
      roomId: string;
      roomType: RoomType;
    };
  }
  | {
    type: 'ROOM_LEAVE';
    payload: {
      roomId: string;
      roomType: RoomType;
    };
  }
  | {
    type: 'MESSAGE_SEND';
    payload: {
      clientTempId: string;
      roomId: string;
      roomType: RoomType;
      content: string;
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
      roomType: RoomType;
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
