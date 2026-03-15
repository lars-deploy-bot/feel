/**
 * ============================================================================
 * PRODUCT DEFAULTS — THE STRATEGY IS THE CONFIG
 * ============================================================================
 *
 * This file defines what every new user, workspace, and organization gets
 * out of the box. These aren't settings. They're product decisions.
 *
 * Every default here answers the question: "If the user never opens settings,
 * what should Alive be doing for them?"
 *
 * Rules:
 * 1. If it creates a habit, it's ON by default
 * 2. If it accumulates value over time, it's ON by default
 * 3. If it makes the product visible to non-users, it's ON by default
 * 4. If removing it would make a user feel like they lost something, it's ON
 * 5. If it only matters at scale (50+ users), it's OFF until then
 *
 * When changing a default, you're changing the product strategy.
 * Treat it like changing the price.
 *
 * ============================================================================
 * MARKET CONTEXT
 * ============================================================================
 *
 * The gap Alive fills: at every $10M-$50M SaaS company, the support:engineer
 * ratio is broken. 15 support staff for 20 engineers. The humans can't keep up
 * with the promises the product makes. OAuth breaks. Integrations fail silently.
 * Regressions hit production. Support gets tickets engineers should've caught.
 *
 * Alive targets the space between what the product does and what support has
 * to fix. Not replacing engineers — replacing the 3 AM silence when nobody's
 * watching production.
 *
 * Three feature-market-fits, in order:
 *
 * 1. "support@ that actually replies"
 *    An email address connected to an AI agent that responds in character,
 *    with threading, context, and loop guards. Every reply is distribution.
 *    The customer doesn't know it's AI. They just know this company is fast.
 *
 * 2. "Deploy and forget"
 *    The site monitors itself, fixes broken links, updates dependencies,
 *    emails you a Monday morning report. The product name IS this feature.
 *    Alive = your site takes care of itself.
 *
 * 3. "Anyone on the team can change the site"
 *    Non-technical person types "change the pricing to $49" → sees it live.
 *    Not building sites (Lovable owns that). Changing EXISTING live sites.
 */

// =============================================================================
// New User Defaults
// =============================================================================

export const USER_DEFAULTS = {
  /** Credits given on signup. Enough for ~50 agent conversations on Haiku. */
  FREE_CREDITS: 100,

  /**
   * Daily free credits for active users. Enough for ~5 email replies
   * or 1 site health check. This is the retention mechanic —
   * users come back every day because there's fresh value waiting.
   * Lovable proved this model works at scale with 3-5 daily credits.
   */
  DAILY_FREE_CREDITS: 10,

  /** Maximum sites a free user can deploy */
  MAX_SITES: 2,

  /** Default model — Haiku for cost efficiency on credits */
  DEFAULT_MODEL: "claude-haiku-4-5" as const,

  /** Model for users with their own API key — best available */
  DEFAULT_MODEL_OWN_KEY: "claude-sonnet-4-6" as const,

  /** Session lifetime before re-auth required */
  SESSION_TTL_DAYS: 30,

  /** Max concurrent agent workers per user */
  MAX_CONCURRENT_WORKERS: 3,

  /** Max agent turns per conversation */
  MAX_TURNS: 100,

  /** Admins get 2x turns */
  ADMIN_TURN_MULTIPLIER: 2,
} as const

// =============================================================================
// New Organization Defaults
// =============================================================================

export const ORG_DEFAULTS = {
  /**
   * Auto-join by email domain.
   * When a second @company.com user signs up, suggest joining the existing org.
   * This is the land-and-expand mechanism. One person creates the beachhead,
   * everyone else expands it. Leaving means affecting your teammates.
   */
  DOMAIN_AUTO_JOIN: true,

  /**
   * Share workspace access across org members by default.
   * Everyone in the org can see every workspace. This creates shared context
   * and makes individual departure affect the team.
   */
  SHARED_WORKSPACE_ACCESS: true,

  /** Default role for auto-joined users */
  AUTO_JOIN_ROLE: "member" as const,
} as const

// =============================================================================
// Workspace Defaults — What happens when a site is created
// =============================================================================

export const WORKSPACE_DEFAULTS = {
  /** Template for new deployments */
  DEFAULT_TEMPLATE: "tmpl_blank",

  /** Live preview enabled — user sees changes as agent makes them */
  LIVE_PREVIEW: true,

  /** Tabs enabled — multiple conversations per workspace */
  TABS: true,
} as const

// =============================================================================
// Automation Defaults — The habit layer
// =============================================================================

