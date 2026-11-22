import { pgTable, text, timestamp, boolean, integer, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// --------------------------------------------------------------------------
// 1. Users Table
// --------------------------------------------------------------------------
export const users = pgTable('users', {
  id: text('id').primaryKey(), // cuid2
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --------------------------------------------------------------------------
// 2. Servers Table (Discord Guilds / Workspaces)
// --------------------------------------------------------------------------
export const servers = pgTable('servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  iconUrl: text('icon_url'),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  inviteCode: text('invite_code').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --------------------------------------------------------------------------
// 3. Server Members Table
// --------------------------------------------------------------------------
export const serverMembers = pgTable('server_members', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['OWNER', 'ADMIN', 'MEMBER'] }).notNull().default('MEMBER'),
  nickname: text('nickname'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('server_members_server_user_idx').on(table.serverId, table.userId),
]);

// --------------------------------------------------------------------------
// 4. Channels Table (Channels inside a server)
// --------------------------------------------------------------------------
export const channels = pgTable('channels', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  topic: text('topic'),
  type: text('type', { enum: ['TEXT', 'VOICE'] }).notNull().default('TEXT'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('channels_server_position_idx').on(table.serverId, table.position),
]);

// --------------------------------------------------------------------------
// 5. Conversations Table (1:1 Direct Messages)
// --------------------------------------------------------------------------
export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  userOneId: text('user_one_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userTwoId: text('user_two_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('conversations_user_pair_idx').on(table.userOneId, table.userTwoId),
]);

// --------------------------------------------------------------------------
// 6. Messages Table (Lean, high performance)
// --------------------------------------------------------------------------
export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  channelId: text('channel_id').references(() => channels.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isEdited: boolean('is_edited').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('messages_channel_created_idx').on(table.channelId, table.createdAt),
  index('messages_conversation_created_idx').on(table.conversationId, table.createdAt),
  check(
    'message_target_check',
    sql`(${table.channelId} IS NOT NULL AND ${table.conversationId} IS NULL) OR (${table.channelId} IS NULL AND ${table.conversationId} IS NOT NULL)`
  ),
]);
