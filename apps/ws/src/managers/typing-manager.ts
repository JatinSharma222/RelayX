import type { UserId, RoomType } from "@repo/shared";

type TypingSession = {
  userId: UserId;
  username: string;
  roomId: string;
  roomType: RoomType;
  expiresAt: number;
};

export class TypingManager {

  private typingSessions = new Map<string, TypingSession>();

  private getKey(
    roomType: RoomType,
    roomId: string,
    userId: UserId
  ): string {
    return `${roomType}:${roomId}:${userId}`;
  }

  public startTyping(
    userId: UserId,
    username: string,
    roomId: string,
    roomType: RoomType,
    timeoutMs: number
  ): void {
    const key = this.getKey(roomType, roomId, userId);

    const expiresAt = Date.now() + timeoutMs;

    this.typingSessions.set(key, {
      userId,
      username,
      roomId,
      roomType,
      expiresAt,
    });
  }

  public stopTyping(
    userId: UserId,
    roomId: string,
    roomType: RoomType
  ): TypingSession | undefined {
    const key = this.getKey(roomType, roomId, userId);

    const session = this.typingSessions.get(key);

    if (session) {
      this.typingSessions.delete(key);
    }

    return session;
  }

  public stopAllTyping(userId: UserId): TypingSession[] {
    const stoppedSessions: TypingSession[] = [];

    for (const [key, session] of this.typingSessions.entries()) {
      if (session.userId === userId) {
        stoppedSessions.push(session);
        this.typingSessions.delete(key);
      }
    }

    return stoppedSessions;
  }

  public getExpiredSessions(): TypingSession[] {
    const now = Date.now();
    const expiredSessions: TypingSession[] = [];

    for (const [key, session] of this.typingSessions.entries()) {
      if (now >= session.expiresAt) {
        expiredSessions.push(session);
        this.typingSessions.delete(key);
      }
    }

    return expiredSessions;
  }
}