export const AUTOMATION_DEFAULTS = {
  /**
   * Auto-create a weekly health check when a site deploys.
   * Every Monday at 9 AM UTC: check broken links, outdated deps, SSL, uptime.
   * This is the daily prep email equivalent. User didn't ask for it.
   * After 4 Mondays they depend on it. After 12 they can't leave without
   * losing their monitoring.
   */
  AUTO_CREATE_HEALTH_CHECK: true,

  /** Day of week for auto health check (0 = Sunday, 1 = Monday) */
  HEALTH_CHECK_DAY: 1,

  /** Hour (UTC) for auto health check */
  HEALTH_CHECK_HOUR_UTC: 9,

  /** Send health check results by email */
  HEALTH_CHECK_EMAIL: true,

  /** Maximum consecutive failures before disabling a cron job */
  MAX_CONSECUTIVE_FAILURES: 3,

  /** Base retry delay (exponential backoff with 20% jitter) */
  RETRY_BASE_DELAY_MS: 60_000,

  /** Lease buffer beyond action timeout (seconds) */
  LEASE_BUFFER_SECONDS: 120,

  /** Heartbeat interval to prove worker is alive */
  HEARTBEAT_INTERVAL_MS: 30_000,

  /** Default action timeout for automations (seconds) */
  DEFAULT_TIMEOUT_SECONDS: 300,

  /** Max run log entries before pruning */
  MAX_LOG_ENTRIES: 1000,

  /** Max log file size before pruning (bytes) */
  MAX_LOG_SIZE_BYTES: 2 * 1024 * 1024,
} as const

// =============================================================================
// Email Agent Defaults — Feature-market-fit #1
// =============================================================================

export const EMAIL_AGENT_DEFAULTS = {
  /**
   * When email trigger is connected, the agent replies in character.
   * Responses extracted via tool call (send_reply), not text parsing.
   * This is the meeting bot equivalent — it handles conversations
   * while you sleep.
   */
  ENABLED: true,

  /** Max conversation depth before stopping (prevents infinite loops) */
  MAX_THREAD_DEPTH: 8,

  /** Max characters per message in thread context */
  MAX_CHARS_PER_MESSAGE: 1200,

  /** Max total characters for conversation history */
  MAX_TOTAL_CHARS: 6000,

  /** Reconnect delay on IMAP disconnect */
  RECONNECT_DELAY_MS: 5000,

  /** Tool name for response extraction */
  RESPONSE_TOOL: "send_reply" as const,
} as const

// =============================================================================
// Site Intelligence Defaults — The data moat
// =============================================================================

export const INTELLIGENCE_DEFAULTS = {
  /**
   * Auto-generate decision log entries from agent conversations.
   * Every agent run produces: what changed, why, what dependencies added,
   * architecture decisions, security considerations.
   *
   * After 6 months this tab contains the entire decision history of the project.
   * This doesn't exist in git commits, not in docs, not in anyone's head.
   * Only in Alive. This is the call recordings equivalent — data hostage.
   */
  AUTO_LOG_DECISIONS: true,

  /** Store structured summaries of each agent run */
  STORE_RUN_SUMMARIES: true,
} as const

// =============================================================================
// Distribution Defaults — The product spreads through usage
// =============================================================================

export const DISTRIBUTION_DEFAULTS = {
  /**
   * "Built with Alive" badge on deployed sites.
   * Default ON for free tier. Removable on paid.
   * This is the meeting bot appearing in calls — every visitor to every
   * deployed site is a potential lead. The user didn't opt into being
   * a distribution channel. They just used the product.
   */
  SHOW_BADGE: true,

  /** Badge removable for paid workspaces */
  BADGE_REMOVABLE_ON_PAID: true,

  /**
   * Deploy reports — shareable pages showing what was built.
   * Auto-generated on deploy. Designed to look impressive.
   * Users share them because it makes THEM look good.
   * Recipients click through to an Alive-hosted page.
   * This is the meeting preread equivalent — product markets itself
   * as a side effect of usage.
   */
  AUTO_GENERATE_DEPLOY_REPORT: true,

  /** Deploy reports are publicly accessible by default */
  DEPLOY_REPORT_PUBLIC: true,
} as const

// =============================================================================
// Referral Defaults
// =============================================================================

export const REFERRAL_DEFAULTS = {
  /** Referral system enabled */
  ENABLED: false, // Enable when ready for growth phase (v0.4)

  /** Credits awarded to both parties */
  CREDITS: 500,

  /** Referral code expiry in localStorage */
  EXPIRY_DAYS: 30,

  /** Max invite emails per user per day */
  EMAIL_DAILY_LIMIT: 10,

  /** Max account age to redeem referral (prevents existing user exploit) */
  ACCOUNT_AGE_LIMIT_MS: 24 * 60 * 60 * 1000,
} as const

// =============================================================================
// Worker Pool Defaults — Infrastructure
// =============================================================================

