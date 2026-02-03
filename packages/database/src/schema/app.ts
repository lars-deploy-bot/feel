/**
 * App Schema - Application Data
 *
 * Tables for domains, conversations, messages, automations, templates, etc.
 * This is the main application data layer.
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

// Import IAM schema for foreign keys
import { users, orgs } from "./iam"

// Define the App schema
export const appSchema = pgSchema("app")

// ============================================================================
// ENUMS
// ============================================================================

export const automationActionTypeEnum = pgEnum("automation_action_type", ["prompt", "sync", "publish"])

export const automationRunStatusEnum = pgEnum("automation_run_status", [
  "pending",
  "running",
  "success",
  "failure",
  "skipped",
])

export const automationTriggerTypeEnum = pgEnum("automation_trigger_type", ["cron", "webhook", "one-time"])

export const severityLevelEnum = pgEnum("severity_level", ["info", "warn", "error", "debug", "fatal"])

// ============================================================================
// TABLES
// ============================================================================

/**
 * Servers - Physical/virtual servers hosting sites
 */
export const servers = appSchema.table("servers", {
  serverId: uuid("server_id").primaryKey(),
  name: text("name").notNull(),
  ip: text("ip").notNull(),
  hostname: text("hostname"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

/**
 * Domains - Deployed websites/workspaces
 */
export const domains = appSchema.table(
  "domains",
  {
    domainId: uuid("domain_id").defaultRandom().primaryKey(),
    hostname: text("hostname").notNull(),
    port: integer("port").notNull(),
    orgId: uuid("org_id"), // Can be null for legacy domains
    serverId: uuid("server_id").references(() => servers.serverId, { onDelete: "set null" }),
    isTestEnv: boolean("is_test_env").default(false),
    testRunId: text("test_run_id"), // For E2E test isolation
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index("domains_hostname_idx").on(table.hostname),
    index("domains_org_id_idx").on(table.orgId),
    index("domains_test_run_id_idx").on(table.testRunId),
  ],
)

/**
 * Templates - Site templates for deployment
 */
export const templates = appSchema.table(
  "templates",
  {
    templateId: uuid("template_id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    aiDescription: text("ai_description"), // Description for AI selection
    sourcePath: text("source_path").notNull(), // Path to template files
    previewUrl: text("preview_url"),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").default(true),
    deployCount: integer("deploy_count").default(0),
  },
  table => [index("templates_name_idx").on(table.name)],
)

/**
 * Conversations - Chat conversation containers
 */
export const conversations = appSchema.table(
  "conversations",
  {
    conversationId: uuid("conversation_id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(), // User who owns the conversation
    orgId: text("org_id").notNull(), // Organization context
    workspace: text("workspace").notNull(), // Associated workspace/domain
    title: text("title").default("New Conversation").notNull(),
    autoTitleSet: boolean("auto_title_set").default(false).notNull(),
    visibility: text("visibility").default("private").notNull(),
    messageCount: integer("message_count").default(0).notNull(),
    firstUserMessageId: text("first_user_message_id"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index("conversations_user_id_idx").on(table.userId),
    index("conversations_org_id_idx").on(table.orgId),
    index("conversations_workspace_idx").on(table.workspace),
    index("conversations_created_at_idx").on(table.createdAt),
  ],
)

/**
 * Conversation tabs - Multiple tabs within a conversation
 */
export const conversationTabs = appSchema.table(
  "conversation_tabs",
  {
    tabId: uuid("tab_id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.conversationId, { onDelete: "cascade" }),
    name: text("name").default("Tab").notNull(),
    position: integer("position").default(0).notNull(),
    messageCount: integer("message_count").default(0).notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index("conversation_tabs_conversation_id_idx").on(table.conversationId),
    index("conversation_tabs_position_idx").on(table.position),
  ],
)

/**
 * Messages - Individual chat messages
 */
export const messages = appSchema.table(
  "messages",
  {
    messageId: uuid("message_id").defaultRandom().primaryKey(),
    tabId: uuid("tab_id")
      .notNull()
      .references(() => conversationTabs.tabId, { onDelete: "cascade" }),
    seq: integer("seq").notNull(), // Sequence number within tab
    type: text("type").notNull(), // 'user', 'assistant', 'system', 'tool_use', 'tool_result'
    content: jsonb("content").notNull(), // Message content blocks
    status: text("status").default("complete").notNull(),
    errorCode: text("error_code"),
    abortedAt: timestamp("aborted_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index("messages_tab_id_idx").on(table.tabId),
    index("messages_tab_seq_idx").on(table.tabId, table.seq),
    index("messages_created_at_idx").on(table.createdAt),
  ],
)

/**
 * Automation jobs - Scheduled/triggered automation tasks
 */
export const automationJobs = appSchema.table(
  "automation_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => domains.domainId, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    triggerType: automationTriggerTypeEnum("trigger_type").notNull(),
    actionType: automationActionTypeEnum("action_type").notNull(),

    // Cron settings
    cronSchedule: text("cron_schedule"),
    cronTimezone: text("cron_timezone"),
    runAt: timestamp("run_at", { withTimezone: true }), // For one-time runs

    // Action settings
    actionPrompt: text("action_prompt"),
    actionModel: text("action_model"),
    actionFormatPrompt: text("action_format_prompt"),
    actionSource: jsonb("action_source"),
    actionTargetPage: text("action_target_page"),
    actionTimeoutSeconds: integer("action_timeout_seconds"),
    skills: text("skills").array(),

    // Webhook settings
    webhookSecret: text("webhook_secret"),

    // State
    isActive: boolean("is_active").default(true).notNull(),
    runningAt: timestamp("running_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunStatus: automationRunStatusEnum("last_run_status"),
    lastRunError: text("last_run_error"),
    lastRunDurationMs: integer("last_run_duration_ms"),
    consecutiveFailures: integer("consecutive_failures").default(0),
    deleteAfterRun: boolean("delete_after_run").default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index("automation_jobs_site_id_idx").on(table.siteId),
    index("automation_jobs_user_id_idx").on(table.userId),
    index("automation_jobs_next_run_at_idx").on(table.nextRunAt),
    index("automation_jobs_is_active_idx").on(table.isActive),
  ],
)

/**
 * Automation runs - Individual execution records
 */
export const automationRuns = appSchema.table(
  "automation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => automationJobs.id, { onDelete: "cascade" }),
    status: automationRunStatusEnum("status").default("pending").notNull(),
    triggeredBy: text("triggered_by"), // 'cron', 'webhook', 'manual'
    triggerContext: jsonb("trigger_context"),
    result: jsonb("result"),
    messages: jsonb("messages"), // Conversation messages during run
    changesMade: text("changes_made").array(),
    error: text("error"),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  table => [
    index("automation_runs_job_id_idx").on(table.jobId),
    index("automation_runs_status_idx").on(table.status),
    index("automation_runs_started_at_idx").on(table.startedAt),
  ],
)

/**
 * User quotas - Resource limits per user
 */
export const userQuotas = appSchema.table("user_quotas", {
  userId: text("user_id").primaryKey(),
  maxSites: integer("max_sites").default(3).notNull(),
  maxStorageMb: integer("max_storage_mb"),
  maxMonthlyBuilds: integer("max_monthly_builds"),
  maxCustomDomains: integer("max_custom_domains"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

/**
 * User onboarding - Onboarding questionnaire data
 */
export const userOnboarding = appSchema.table("user_onboarding", {
  userId: text("user_id").primaryKey(),
  orgId: text("org_id"),
  status: text("status").default("pending").notNull(),
  experience: text("experience").default("beginner").notNull(),
  role: text("role"),
  industry: text("industry"),
  primaryGoal: text("primary_goal"),
  successMetric: text("success_metric"),
  teamSize: integer("team_size"),
  timeBudgetMinPerWeek: integer("time_budget_min_per_week"),
  autonomy: text("autonomy").default("assisted").notNull(),
  approvalRules: jsonb("approval_rules").default({}).notNull(),
  topTasks: text("top_tasks").array().default([]).notNull(),
  preferredApps: text("preferred_apps").array().default([]).notNull(),
  dataSources: text("data_sources").array().default([]).notNull(),
  notifyChannels: text("notify_channels").array().default([]).notNull(),
  timezone: text("timezone"),
  locale: text("locale"),
  ipAddress: text("ip_address"),
  marketingOptIn: boolean("marketing_opt_in").default(false).notNull(),
  tosAcceptedAt: timestamp("tos_accepted_at", { withTimezone: true }),
  privacyAcceptedAt: timestamp("privacy_accepted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

/**
 * User profile - Extended user information
 */
export const userProfile = appSchema.table("user_profile", {
  userProfileId: uuid("user_profile_id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  about: text("about"),
  goals: text("goals"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

/**
 * Gateway settings - AI model gateway configurations
 */
export const gatewaySettings = appSchema.table(
  "gateway_settings",
  {
    gatewaySettingId: uuid("gateway_setting_id").defaultRandom().primaryKey(),
    clerkId: text("clerk_id").notNull(),
    gateway: text("gateway").notNull(), // 'anthropic', 'openai', etc.
    isEnabled: boolean("is_enabled").default(true).notNull(),
    enabledModels: jsonb("enabled_models").default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [index("gateway_settings_clerk_id_idx").on(table.clerkId)],
)

/**
 * Feedback - User feedback submissions
 */
export const feedback = appSchema.table("feedback", {
  feedbackId: uuid("feedback_id").defaultRandom().primaryKey(),
  userId: text("user_id"),
  content: text("content").notNull(),
  context: jsonb("context"), // Page, conversation, etc.
  status: text("status").default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

/**
 * Errors - Error tracking and aggregation
 */
export const errors = appSchema.table(
  "errors",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    hash: text("hash").notNull(), // Unique error signature
    message: text("message").notNull(),
    stack: text("stack"),
    location: text("location").notNull(),
    env: text("env").notNull(), // 'development', 'staging', 'production'
    severity: severityLevelEnum("severity").default("error").notNull(),
    clerkId: text("clerk_id"),
    error: jsonb("error"),
    totalCount: integer("total_count").default(1).notNull(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index("errors_hash_idx").on(table.hash),
    index("errors_severity_idx").on(table.severity),
    index("errors_env_idx").on(table.env),
    index("errors_last_seen_idx").on(table.lastSeen),
  ],
)

// ============================================================================
// RELATIONS
// ============================================================================

export const domainsRelations = relations(domains, ({ one, many }) => ({
  server: one(servers, {
    fields: [domains.serverId],
    references: [servers.serverId],
  }),
  automationJobs: many(automationJobs),
}))

export const conversationsRelations = relations(conversations, ({ many }) => ({
  tabs: many(conversationTabs),
}))

export const conversationTabsRelations = relations(conversationTabs, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [conversationTabs.conversationId],
    references: [conversations.conversationId],
  }),
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  tab: one(conversationTabs, {
    fields: [messages.tabId],
    references: [conversationTabs.tabId],
  }),
}))

export const automationJobsRelations = relations(automationJobs, ({ one, many }) => ({
  site: one(domains, {
    fields: [automationJobs.siteId],
    references: [domains.domainId],
  }),
  runs: many(automationRuns),
}))

export const automationRunsRelations = relations(automationRuns, ({ one }) => ({
  job: one(automationJobs, {
    fields: [automationRuns.jobId],
    references: [automationJobs.id],
  }),
}))
