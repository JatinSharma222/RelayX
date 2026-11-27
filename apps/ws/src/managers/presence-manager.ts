import type { UserId, PresenceStatus, UserPresence } from "@repo/shared";
import { ConnectionManager } from "./connection-manager";

export class PresenceManager {
  private readonly userStatuses = new Map<UserId, PresenceStatus>();
  private readonly lastSeen = new Map<UserId, string>();

  public setStatus(userId: UserId, status: PresenceStatus): void {
    this.userStatuses.set(userId, status);
  }

  public getStatus(userId: UserId): PresenceStatus | undefined {
    return this.userStatuses.get(userId);
  }

  public removeStatus(userId: UserId): void {
    this.userStatuses.delete(userId);
  }

  public getEffectiveStatus(
    userId: UserId,
    connectionManager: ConnectionManager
  ): PresenceStatus {
    if (!connectionManager.isOnline(userId)) {
      return "OFFLINE";
    }

    return this.getStatus(userId) ?? "ONLINE";
  }

  public updateLastSeen(userId: UserId): void {
    this.lastSeen.set(userId, new Date().toISOString());
  }

  public getLastSeen(userId: UserId): string | null {
    return this.lastSeen.get(userId) ?? null;
  }

  public getUserPresence(
    userId: UserId,
    connectionManager: ConnectionManager
  ): UserPresence {
    return {
      userId,
      status: this.getEffectiveStatus(userId, connectionManager),
      lastSeenAt: this.getLastSeen(userId),
    };
  }
}
