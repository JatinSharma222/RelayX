

import { type UserId, type PublicUser } from './user';
import { type Message } from './message';
import { type UserPresence } from './presence';

export type RoomType = 'CHANNEL' | 'CONVERSATION';

// ==========================================
// Client -> Server Events
// ==========================================

export type ClientWsEvent =
  | {
    type: 'AUTH';
    payload: {
      token: string;
    };
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
  }
  | {
    type: 'TYPING_UPDATE';
    payload: {
      roomId: string;
      roomType: RoomType;
      isTyping: boolean;
    };
  }
  | {
    type: 'PRESENCE_SET';
    payload: {
      status: 'ONLINE' | 'IDLE' | 'DND';
    };
  }
  | {
    type: "HISTORY_REQUEST";
    payload: {
      roomId: string;
      roomType: RoomType;
      limit: number;
      before?: string;
    };
  };

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
    type: "HISTORY_RESPONSE";
    payload: {
      roomId: string;
      roomType: RoomType;
      messages: Message[];
      hasMore: boolean;
      nextCursor: string | null;
    };
  };
