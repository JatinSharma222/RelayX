import { db, channels, serverMembers, conversations } from "@repo/database";
import { and, eq, exists, sql } from "drizzle-orm";

import type { UserId } from "@repo/shared";

export class RoomAuthorizationService {
  public async canAccessChannel(
    userId: UserId,
    channelId: string
  ): Promise<boolean> {
    const membershipQuery = db
      .select({ one: sql`1` })
      .from(serverMembers)
      .where(
        and(
          eq(serverMembers.serverId, channels.serverId),
          eq(serverMembers.userId, userId)
        )
      );

    const result = await db
      .select({
        hasAccess: exists(membershipQuery).mapWith(Boolean),
      })
      .from(channels)
      .where(eq(channels.id, channelId));

    return result[0]?.hasAccess ?? false;
  }

  public async canAccessConversation(
    userId: UserId,
    conversationId: string
  ): Promise<boolean> {
    const result = await db
      .select({
        hasAccess: sql<boolean>`
        ${conversations.userOneId} = ${userId}
        OR
        ${conversations.userTwoId} = ${userId}
      `,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId));

    return result[0]?.hasAccess ?? false;
  }
}
