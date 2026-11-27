import { db, messages } from '@repo/database';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, lt, desc, or } from 'drizzle-orm';

import type { UserId, RoomType } from '@repo/shared';

type CreateMessageInput = {
  senderId: UserId;
  roomId: string;
  roomType: RoomType;
  clientTempId: string;
  content: string;
};

type GetMessageHistoryInput = {
  roomId: string;
  roomType: RoomType;
  limit: number;
  before?: string;
};

export class MessageService {
  public async createMessage(input: CreateMessageInput) {
    const messageId = createId();

    let channelId: string | null = null;
    let conversationId: string | null = null;

    // Determine the message destination
    if (input.roomType === 'CHANNEL') {
      channelId = input.roomId;
    } else {
      conversationId = input.roomId;
    }

    // Attempt to insert a new message
    const [insertedMessage] = await db
      .insert(messages)
      .values({
        id: messageId,
        senderId: input.senderId,
        channelId,
        conversationId,
        content: input.content,
        clientTempId: input.clientTempId,
      })
      .onConflictDoNothing({
        target: [messages.senderId, messages.clientTempId],
      })
      .returning();

    // New message successfully inserted
    if (insertedMessage) {
      return {
        message: insertedMessage,
        isDuplicate: false,
      };
    }

    // Message already exists: retrieve the original
    const [existingMessage] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.senderId, input.senderId),
          eq(messages.clientTempId, input.clientTempId)
        )
      );
    if (!existingMessage) {
      throw new Error('Unable to create or retrieve message');
    }

    return {
      message: existingMessage,
      isDuplicate: true,
    };
  }

  public async getMessageHistory(input: GetMessageHistoryInput) {
    const limit = Math.min(Math.max(input.limit || 50, 1), 100);
    let roomCondition;

    if (input.roomType === 'CHANNEL') {
      roomCondition = eq(messages.channelId, input.roomId);
    } else {
      roomCondition = eq(messages.conversationId, input.roomId);
    }
    let cursorMessage;

    if (input.before) {
      [cursorMessage] = await db
        .select({
          id: messages.id,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(
          and(
            roomCondition,
            eq(messages.id, input.before)
          )
        );

      if (!cursorMessage) {
        throw new Error('Cursor message not found in this room');
      }
    }
    const cursorCondition = cursorMessage
      ? or(
        lt(messages.createdAt, cursorMessage.createdAt),
        and(
          eq(messages.createdAt, cursorMessage.createdAt),
          lt(messages.id, cursorMessage.id)
        )
      )
      : undefined;
    const rows = await db
      .select()
      .from(messages)
      .where(
        cursorCondition
          ? and(roomCondition, cursorCondition)
          : roomCondition
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;

    const page = rows.slice(0, limit);
    const chronologicalMessages = page.reverse();
    const nextCursor =
      chronologicalMessages.length > 0
        ? chronologicalMessages[0].id
        : null;
    return {
      roomId: input.roomId,
      roomType: input.roomType,
      messages: chronologicalMessages,
      hasMore,
      nextCursor,
    };
  }
}
