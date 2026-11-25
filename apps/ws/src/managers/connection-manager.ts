import WebSocket from "ws";
import type { UserId } from "@repo/shared";

export class ConnectionManager {
  private readonly activeConnections = new Map<
    UserId,
    Set<WebSocket>
  >();

  public addConnection(userId: UserId, ws: WebSocket): void {
    let userConnections = this.activeConnections.get(userId);

    if (!userConnections) {
      userConnections = new Set<WebSocket>();
      this.activeConnections.set(userId, userConnections);
    }

    userConnections.add(ws);
  }

  public removeConnection(userId: UserId, ws: WebSocket): void {
    const userConnections = this.activeConnections.get(userId);

    if (!userConnections) return;

    userConnections.delete(ws);

    if (userConnections.size === 0) {
      this.activeConnections.delete(userId);
    }
  }

  public getConnections(userId: UserId): ReadonlySet<WebSocket> {
    return this.activeConnections.get(userId) ?? new Set<WebSocket>();
  }

  public isOnline(userId: UserId): boolean {
    return (this.activeConnections.get(userId)?.size ?? 0) > 0;
  }
}

