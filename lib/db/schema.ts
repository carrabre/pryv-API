import type {InferSelectModel} from 'drizzle-orm'
import {
  pgTable,
  varchar,
  timestamp,
  json,
  uuid,
  text,
  index,
  primaryKey,
  foreignKey,
  boolean,
} from 'drizzle-orm/pg-core'

export const user = pgTable(
  'User',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    email: varchar('email', {length: 64}),
    password: varchar('password', {length: 64}),
    walletAddress: varchar('walletAddress', {length: 42}),
    authType: varchar('authType').notNull().default('email'),
  },
  (table) => ({
    emailIdx: index('User_email_idx').on(table.email),
  }),
)

export type User = InferSelectModel<typeof user>

export const chat = pgTable(
  'Chat',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    visibility: varchar('visibility', {enum: ['public', 'private']})
      .notNull()
      .default('private'),
  },
  (table) => ({
    userIdCreatedAtIdx: index('Chat_userId_createdAt_idx').on(table.userId, table.createdAt.desc()),
  }),
)

export type Chat = InferSelectModel<typeof chat>

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  content: json('content').notNull(),
  createdAt: timestamp('createdAt').notNull(),
})

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>

export const message = pgTable(
  'Message_v2',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    role: varchar('role').notNull(),
    parts: json('parts').notNull(),
    attachments: json('attachments').notNull(),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    chatIdCreatedAtIdx: index('Message_v2_chatId_createdAt_idx').on(table.chatId, table.createdAt),
    chatIdRoleCreatedAtIdx: index('Message_v2_chatId_role_createdAt_idx').on(
      table.chatId,
      table.role,
      table.createdAt,
    ),
  }),
)

export type DBMessage = InferSelectModel<typeof message>

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  'Vote',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({columns: [table.chatId, table.messageId]}),
    }
  },
)

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>

export const vote = pgTable(
  'Vote_v2',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({columns: [table.chatId, table.messageId]}),
    }
  },
)

export type Vote = InferSelectModel<typeof vote>

export const document = pgTable(
  'Document',
  {
    id: uuid('id').notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('text', {enum: ['text', 'code', 'image', 'sheet']})
      .notNull()
      .default('text'),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({columns: [table.id, table.createdAt]}),
    }
  },
)

export type Document = InferSelectModel<typeof document>

export const suggestion = pgTable(
  'Suggestion',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId').notNull(),
    documentCreatedAt: timestamp('documentCreatedAt').notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: boolean('isResolved').notNull().default(false),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({columns: [table.id]}),
    documentIdCreatedAtIdx: index('Suggestion_documentId_createdAt_idx').on(
      table.documentId,
      table.documentCreatedAt,
    ),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  }),
)

export type Suggestion = InferSelectModel<typeof suggestion>

export const stream = pgTable(
  'Stream',
  {
    id: uuid('id').notNull().defaultRandom(),
    chatId: uuid('chatId').notNull(),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({columns: [table.id]}),
    chatIdCreatedAtIdx: index('Stream_chatId_createdAt_idx').on(table.chatId, table.createdAt),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  }),
)

export type Stream = InferSelectModel<typeof stream>
