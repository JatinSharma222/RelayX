import {
  WebSocketServer,
  WebSocket,
  type RawData,
} from "ws";

import type {
  UserId,
  ServerWsEvent,
  ClientWsEvent,
  PublicUser,
} from "@repo/shared";

import { ConnectionManager } from "../managers/connection-manager";
import { RoomManager } from "../managers/room-manager";
import { AuthAdapter } from "../auth/auth-adapter";

export class WebSocketGateway {
  private wss: WebSocketServer;

  private connectionManager: ConnectionManager;
  private roomManager: RoomManager;
  private authAdapter: AuthAdapter;

  // Associates each authenticated socket with its user
  private authenticatedSockets = new Map<WebSocket, PublicUser>();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });

    this.connectionManager = new ConnectionManager();
    this.roomManager = new RoomManager();
    this.authAdapter = new AuthAdapter();

    this.initialize();
  }

  private initialize(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      console.log("New WebSocket connection");

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

      const event = parsed as ClientWsEvent;

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

      console.log("Authenticated event:", event.type);

    } catch {
      this.send(ws, {
        type: "ERROR",
        payload: {
          code: "BAD_REQUEST",
          message: "Invalid JSON",
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

    this.authenticatedSockets.set(ws, user);

    this.connectionManager.addConnection(userId, ws);

    this.send(ws, {
      type: "AUTH_SUCCESS",
      payload: { user },
    });

    console.log(`${user.username} authenticated`);
  }

  private handleDisconnect(ws: WebSocket): void {
    const user = this.authenticatedSockets.get(ws);

    if (!user) return;

    this.connectionManager.removeConnection(user.id, ws);
    this.roomManager.removeSocketFromAllRooms(ws);

    this.authenticatedSockets.delete(ws);

    console.log(`${user.username} disconnected`);
  }
}

