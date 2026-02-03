CREATE SCHEMA "app";
--> statement-breakpoint
CREATE SCHEMA "iam";
--> statement-breakpoint
CREATE SCHEMA "integrations";
--> statement-breakpoint
CREATE SCHEMA "lockbox";
--> statement-breakpoint
CREATE TYPE "app"."automation_action_type" AS ENUM('prompt', 'sync', 'publish');--> statement-breakpoint
CREATE TYPE "app"."automation_run_status" AS ENUM('pending', 'running', 'success', 'failure', 'skipped');--> statement-breakpoint
CREATE TYPE "app"."automation_trigger_type" AS ENUM('cron', 'webhook', 'one-time');--> statement-breakpoint
CREATE TYPE "iam"."org_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "app"."severity_level" AS ENUM('info', 'warn', 'error', 'debug', 'fatal');--> statement-breakpoint
CREATE TYPE "iam"."user_status" AS ENUM('active', 'disabled', 'invited');--> statement-breakpoint
CREATE TABLE "integrations"."access_policies" (
	"policy_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "access_policies_provider_id_user_id_key" UNIQUE("provider_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "app"."automation_jobs" (
	"id" text PRIMARY KEY DEFAULT gen_prefixed_id('auto_job_'::text) NOT NULL,
	"site_id" text NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_type" "app"."automation_trigger_type" NOT NULL,
	"action_type" "app"."automation_action_type" NOT NULL,
	"cron_schedule" text,
	"cron_timezone" text,
	"run_at" timestamp with time zone,
	"action_prompt" text,
	"action_model" text,
	"action_format_prompt" text,
	"action_source" jsonb,
	"action_target_page" text,
	"action_timeout_seconds" integer DEFAULT 300,
	"skills" text[] DEFAULT '{}',
	"webhook_secret" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"delete_after_run" boolean DEFAULT false,
	"running_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_run_status" "app"."automation_run_status",
	"last_run_error" text,
	"last_run_duration_ms" integer,
	"consecutive_failures" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_cron_schedule" CHECK ((trigger_type <> 'cron'::app.automation_trigger_type) OR (cron_schedule IS NOT NULL)),
	CONSTRAINT "chk_one_time_run_at" CHECK ((trigger_type <> 'one-time'::app.automation_trigger_type) OR (run_at IS NOT NULL)),
	CONSTRAINT "chk_prompt_action" CHECK ((action_type <> 'prompt'::app.automation_action_type) OR (action_prompt IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "app"."automation_runs" (
	"id" text PRIMARY KEY DEFAULT gen_prefixed_id('auto_run_'::text) NOT NULL,
	"job_id" text NOT NULL,
	"status" "app"."automation_run_status" DEFAULT 'pending' NOT NULL,
	"triggered_by" text,
	"trigger_context" jsonb,
	"result" jsonb,
	"messages" jsonb,
	"changes_made" text[],
	"error" text,
	"duration_ms" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."conversation_tabs" (
	"tab_id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"conversation_id" text NOT NULL,
	"name" text DEFAULT 'current' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."conversations" (
	"conversation_id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text NOT NULL,
	"workspace" text NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"first_user_message_id" text,
	"auto_title_set" boolean DEFAULT false NOT NULL,
	"last_message_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_visibility_check" CHECK (visibility = ANY (ARRAY['private'::text, 'shared'::text]))
);
--> statement-breakpoint
CREATE TABLE "app"."domains" (
	"domain_id" text PRIMARY KEY DEFAULT gen_prefixed_id('dom_'::text) NOT NULL,
	"hostname" text NOT NULL,
	"port" integer NOT NULL,
	"org_id" text,
	"server_id" text,
	"is_test_env" boolean DEFAULT false,
	"test_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_hostname_key" UNIQUE("hostname")
);
--> statement-breakpoint
CREATE TABLE "iam"."email_invites" (
	"email_invite_id" text PRIMARY KEY DEFAULT gen_prefixed_id('emi_'::text) NOT NULL,
	"sender_id" text NOT NULL,
	"email" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_invites_sender_id_email_key" UNIQUE("sender_id","email")
);
--> statement-breakpoint
CREATE TABLE "app"."errors" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"location" text NOT NULL,
	"env" text NOT NULL,
	"severity" "app"."severity_level" DEFAULT 'error' NOT NULL,
	"clerk_id" text,
	"error" jsonb,
	"total_count" integer DEFAULT 1 NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "errors_env_check" CHECK (env = ANY (ARRAY['production'::text, 'development'::text]))
);
--> statement-breakpoint
CREATE TABLE "app"."feedback" (
	"feedback_id" text PRIMARY KEY DEFAULT gen_prefixed_id('fbk_'::text) NOT NULL,
	"user_id" text DEFAULT sub(),
	"content" text NOT NULL,
	"context" jsonb,
	"status" text DEFAULT 'new',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."gateway_settings" (
	"gateway_setting_id" text PRIMARY KEY DEFAULT gen_prefixed_id('gw_'::text) NOT NULL,
	"clerk_id" text NOT NULL,
	"gateway" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"enabled_models" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_settings_clerk_id_gateway_key" UNIQUE("clerk_id","gateway"),
	CONSTRAINT "gateway_settings_gateway_check" CHECK (gateway = ANY (ARRAY['openai-api'::text, 'openrouter-api'::text, 'groq-api'::text, 'anthropic-api'::text]))
);
--> statement-breakpoint
CREATE TABLE "app"."messages" (
	"message_id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"tab_id" text NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"content" jsonb NOT NULL,
	"status" text DEFAULT 'complete' NOT NULL,
	"error_code" text,
	"aborted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_tab_id_seq_key" UNIQUE("tab_id","seq"),
	CONSTRAINT "messages_status_check" CHECK (status = ANY (ARRAY['streaming'::text, 'complete'::text, 'interrupted'::text, 'error'::text])),
	CONSTRAINT "messages_type_check" CHECK (type = ANY (ARRAY['user'::text, 'assistant'::text, 'tool_use'::text, 'tool_result'::text, 'thinking'::text, 'system'::text, 'sdk_message'::text]))
);
--> statement-breakpoint
CREATE TABLE "iam"."org_invites" (
	"invite_id" text DEFAULT gen_prefixed_id('invite_'::text) NOT NULL,
	"org_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "iam"."org_role" DEFAULT 'member' NOT NULL,
	"invited_by" text,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_invites_invite_id_key" UNIQUE("invite_id"),
	CONSTRAINT "org_invites_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "iam"."org_memberships" (
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "org_memberships_pkey" PRIMARY KEY("org_id","user_id"),
	CONSTRAINT "org_memberships_role_check" CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text]))
);
--> statement-breakpoint
CREATE TABLE "iam"."orgs" (
	"org_id" text PRIMARY KEY DEFAULT gen_prefixed_id('org_'::text) NOT NULL,
	"name" text NOT NULL,
	"credits" numeric DEFAULT '200' NOT NULL,
	"is_test_env" boolean DEFAULT false,
	"test_run_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integrations"."providers" (
	"provider_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_key" text NOT NULL,
	"display_name" text NOT NULL,
	"logo_path" text,
	"default_scopes" jsonb DEFAULT '[]'::jsonb,
	"visibility_level" text DEFAULT 'admin_only' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "providers_provider_key_key" UNIQUE("provider_key")
);
--> statement-breakpoint
CREATE TABLE "iam"."referrals" (
	"referral_id" text PRIMARY KEY DEFAULT gen_prefixed_id('ref_'::text) NOT NULL,
	"referrer_id" text NOT NULL,
	"referred_id" text NOT NULL,
	"credits_awarded" numeric DEFAULT '500' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "referrals_referred_id_key" UNIQUE("referred_id"),
	CONSTRAINT "referrals_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text]))
);
--> statement-breakpoint
CREATE TABLE "lockbox"."secret_keys" (
	"secret_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"instance_id" text DEFAULT 'default' NOT NULL,
	"key_id" text NOT NULL,
	"name" text NOT NULL,
	"secret_hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"environment" text DEFAULT 'live' NOT NULL,
	"rate_limit_pm" integer,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "secret_keys_key_id_key" UNIQUE("key_id"),
	CONSTRAINT "secret_keys_env_len_check" CHECK (char_length(environment) > 0),
	CONSTRAINT "secret_keys_name_check" CHECK ((char_length(name) >= 1) AND (char_length(name) <= 128))
);
--> statement-breakpoint
CREATE TABLE "app"."servers" (
	"server_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"ip" text NOT NULL,
	"hostname" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iam"."sessions" (
	"session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"domain_id" text NOT NULL,
	"tab_id" text NOT NULL,
	"sdk_session_id" text NOT NULL,
	"last_activity" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_user_id_domain_id_tab_id_key" UNIQUE("user_id","domain_id","tab_id")
);
--> statement-breakpoint
CREATE TABLE "app"."templates" (
	"template_id" text PRIMARY KEY DEFAULT gen_prefixed_id('tmpl_'::text) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"ai_description" text,
	"source_path" text NOT NULL,
	"preview_url" text,
	"image_url" text,
	"is_active" boolean DEFAULT true,
	"deploy_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "app"."user_onboarding" (
	"user_id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"experience" text DEFAULT 'new' NOT NULL,
	"role" text,
	"industry" text,
	"primary_goal" text,
	"success_metric" text,
	"team_size" integer,
	"time_budget_min_per_week" integer,
	"autonomy" text DEFAULT 'review' NOT NULL,
	"approval_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"top_tasks" text[] DEFAULT '{}' NOT NULL,
	"preferred_apps" text[] DEFAULT '{}' NOT NULL,
	"data_sources" text[] DEFAULT '{}' NOT NULL,
	"notify_channels" text[] DEFAULT '{"inapp"}' NOT NULL,
	"timezone" text DEFAULT 'UTC',
	"locale" text DEFAULT 'en-US',
	"ip_address" text,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"tos_accepted_at" timestamp with time zone,
	"privacy_accepted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_onboarding_autonomy_check" CHECK (autonomy = ANY (ARRAY['manual'::text, 'review'::text, 'auto'::text])),
	CONSTRAINT "user_onboarding_experience_check" CHECK (experience = ANY (ARRAY['new'::text, 'intermediate'::text, 'power'::text])),
	CONSTRAINT "user_onboarding_status_check" CHECK (status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text, 'skipped'::text])),
	CONSTRAINT "user_onboarding_team_size_check" CHECK ((team_size IS NULL) OR (team_size >= 1)),
	CONSTRAINT "user_onboarding_time_budget_min_per_week_check" CHECK ((time_budget_min_per_week IS NULL) OR (time_budget_min_per_week >= 0))
);
--> statement-breakpoint
CREATE TABLE "iam"."user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"current_workspace" text,
	"selected_org_id" text,
	"recent_workspaces" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."user_profile" (
	"user_profile_id" text PRIMARY KEY DEFAULT gen_prefixed_id('usr_pr'::text) NOT NULL,
	"clerk_id" text NOT NULL,
	"about" text,
	"goals" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_clerk_id_key" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE "app"."user_quotas" (
	"user_id" text PRIMARY KEY NOT NULL,
	"max_sites" integer DEFAULT 2 NOT NULL,
	"max_storage_mb" integer DEFAULT 500,
	"max_monthly_builds" integer DEFAULT 100,
	"max_custom_domains" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lockbox"."user_secrets" (
	"user_secret_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"instance_id" text DEFAULT 'default' NOT NULL,
	"namespace" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"iv" "bytea" NOT NULL,
	"auth_tag" "bytea" NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_secrets_auth_tag_check" CHECK (octet_length(auth_tag) = 16),
	CONSTRAINT "user_secrets_iv_check" CHECK (octet_length(iv) = 12),
	CONSTRAINT "user_secrets_name_check" CHECK ((char_length(name) >= 1) AND (char_length(name) <= 128)),
	CONSTRAINT "user_secrets_version_check" CHECK (version > 0)
);
--> statement-breakpoint
CREATE TABLE "iam"."users" (
	"user_id" text PRIMARY KEY DEFAULT gen_prefixed_id('user_'::text) NOT NULL,
	"email" text,
	"display_name" text,
	"avatar_url" text,
	"password_hash" text,
	"clerk_id" text,
	"email_verified" boolean DEFAULT false,
	"invite_code" text,
	"status" "iam"."user_status" DEFAULT 'active' NOT NULL,
	"is_test_env" boolean DEFAULT false NOT NULL,
	"test_run_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_invite_code_key" UNIQUE("invite_code")
);
--> statement-breakpoint
ALTER TABLE "integrations"."access_policies" ADD CONSTRAINT "access_policies_provider_fk" FOREIGN KEY ("provider_id") REFERENCES "integrations"."providers"("provider_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."access_policies" ADD CONSTRAINT "access_policies_user_fk" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."automation_jobs" ADD CONSTRAINT "automation_jobs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "iam"."orgs"("org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."automation_jobs" ADD CONSTRAINT "automation_jobs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "app"."domains"("domain_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."automation_jobs" ADD CONSTRAINT "automation_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."automation_runs" ADD CONSTRAINT "automation_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "app"."automation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversation_tabs" ADD CONSTRAINT "conversation_tabs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("conversation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversations" ADD CONSTRAINT "conversations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "iam"."orgs"("org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."domains" ADD CONSTRAINT "domains_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "iam"."orgs"("org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."domains" ADD CONSTRAINT "domains_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "app"."servers"("server_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."email_invites" ADD CONSTRAINT "email_invites_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."gateway_settings" ADD CONSTRAINT "gateway_settings_clerk_id_fkey" FOREIGN KEY ("clerk_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "app"."conversation_tabs"("tab_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."org_invites" ADD CONSTRAINT "org_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "iam"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."org_invites" ADD CONSTRAINT "org_invites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "iam"."orgs"("org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."org_memberships" ADD CONSTRAINT "org_memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "iam"."orgs"("org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."org_memberships" ADD CONSTRAINT "org_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."referrals" ADD CONSTRAINT "referrals_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lockbox"."secret_keys" ADD CONSTRAINT "secret_keys_user_fk" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_onboarding" ADD CONSTRAINT "user_onboarding_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "iam"."orgs"("org_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."user_preferences" ADD CONSTRAINT "user_preferences_selected_org_id_fkey" FOREIGN KEY ("selected_org_id") REFERENCES "iam"."orgs"("org_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_quotas" ADD CONSTRAINT "user_quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lockbox"."user_secrets" ADD CONSTRAINT "user_secrets_user_fk" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_policies_lookup" ON "integrations"."access_policies" USING btree ("user_id","provider_id");--> statement-breakpoint
CREATE INDEX "idx_automation_jobs_is_active" ON "app"."automation_jobs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_automation_jobs_next_run" ON "app"."automation_jobs" USING btree ("next_run_at") WHERE ((is_active = true) AND (next_run_at IS NOT NULL));--> statement-breakpoint
CREATE INDEX "idx_automation_jobs_org_id" ON "app"."automation_jobs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_automation_jobs_site_id" ON "app"."automation_jobs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_automation_jobs_trigger_type" ON "app"."automation_jobs" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "idx_automation_jobs_user_id" ON "app"."automation_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_automation_runs_job_id" ON "app"."automation_runs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_automation_runs_started_at" ON "app"."automation_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_automation_runs_status" ON "app"."automation_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_conversation_tabs_conversation" ON "app"."conversation_tabs" USING btree ("conversation_id","position") WHERE (closed_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_conversations_org_shared" ON "app"."conversations" USING btree ("org_id","visibility","updated_at") WHERE ((deleted_at IS NULL) AND (visibility = 'shared'::text));--> statement-breakpoint
CREATE INDEX "idx_conversations_user_updated" ON "app"."conversations" USING btree ("user_id","updated_at") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_conversations_user_workspace" ON "app"."conversations" USING btree ("user_id","workspace","updated_at") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "domains_server_id_idx" ON "app"."domains" USING btree ("server_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_domains_hostname_ci" ON "app"."domains" USING btree (lower(hostname));--> statement-breakpoint
CREATE INDEX "idx_domains_is_test_env" ON "app"."domains" USING btree ("is_test_env");--> statement-breakpoint
CREATE INDEX "idx_domains_org" ON "app"."domains" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_domains_test_run_id" ON "app"."domains" USING btree ("test_run_id");--> statement-breakpoint
CREATE INDEX "idx_email_invites_sender_date" ON "iam"."email_invites" USING btree ("sender_id","sent_at");--> statement-breakpoint
CREATE INDEX "errors_env_last_seen_idx" ON "app"."errors" USING btree ("env","last_seen");--> statement-breakpoint
CREATE UNIQUE INDEX "errors_hash_uidx" ON "app"."errors" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "idx_gateway_settings_clerk" ON "app"."gateway_settings" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "idx_messages_tab_created" ON "app"."messages" USING btree ("tab_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_tab_seq" ON "app"."messages" USING btree ("tab_id","seq");--> statement-breakpoint
CREATE INDEX "idx_org_invites_email_ci" ON "iam"."org_invites" USING btree (lower(email));--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_invites_token" ON "iam"."org_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_org_memberships_org" ON "iam"."org_memberships" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_org_memberships_org_role" ON "iam"."org_memberships" USING btree ("org_id","role");--> statement-breakpoint
CREATE INDEX "idx_org_memberships_user" ON "iam"."org_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_orgs_is_test_env" ON "iam"."orgs" USING btree ("is_test_env");--> statement-breakpoint
CREATE INDEX "idx_orgs_name_ci" ON "iam"."orgs" USING btree (lower(name));--> statement-breakpoint
CREATE INDEX "idx_orgs_test_run_id" ON "iam"."orgs" USING btree ("test_run_id");--> statement-breakpoint
CREATE INDEX "idx_providers_visibility" ON "integrations"."providers" USING btree ("is_active","visibility_level");--> statement-breakpoint
CREATE INDEX "idx_referrals_referrer" ON "iam"."referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "idx_referrals_status" ON "iam"."referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_secret_keys_secret_hash" ON "lockbox"."secret_keys" USING btree ("secret_hash");--> statement-breakpoint
CREATE INDEX "secret_keys_user_idx" ON "lockbox"."secret_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "secret_keys_user_instance_idx" ON "lockbox"."secret_keys" USING btree ("user_id","instance_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_domain" ON "iam"."sessions" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "iam"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_sdk_session" ON "iam"."sessions" USING btree ("sdk_session_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "iam"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_preferences_org" ON "iam"."user_preferences" USING btree ("selected_org_id");--> statement-breakpoint
CREATE INDEX "idx_user_quotas_user_id" ON "app"."user_quotas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_secrets_expires_at" ON "lockbox"."user_secrets" USING btree ("expires_at") WHERE (expires_at IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "user_secrets_instance_version_idx" ON "lockbox"."user_secrets" USING btree ("user_id","instance_id","namespace","name","version");--> statement-breakpoint
CREATE UNIQUE INDEX "user_secrets_one_current_per_instance_idx" ON "lockbox"."user_secrets" USING btree ("user_id","instance_id","namespace","name") WHERE (is_current = true);--> statement-breakpoint
CREATE INDEX "idx_users_clerk_id" ON "iam"."users" USING btree ("clerk_id") WHERE (clerk_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email_ci" ON "iam"."users" USING btree (lower(email)) WHERE (email IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_users_invite_code" ON "iam"."users" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "idx_users_is_test_env" ON "iam"."users" USING btree ("is_test_env");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "iam"."users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_users_test_run_id" ON "iam"."users" USING btree ("test_run_id");