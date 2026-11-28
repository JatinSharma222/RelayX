import {
  WebSocketServer,
  WebSocket,
  type RawData,
} from "ws";

import {
  ClientWsEventSchema,
  type UserId,
  type ServerWsEvent,
  type ClientWsEvent,
  type PublicUser,
  type RoomType,
} from "@repo/shared";

import { ConnectionManager } from "../managers/connection-manager";
import { RoomManager, type RoomKey } from "../managers/room-manager";
import { AuthAdapter } from "../auth/auth-adapter";
import { MessageService } from "../services/message-service";
import { RoomAuthorizationService } from "../services/room-authorization-service";
import { PresenceManager } from "../managers/presence-manager";

import { RateLimiter } from "../managers/rate-limit-manager";

export class WebSocketGateway {
  private wss: WebSocketServer;

  private connectionManager: ConnectionManager;
  private roomManager: RoomManager;
  private authAdapter: AuthAdapter;

  // Associates each authenticated socket with its user
  private authenticatedSockets = new Map<WebSocket, PublicUser>();

  private messageService: MessageService;

  private roomAuthorizationService: RoomAuthorizationService;
  private presenceManager: PresenceManager;
  private aliveSockets = new Map<WebSocket, boolean>();
  private heartbeatInterval!: ReturnType<typeof setInterval>;
  private isShuttingDown: boolean = false;
  private rateLimiter: RateLimiter;

