/**
 * Database schema for Users & Workspaces
 * Migration from domain-passwords.json to relational database
 */

import { relations, sql } from "drizzle-orm"
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core"

// ============================================================================
// USERS TABLE
// ============================================================================

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // UUID
    email: text("email").notNull(), // Unique login identifier
    passwordHash: text("password_hash").notNull(), // bcrypt hash
    name: text("name"), // Display name (optional)
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    lastLoginAt: integer("last_login_at", { mode: "timestamp" }), // Track last login
  },
  table => ({
    emailIdx: unique("email_unique").on(table.email), // Unique constraint on email
  }),
)

export const usersRelations = relations(users, ({ many }) => ({
  userWorkspaces: many(userWorkspaces),
  sessions: many(sessions),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// ============================================================================
// WORKSPACES TABLE
// ============================================================================

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(), // UUID (reuse existing tenantId from JSON)
    domain: text("domain").notNull(), // e.g., "demo.goalive.nl"
    port: integer("port").notNull(), // Service port (3333, 3334, etc.)
    credits: integer("credits").notNull().default(200), // Claude credits
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  table => ({
    domainIdx: unique("domain_unique").on(table.domain), // Unique constraint on domain
  }),
)

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  userWorkspaces: many(userWorkspaces),
  sessions: many(sessions),
}))

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert

// ============================================================================
// USER_WORKSPACES TABLE (Junction Table)
// ============================================================================

export const userWorkspaces = sqliteTable(
  "user_workspaces",
  {
    id: text("id").primaryKey(), // UUID
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member", "viewer"] })
      .notNull()
      .default("member"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  table => ({
    // Unique constraint: one user can have one role per workspace
    userWorkspaceIdx: unique("user_workspace_unique").on(table.userId, table.workspaceId),
    // Index for fast lookups by userId
    userIdx: index("user_workspaces_user_idx").on(table.userId),
    // Index for fast lookups by workspaceId
    workspaceIdx: index("user_workspaces_workspace_idx").on(table.workspaceId),
  }),
)

export const userWorkspacesRelations = relations(userWorkspaces, ({ one }) => ({
  user: one(users, {
    fields: [userWorkspaces.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [userWorkspaces.workspaceId],
    references: [workspaces.id],
  }),
}))

export type UserWorkspace = typeof userWorkspaces.$inferSelect
export type NewUserWorkspace = typeof userWorkspaces.$inferInsert

// ============================================================================
// SESSIONS TABLE (Claude SDK Session Persistence)
// ============================================================================

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // UUID
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").notNull(), // Frontend UUID
    sdkSessionId: text("sdk_session_id").notNull(), // Anthropic SDK session ID
    lastActivity: integer("last_activity", { mode: "timestamp" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  table => ({
    // Unique constraint: one session per user + workspace + conversation
    sessionIdx: unique("session_unique").on(table.userId, table.workspaceId, table.conversationId),
    // Index for cleanup queries (find expired sessions)
    expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt),
    // Index for lookups by conversationId
    conversationIdx: index("sessions_conversation_idx").on(table.conversationId),
  }),
)

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [sessions.workspaceId],
    references: [workspaces.id],
  }),
}))

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