export const WORKER_DEFAULTS = {
  /** Persistent workers (vs spawn-per-request) */
  ENABLED: true,

  /** Max workers (~100MB memory each) */
  MAX_WORKERS: 20,

  /** Idle timeout before termination */
  INACTIVITY_TIMEOUT_MS: 15 * 60 * 1000,

  /** Max age before forced restart */
  MAX_AGE_MS: 60 * 60 * 1000,

  /** Workers per CPU core */
  WORKERS_PER_CORE: 1.5,

  /** Load shed when system load exceeds this ratio */
  LOAD_SHED_THRESHOLD: 2.0,

  /** Max concurrent workers per user */
  MAX_PER_USER: 3,

  /** Max concurrent workers per workspace */
  MAX_PER_WORKSPACE: 6,

  /** Max queued requests globally */
  MAX_QUEUED_GLOBAL: 200,
} as const

// =============================================================================
// Pricing Defaults
// =============================================================================

export const PRICING_DEFAULTS = {
  /** 10 tokens = $1 (1 token = $0.10) */
  TOKENS_PER_DOLLAR: 10,

  /** Model pricing per million tokens (USD) */
  MODELS: {
    "claude-opus-4-6": { input: 5, output: 25 },
    "claude-sonnet-4-6": { input: 3, output: 15, tierInput: 6, tierOutput: 22.5, tierThreshold: 200_000 },
    "claude-haiku-4-5": { input: 1, output: 5 },
  },
} as const

// =============================================================================
// Feature Flags — Progressive capability rollout
// =============================================================================

export const FEATURE_FLAG_DEFAULTS = {
  /** Agent supervisor (auto-suggest next action) */
  AGENT_SUPERVISOR: false,

  /** Multiple conversation tabs per workspace */
  TABS: true,

  /** File manager panel */
  DRIVE: false,

  /** Git worktree switching */
  WORKTREES: false,
} as const

// =============================================================================
// The complete product config, assembled
// =============================================================================

export const PRODUCT_DEFAULTS = {
  user: USER_DEFAULTS,
  org: ORG_DEFAULTS,
  workspace: WORKSPACE_DEFAULTS,
  automation: AUTOMATION_DEFAULTS,
  emailAgent: EMAIL_AGENT_DEFAULTS,
  intelligence: INTELLIGENCE_DEFAULTS,
  distribution: DISTRIBUTION_DEFAULTS,
  referral: REFERRAL_DEFAULTS,
  worker: WORKER_DEFAULTS,
  pricing: PRICING_DEFAULTS,
  featureFlags: FEATURE_FLAG_DEFAULTS,
} as const

/**
 * ============================================================================
 * READING THIS FILE
 * ============================================================================
 *
 * If every default in this file was applied to a new signup, here's what
 * happens automatically:
 *
 * Minute 0:  User signs up. Gets 100 credits. Haiku model selected.
 * Minute 1:  First chat. Agent builds in workspace. Live preview shows changes.
 * Minute 5:  One-click deploy. Site goes live. "Built with Alive" badge appears.
 * Minute 6:  Health check automation auto-created for Monday 9 AM UTC.
 * Minute 7:  Deploy report auto-generated. Shareable link ready.
 * Day 2:     10 daily free credits deposited. User returns to iterate.
 * Day 7:     Monday health check runs. Email sent with results.
 * Day 14:    Second @company.com user signs up. Joins existing org automatically.
 * Day 30:    Site intelligence tab has 20+ decision log entries.
 *            Health check has run 4 times. User expects the Monday email.
 *            Deploy report was shared with 3 people who clicked through.
 *            100 site visitors saw the "Built with Alive" badge.
 *            Leaving now means losing: monitoring, decision history,
 *            deploy reports, and the teammate who just joined.
 *
 * ============================================================================
 * WHAT THIS FILE TARGETS
 * ============================================================================
 *
 * The broken ratio at every growth-stage SaaS:
 *
 *   15 support staff : 20 engineers
 *
 * For every 4 engineers building the product, 3 people are supporting it.
 * OAuth breaks. Integrations fail silently. Regressions hit production.
 * One security engineer for a product reading people's inboxes.
 * One data engineer for millions of events. Creative outnumbers product eng.
 *
 * Alive doesn't replace engineers. It targets the gap between what the product
 * promises and what support has to fix:
 *
 * | Alive capability              | Pain it solves                         |
 * |-------------------------------|----------------------------------------|
 * | Email agent (IMAP watcher)    | Support team manually answering emails |
 * | Auto health check on deploy   | Regressions hitting production silently|
 * | Site intelligence log         | "Why did we build it this way?" — lost |
 * | Cron agents for monitoring    | Engineers can't watch prod 24/7        |
 * | Agent that runs test suites   | QA catches bugs after customers do     |
 * | Agent that grinds migrations  | Engineers doing boilerplate, not depth |
 *
 * The goal: cut the support:engineer ratio from 15:20 to 8:20.
 * Not by hiring. By making the product catch its own failures overnight.
 */