  private rateLimits = {
    MESSAGE_SEND: { limit: 10, windowMs: 10_000 },
    HISTORY_REQUEST: { limit: 5, windowMs: 10_000 },
    ROOM_JOIN: { limit: 10, windowMs: 10_000 },
    TYPING_UPDATE: { limit: 20, windowMs: 10_000 },
    PRESENCE_SET: { limit: 5, windowMs: 10_000 },
  } as const;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });

    this.connectionManager = new ConnectionManager();
    this.roomManager = new RoomManager();
    this.authAdapter = new AuthAdapter();
    this.messageService = new MessageService();
    this.roomAuthorizationService = new RoomAuthorizationService();
    this.presenceManager = new PresenceManager();
    this.rateLimiter = new RateLimiter();

    this.initialize();
  }

  private initialize(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      console.log("New WebSocket connection");

      this.aliveSockets.set(ws, true);

      ws.on("pong", () => {
        this.aliveSockets.set(ws, true);
      });

      ws.on("message", (data: RawData) => {
        void this.handleMessage(ws, data);
      });

      ws.on("close", () => {
        this.handleDisconnect(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
    });

    this.heartbeatInterval = setInterval(() => {
      this.heartbeat();
    }, 30000);

    console.log("WebSocket Gateway running");
  }

  private send(ws: WebSocket, event: ServerWsEvent): void {
    if (ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify(event));
  }

  private async handleMessage(
    ws: WebSocket,
    data: RawData
  ): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(data.toString());

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("type" in parsed)
      ) {
        this.send(ws, {
          type: "ERROR",
          payload: {
            code: "BAD_REQUEST",
            message: "Invalid event format",
          },
        });
        return;
      }

      const result = ClientWsEventSchema.safeParse(parsed);

      if (!result.success) {
        this.send(ws, {
          type: "ERROR",
          payload: {
            code: "BAD_REQUEST",
            message: result.error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; "),
          },
        });

        return;
      }

      const event = result.data;

      // Authentication must happen first
      if (event.type === "AUTH") {
        await this.handleAuth(ws, event.payload.token);
        return;
      }

      // Other events require authentication
      if (!this.authenticatedSockets.has(ws)) {
        this.send(ws, {
          type: "ERROR",
          payload: {
            code: "UNAUTHORIZED",
            message: "Authenticate before sending events",
          },
        });
        return;
      }

      if (event.type === "ROOM_JOIN") {
        await this.handleRoomJoin(
          ws,
          event.payload.roomId,
          event.payload.roomType
        );
        return;
      }

      if (event.type === "ROOM_LEAVE") {
        this.handleRoomLeave(
          ws,
          event.payload.roomId,
          event.payload.roomType
        );
        return;
      }

      if (event.type === "MESSAGE_SEND") {
        await this.handleMessageSend(ws, event);
        return;
      }

      if (event.type === "HISTORY_REQUEST") {
        await this.handleHistoryRequest(ws, event);
        return;
      }

      if (event.type === "TYPING_UPDATE") {
        await this.handleTypingUpdate(ws, event);
        return;
      }

      if (event.type === "PRESENCE_SET") {
        this.handlePresenceSet(ws, event);
        return;
      }

    } catch (error) {
      console.error("WebSocket message handling error:", error);

      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "INTERNAL_ERROR",
          message: "Failed to process event",
        },
      });
    }
  }

  private async handleAuth(
    ws: WebSocket,
    token: string
  ): Promise<void> {
    if (this.authenticatedSockets.has(ws)) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "BAD_REQUEST",
          message: "Already authenticated",
        },
      });
      return;
    }

    if (typeof token !== "string" || !token) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "UNAUTHORIZED",
          message: "Invalid token",
        },
      });
      return;
    }

    const user = await this.authAdapter.authenticate(token);

    if (!user) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "UNAUTHORIZED",
          message: "Authentication failed",
        },
      });
      return;
    }

    const userId: UserId = user.id;

    const wasOnline = this.connectionManager.isOnline(userId);

    this.authenticatedSockets.set(ws, user);
    this.connectionManager.addConnection(userId, ws);

    if (!wasOnline) {
      this.presenceManager.removeStatus(userId);
      this.broadcastPresence(userId);
    }

    this.send(ws, {
      type: "AUTH_SUCCESS",
      payload: { user },
    });

    console.log(`${user.username} authenticated`);
  }

  private handleDisconnect(ws: WebSocket): void {
    this.aliveSockets.delete(ws);

    const user = this.authenticatedSockets.get(ws);

    if (!user) return;

    this.connectionManager.removeConnection(user.id, ws);

    if (!this.connectionManager.isOnline(user.id)) {
      this.presenceManager.updateLastSeen(user.id);
      this.broadcastPresence(user.id);
    }

    this.roomManager.removeSocketFromAllRooms(ws);

    this.authenticatedSockets.delete(ws);

    console.log(`${user.username} disconnected`);
  }


  private async handleRoomJoin(
    ws: WebSocket,
    roomId: string,
    roomType: RoomType
  ): Promise<void> {

    const user = this.authenticatedSockets.get(ws);

    if (!user) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;
    }

    if (!this.checkRateLimit(user.id, "ROOM_JOIN")) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "RATE_LIMITED",
          message: "Too many room join requests. Please try again later.",
        },
      });

      return;
    }

    if (roomType === "CHANNEL") {
      const hasAccess =
        await this.roomAuthorizationService.canAccessChannel(
          user.id,
          roomId
        );

      if (!hasAccess) {
        this.send(ws, {
          type: "ERROR",
          payload: {
            code: "FORBIDDEN",
            message: "You don't have access to this channel",
          },
        });
        return;
      }
    } else {
      const hasAccess = await this.roomAuthorizationService.canAccessConversation(
        user.id,
        roomId
      );

      if (!hasAccess) {
        this.send(ws, {
          type: "ERROR",
          payload: {
            code: "FORBIDDEN",
            message: "You don't have access to this conversation",
          },
        });
        return;
      }
    }

    const roomKey: RoomKey = roomType === "CHANNEL" ? `channel:${roomId}` : `conversation:${roomId}`;

    this.roomManager.joinRoom(roomKey, ws);
  }

  private handleRoomLeave(
    ws: WebSocket,
    roomId: string,
    roomType: RoomType
  ): void {
    const roomKey: RoomKey = roomType === "CHANNEL" ? `channel:${roomId}` : `conversation:${roomId}`;

    this.roomManager.leaveRoom(roomKey, ws);
  }

  private async handleMessageSend(
    ws: WebSocket,
    event: Extract<ClientWsEvent, { type: "MESSAGE_SEND" }>
  ): Promise<void> {

    const user = this.authenticatedSockets.get(ws);

    if (!user) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;
    }

    if (!this.checkRateLimit(user.id, "MESSAGE_SEND")) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "RATE_LIMITED",
          message: "Too many messages. Please try again later.",
        },
      });

      return;
    }

    if (event.payload.roomType === "CHANNEL") {
      const hasAccess =
        await this.roomAuthorizationService.canAccessChannel(
          user.id,
          event.payload.roomId
        );

      if (!hasAccess) {
        this.send(ws, {
          type: "ERROR",
          payload: {
            code: "FORBIDDEN",
            message: "You don't have access to this channel",
          },
        });
        return;
      }
    } else {
      const hasAccess = await this.roomAuthorizationService.canAccessConversation(
        user.id,
        event.payload.roomId
      );

      if (!hasAccess) {
        this.send(ws, {
          type: "ERROR",
          payload: {
            code: "FORBIDDEN",
            message: "You don't have access to this conversation",
          },
        });
        return;
      }
    }


    const result = await this.messageService.createMessage({
      senderId: user.id,
      roomId: event.payload.roomId,
      roomType: event.payload.roomType,
      clientTempId: event.payload.clientTempId,
      content: event.payload.content,
    });

    this.send(ws, {
      type: "MESSAGE_ACK",
      payload: {
        clientTempId: event.payload.clientTempId,
        message: result.message,
        isDuplicate: result.isDuplicate,
      },
    });

    if (result.isDuplicate) {
      return;
    }

    const roomKey: RoomKey =
      event.payload.roomType === "CHANNEL"
        ? `channel:${event.payload.roomId}`
        : `conversation:${event.payload.roomId}`;

    const members = this.roomManager.getRoomMembers(roomKey);

    for (const memberSocket of members) {
      if (memberSocket === ws) {
        continue;
      }

      this.send(memberSocket, {
        type: "MESSAGE_NEW",
        payload: {
          message: result.message,
          roomId: event.payload.roomId,
          roomType: event.payload.roomType,
          clientTempId: event.payload.clientTempId,
        },
      });
    }
  }


  private async handleHistoryRequest(
    ws: WebSocket,
    event: Extract<ClientWsEvent, { type: "HISTORY_REQUEST" }>
  ): Promise<void> {
    const user = this.authenticatedSockets.get(ws);

    if (!user) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;
    }

    if (!this.checkRateLimit(user.id, "HISTORY_REQUEST")) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "RATE_LIMITED",
          message: "Too many history requests. Please try again later.",
        },
      });

      return;
    }

    if (event.payload.roomType === "CHANNEL") {
      const hasAccess =
        await this.roomAuthorizationService.canAccessChannel(
          user.id,
          event.payload.roomId
        );

      if (!hasAccess) {
        this.send(ws, {
          type: "ERROR",
          payload: {
            code: "FORBIDDEN",
            message: "You don't have access to this channel",
          },
        });
        return;
      }
    } else {
      const hasAccess = await this.roomAuthorizationService.canAccessConversation(
        user.id,
        event.payload.roomId
      );

      if (!hasAccess) {
        this.send(ws, {
          type: "ERROR",
          payload: {
            code: "FORBIDDEN",
            message: "You don't have access to this conversation",
          },
        });
        return;
      }
    }


    const result = await this.messageService.getMessageHistory({
      roomId: event.payload.roomId,
      roomType: event.payload.roomType,
      limit: event.payload.limit,
      before: event.payload.before,
    });

    this.send(ws, {
      type: "HISTORY_RESPONSE",
      payload: result,
    });
  }

  private async handleTypingUpdate(
    ws: WebSocket,
    event: Extract<ClientWsEvent, { type: "TYPING_UPDATE" }>
  ): Promise<void> {
    const user = this.authenticatedSockets.get(ws);

    if (!user) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;

    }

    if (!this.checkRateLimit(user.id, "TYPING_UPDATE")) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "RATE_LIMITED",
          message: "Too many typing update requests. Please try again later.",
        },
      });

      return;
    }

    if (event.payload.roomType === "CHANNEL") {

      const hasAccess =
        await this.roomAuthorizationService.canAccessChannel(
          user.id,
          event.payload.roomId
        );

      if (!hasAccess) {
        this.send(ws, {
          type: "ERROR",
          payload: {
            code: "FORBIDDEN",
            message: "You don't have access to this channel",
          },
        });
        return;
      }
    } else {
      const hasAccess = await this.roomAuthorizationService.canAccessConversation(
        user.id,
        event.payload.roomId
      );

      if (!hasAccess) {
        this.send(ws, {
          type: "ERROR",
          payload: {
            code: "FORBIDDEN",
            message: "You don't have access to this conversation",
          },
        });
        return;
      }
    }


    const roomKey: RoomKey =
      event.payload.roomType === "CHANNEL"
        ? `channel:${event.payload.roomId}`
        : `conversation:${event.payload.roomId}`;

    const socketRooms = this.roomManager.getSocketRooms(ws);

    if (!socketRooms.has(roomKey)) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "BAD_REQUEST",
          message: "Join the room before sending typing updates",
        },
      });
      return;
    }

    const members = this.roomManager.getRoomMembers(roomKey);

    const typingEvent: ServerWsEvent = {
      type: "TYPING_UPDATE",
      payload: {
        roomId: event.payload.roomId,
        roomType: event.payload.roomType, // ADD THIS
        userId: user.id,
        username: user.username,
        isTyping: event.payload.isTyping,
      },
    };

    for (const memberSocket of members) {
      if (memberSocket === ws) continue;

      this.send(memberSocket, typingEvent);
    }
  }

  private broadcastPresence(userId: UserId): void {
    const presence = this.presenceManager.getUserPresence(
      userId,
      this.connectionManager
    );

    const event: ServerWsEvent = {
      type: "PRESENCE_UPDATE",
      payload: presence,
    };

    for (const [socket, user] of this.authenticatedSockets) {
      if (user.id === userId) continue;

      this.send(socket, event);
    }
  }

  private handlePresenceSet(
    ws: WebSocket,
    event: Extract<ClientWsEvent, { type: "PRESENCE_SET" }>
  ): void {
    const user = this.authenticatedSockets.get(ws);

    if (!user) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;
    }

    if (!this.checkRateLimit(user.id, "PRESENCE_SET")) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "RATE_LIMITED",
          message: "Too many Presence requests. Please try again later.",
        },
      });

      return;
    }

    const { status } = event.payload;

    if (!["ONLINE", "IDLE", "DND"].includes(status)) {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "BAD_REQUEST",
          message: "Invalid presence status",
        },
      });
      return;
    }

    if (status === "ONLINE") {
      this.presenceManager.removeStatus(user.id);
    } else {
      this.presenceManager.setStatus(user.id, status);
    }

    this.broadcastPresence(user.id);
  }

  private heartbeat(): void {

    for (const client of this.wss.clients) {

      if (client.readyState !== WebSocket.OPEN) {
        continue;
      }

      if (this.aliveSockets.get(client) === false) {
        client.terminate();
        this.aliveSockets.delete(client);
        continue;
      }

      this.aliveSockets.set(client, false);
      client.ping();
    }
  }

  public shutdown(): void {

    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    clearInterval(this.heartbeatInterval);

    this.rateLimiter.shutdown();

    // Stop accepting new connections
    this.wss.close(() => {
      console.log("WebSocket server closed");
    });

    // Gracefully close existing connections
    for (const client of this.wss.clients) {
      client.close(1001, "Server shutting down");
    }
  }

  private checkRateLimit(
    userId: UserId,
    eventType: keyof typeof this.rateLimits
  ): boolean {
    const config = this.rateLimits[eventType];

    return this.rateLimiter.allow(
      userId,
      eventType,
      config.limit,
      config.windowMs
    );
  }

}
