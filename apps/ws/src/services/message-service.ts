import { db, messages } from '@repo/database';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';

import type { UserId, RoomType } from '@repo/shared';

type CreateMessageInput = {
  senderId: UserId;
  roomId: string;
  roomType: RoomType;
  clientTempId: string;
  content: string;
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
}
