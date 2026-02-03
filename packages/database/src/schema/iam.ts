/**
 * IAM Schema - Identity and Access Management
 *
 * Core tables for users, organizations, memberships, and sessions.
 * This is the foundation of the multi-tenant architecture.
 */
import { relations, sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

// Define the IAM schema
export const iamSchema = pgSchema("iam")

// ============================================================================
// ENUMS
// ============================================================================

export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "member"])
export const userStatusEnum = pgEnum("user_status", ["active", "disabled", "invited"])

// ============================================================================
// TABLES
// ============================================================================

/**
 * Users table - Core user identity
 */
export const users = iamSchema.table(
  "users",
  {
    userId: uuid("user_id").defaultRandom().primaryKey(),
    email: text("email"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    passwordHash: text("password_hash"),
    clerkId: text("clerk_id"), // Legacy Clerk integration
    emailVerified: boolean("email_verified").default(false),
    inviteCode: text("invite_code"),
    status: userStatusEnum("status").default("active").notNull(),
    isTestEnv: boolean("is_test_env").default(false).notNull(),
    testRunId: text("test_run_id"), // For E2E test isolation
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index("users_email_idx").on(table.email),
    index("users_clerk_id_idx").on(table.clerkId),
    index("users_invite_code_idx").on(table.inviteCode),
    index("users_test_run_id_idx").on(table.testRunId),
  ],
)

/**
 * Organizations table - Multi-tenant containers
 */
export const orgs = iamSchema.table(
  "orgs",
  {
    orgId: uuid("org_id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    credits: integer("credits").default(0).notNull(),
    isTestEnv: boolean("is_test_env").default(false),
    testRunId: text("test_run_id"), // For E2E test isolation
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  table => [index("orgs_name_idx").on(table.name), index("orgs_test_run_id_idx").on(table.testRunId)],
)

/**
 * Organization memberships - Links users to organizations
 */
export const orgMemberships = iamSchema.table(
  "org_memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.orgId, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  table => [primaryKey({ columns: [table.userId, table.orgId] }), index("org_memberships_org_id_idx").on(table.orgId)],
)

/**
 * Sessions table - Claude SDK conversation sessions
 */
export const sessions = iamSchema.table(
  "sessions",
  {
    sessionId: uuid("session_id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    domainId: text("domain_id").notNull(), // Workspace identifier
    tabId: text("tab_id").notNull(), // Browser tab identifier
    sdkSessionId: text("sdk_session_id").notNull(), // Claude SDK session ID
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastActivity: timestamp("last_activity", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  table => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_domain_tab_idx").on(table.domainId, table.tabId),
    index("sessions_sdk_session_id_idx").on(table.sdkSessionId),
  ],
)

/**
 * User preferences - User settings and workspace preferences
 */
export const userPreferences = iamSchema.table("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.userId, { onDelete: "cascade" }),
  currentWorkspace: text("current_workspace"),
  recentWorkspaces: jsonb("recent_workspaces").default([]).notNull(),
  selectedOrgId: uuid("selected_org_id").references(() => orgs.orgId, { onDelete: "set null" }),
  preferences: jsonb("preferences").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

/**
 * Organization invites - Pending invitations to join orgs
 */
export const orgInvites = iamSchema.table(
  "org_invites",
  {
    inviteId: uuid("invite_id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.orgId, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: orgRoleEnum("role").default("member").notNull(),
    token: text("token").notNull(),
    invitedBy: uuid("invited_by").references(() => users.userId, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index("org_invites_email_idx").on(table.email),
    index("org_invites_token_idx").on(table.token),
    index("org_invites_org_id_idx").on(table.orgId),
  ],
)

/**
 * Email invites - Beta/waitlist invitations
 */
export const emailInvites = iamSchema.table(
  "email_invites",
  {
    emailInviteId: uuid("email_invite_id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [index("email_invites_email_idx").on(table.email)],
)

/**
 * Referrals - User referral tracking
 */
export const referrals = iamSchema.table(
  "referrals",
  {
    referralId: uuid("referral_id").defaultRandom().primaryKey(),
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    referredId: uuid("referred_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    status: text("status").default("pending").notNull(),
    creditsAwarded: integer("credits_awarded").default(0).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index("referrals_referrer_id_idx").on(table.referrerId),
    index("referrals_referred_id_idx").on(table.referredId),
  ],
)

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  orgMemberships: many(orgMemberships),
  sessions: many(sessions),
  preferences: one(userPreferences, {
    fields: [users.userId],
    references: [userPreferences.userId],
  }),
  sentInvites: many(emailInvites),
  referralsGiven: many(referrals, { relationName: "referrer" }),
  referralsReceived: many(referrals, { relationName: "referred" }),
}))

export const orgsRelations = relations(orgs, ({ many }) => ({
  memberships: many(orgMemberships),
  invites: many(orgInvites),
}))

export const orgMembershipsRelations = relations(orgMemberships, ({ one }) => ({
  user: one(users, {
    fields: [orgMemberships.userId],
    references: [users.userId],
  }),
  org: one(orgs, {
    fields: [orgMemberships.orgId],
    references: [orgs.orgId],
  }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.userId],
  }),
}))

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.userId],
  }),
  selectedOrg: one(orgs, {
    fields: [userPreferences.selectedOrgId],
    references: [orgs.orgId],
  }),
}))

export const orgInvitesRelations = relations(orgInvites, ({ one }) => ({
  org: one(orgs, {
    fields: [orgInvites.orgId],
    references: [orgs.orgId],
  }),
  invitedByUser: one(users, {
    fields: [orgInvites.invitedBy],
    references: [users.userId],
  }),
}))

export const emailInvitesRelations = relations(emailInvites, ({ one }) => ({
  sender: one(users, {
    fields: [emailInvites.senderId],
    references: [users.userId],
  }),
}))

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.userId],
    relationName: "referrer",
  }),
  referred: one(users, {
    fields: [referrals.referredId],
    references: [users.userId],
    relationName: "referred",
  }),
}))
