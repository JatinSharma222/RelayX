

import WebSocket from "ws";

export type RoomKey =
  | `channel:${string}`
  | `conversation:${string}`;

export class RoomManager {
  private readonly rooms = new Map<RoomKey, Set<WebSocket>>();

  private readonly socketRooms = new Map<WebSocket, Set<RoomKey>>();

  public joinRoom(roomId: RoomKey, ws: WebSocket): boolean {

    const existingMembers = this.rooms.get(roomId);

    if (existingMembers?.has(ws)) {
      return false;
    }

    let roomConnections = this.rooms.get(roomId);

    if (!roomConnections) {
      roomConnections = new Set<WebSocket>();
      this.rooms.set(roomId, roomConnections);
    }

    roomConnections.add(ws);

    let joinedRooms = this.socketRooms.get(ws);

    if (!joinedRooms) {
      joinedRooms = new Set<RoomKey>();
      this.socketRooms.set(ws, joinedRooms);
    }

    joinedRooms.add(roomId);

    return true;
  }

  public leaveRoom(roomId: RoomKey, ws: WebSocket): void {
    const roomConnections = this.rooms.get(roomId);

    if (!roomConnections) return;

    roomConnections.delete(ws);

    if (roomConnections.size === 0) {
      this.rooms.delete(roomId);
    }

    const joinedRooms = this.socketRooms.get(ws);

    if (!joinedRooms) return;

    joinedRooms.delete(roomId);

    if (joinedRooms.size === 0) {
      this.socketRooms.delete(ws);
    }
  }

  public getRoomMembers(roomId: RoomKey): ReadonlySet<WebSocket> {
    return this.rooms.get(roomId) ?? new Set<WebSocket>();
  }

  public getSocketRooms(ws: WebSocket): ReadonlySet<RoomKey> {
    return this.socketRooms.get(ws) ?? new Set<RoomKey>();
  }

  public removeSocketFromAllRooms(ws: WebSocket): void {
    const joinedRooms = this.socketRooms.get(ws);

    if (!joinedRooms) return;

    for (const roomId of [...joinedRooms]) {
      this.leaveRoom(roomId, ws);
    }
  }
}

