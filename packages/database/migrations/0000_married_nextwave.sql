CREATE SCHEMA "app";
--> statement-breakpoint
CREATE SCHEMA "iam";
--> statement-breakpoint
CREATE SCHEMA "integrations";
--> statement-breakpoint
CREATE SCHEMA "lockbox";
--> statement-breakpoint
CREATE TYPE "public"."automation_action_type" AS ENUM('prompt', 'sync', 'publish');--> statement-breakpoint
CREATE TYPE "public"."automation_run_status" AS ENUM('pending', 'running', 'success', 'failure', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."automation_trigger_type" AS ENUM('cron', 'webhook', 'one-time');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."severity_level" AS ENUM('info', 'warn', 'error', 'debug', 'fatal');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled', 'invited');--> statement-breakpoint
CREATE TABLE "integrations"."access_policies" (
	"policy_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."automation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_type" "automation_trigger_type" NOT NULL,
	"action_type" "automation_action_type" NOT NULL,
	"cron_schedule" text,
	"cron_timezone" text,
	"run_at" timestamp with time zone,
	"action_prompt" text,
	"action_model" text,
	"action_format_prompt" text,
	"action_source" jsonb,
	"action_target_page" text,
	"action_timeout_seconds" integer,
	"skills" text[],
	"webhook_secret" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"running_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_run_status" "automation_run_status",
	"last_run_error" text,
	"last_run_duration_ms" integer,
	"consecutive_failures" integer DEFAULT 0,
	"delete_after_run" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"status" "automation_run_status" DEFAULT 'pending' NOT NULL,
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
	"tab_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"name" text DEFAULT 'Tab' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."conversations" (
	"conversation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text NOT NULL,
	"workspace" text NOT NULL,
	"title" text DEFAULT 'New Conversation' NOT NULL,
	"auto_title_set" boolean DEFAULT false NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"first_user_message_id" text,
	"last_message_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."domains" (
	"domain_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hostname" text NOT NULL,
	"port" integer NOT NULL,
	"org_id" uuid,
	"server_id" uuid,
	"is_test_env" boolean DEFAULT false,
	"test_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iam"."email_invites" (
	"email_invite_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"sender_id" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."errors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."errors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hash" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"location" text NOT NULL,
	"env" text NOT NULL,
	"severity" "severity_level" DEFAULT 'error' NOT NULL,
	"clerk_id" text,
	"error" jsonb,
	"total_count" integer DEFAULT 1 NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."feedback" (
	"feedback_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"content" text NOT NULL,
	"context" jsonb,
	"status" text DEFAULT 'new',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."gateway_settings" (
	"gateway_setting_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"gateway" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"enabled_models" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."messages" (
	"message_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tab_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"content" jsonb NOT NULL,
	"status" text DEFAULT 'complete' NOT NULL,
	"error_code" text,
	"aborted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iam"."org_invites" (
	"invite_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"invited_by" uuid,
	"accepted_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iam"."org_memberships" (
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "org_memberships_user_id_org_id_pk" PRIMARY KEY("user_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "iam"."orgs" (
	"org_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
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
	"default_scopes" jsonb,
	"visibility_level" text DEFAULT 'public' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "providers_provider_key_unique" UNIQUE("provider_key")
);
--> statement-breakpoint
CREATE TABLE "iam"."referrals" (
	"referral_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"credits_awarded" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lockbox"."secret_keys" (
	"secret_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"instance_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"key_id" text NOT NULL,
	"name" text NOT NULL,
	"secret_hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"environment" text DEFAULT 'production' NOT NULL,
	"rate_limit_pm" integer,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "secret_keys_key_id_unique" UNIQUE("key_id")
);
--> statement-breakpoint
CREATE TABLE "app"."servers" (
	"server_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"ip" text NOT NULL,
	"hostname" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iam"."sessions" (
	"session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain_id" text NOT NULL,
	"tab_id" text NOT NULL,
	"sdk_session_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."templates" (
	"template_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"status" text DEFAULT 'pending' NOT NULL,
	"experience" text DEFAULT 'beginner' NOT NULL,
	"role" text,
	"industry" text,
	"primary_goal" text,
	"success_metric" text,
	"team_size" integer,
	"time_budget_min_per_week" integer,
	"autonomy" text DEFAULT 'assisted' NOT NULL,
	"approval_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"top_tasks" text[] DEFAULT '{}' NOT NULL,
	"preferred_apps" text[] DEFAULT '{}' NOT NULL,
	"data_sources" text[] DEFAULT '{}' NOT NULL,
	"notify_channels" text[] DEFAULT '{}' NOT NULL,
	"timezone" text,
	"locale" text,
	"ip_address" text,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"tos_accepted_at" timestamp with time zone,
	"privacy_accepted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iam"."user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_workspace" text,
	"recent_workspaces" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selected_org_id" uuid,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."user_profile" (
	"user_profile_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"about" text,
	"goals" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."user_quotas" (
	"user_id" text PRIMARY KEY NOT NULL,
	"max_sites" integer DEFAULT 3 NOT NULL,
	"max_storage_mb" integer,
	"max_monthly_builds" integer,
	"max_custom_domains" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lockbox"."user_secrets" (
	"user_secret_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"instance_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"namespace" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."user_tokens" (
	"token_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" uuid NOT NULL,
	"scopes" jsonb,
	"expires_at" timestamp with time zone,
	"refresh_expires_at" timestamp with time zone,
	"is_valid" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"last_refreshed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iam"."users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"display_name" text,
	"avatar_url" text,
	"password_hash" text,
	"clerk_id" text,
	"email_verified" boolean DEFAULT false,
	"invite_code" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"is_test_env" boolean DEFAULT false NOT NULL,
	"test_run_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integrations"."access_policies" ADD CONSTRAINT "access_policies_provider_id_providers_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "integrations"."providers"("provider_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."automation_jobs" ADD CONSTRAINT "automation_jobs_site_id_domains_domain_id_fk" FOREIGN KEY ("site_id") REFERENCES "app"."domains"("domain_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."automation_runs" ADD CONSTRAINT "automation_runs_job_id_automation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "app"."automation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversation_tabs" ADD CONSTRAINT "conversation_tabs_conversation_id_conversations_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("conversation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."domains" ADD CONSTRAINT "domains_server_id_servers_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "app"."servers"("server_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."email_invites" ADD CONSTRAINT "email_invites_sender_id_users_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_tab_id_conversation_tabs_tab_id_fk" FOREIGN KEY ("tab_id") REFERENCES "app"."conversation_tabs"("tab_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."org_invites" ADD CONSTRAINT "org_invites_org_id_orgs_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "iam"."orgs"("org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."org_invites" ADD CONSTRAINT "org_invites_invited_by_users_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "iam"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."org_memberships" ADD CONSTRAINT "org_memberships_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."org_memberships" ADD CONSTRAINT "org_memberships_org_id_orgs_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "iam"."orgs"("org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."referrals" ADD CONSTRAINT "referrals_referrer_id_users_user_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."referrals" ADD CONSTRAINT "referrals_referred_id_users_user_id_fk" FOREIGN KEY ("referred_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."sessions" ADD CONSTRAINT "sessions_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."user_preferences" ADD CONSTRAINT "user_preferences_selected_org_id_orgs_org_id_fk" FOREIGN KEY ("selected_org_id") REFERENCES "iam"."orgs"("org_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."user_tokens" ADD CONSTRAINT "user_tokens_provider_id_providers_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "integrations"."providers"("provider_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_policies_provider_id_idx" ON "integrations"."access_policies" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "access_policies_user_id_idx" ON "integrations"."access_policies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "automation_jobs_site_id_idx" ON "app"."automation_jobs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "automation_jobs_user_id_idx" ON "app"."automation_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "automation_jobs_next_run_at_idx" ON "app"."automation_jobs" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "automation_jobs_is_active_idx" ON "app"."automation_jobs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "automation_runs_job_id_idx" ON "app"."automation_runs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "automation_runs_status_idx" ON "app"."automation_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "automation_runs_started_at_idx" ON "app"."automation_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "conversation_tabs_conversation_id_idx" ON "app"."conversation_tabs" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversation_tabs_position_idx" ON "app"."conversation_tabs" USING btree ("position");--> statement-breakpoint
CREATE INDEX "conversations_user_id_idx" ON "app"."conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_org_id_idx" ON "app"."conversations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "conversations_workspace_idx" ON "app"."conversations" USING btree ("workspace");--> statement-breakpoint
CREATE INDEX "conversations_created_at_idx" ON "app"."conversations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "domains_hostname_idx" ON "app"."domains" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX "domains_org_id_idx" ON "app"."domains" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "domains_test_run_id_idx" ON "app"."domains" USING btree ("test_run_id");--> statement-breakpoint
CREATE INDEX "email_invites_email_idx" ON "iam"."email_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "errors_hash_idx" ON "app"."errors" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "errors_severity_idx" ON "app"."errors" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "errors_env_idx" ON "app"."errors" USING btree ("env");--> statement-breakpoint
CREATE INDEX "errors_last_seen_idx" ON "app"."errors" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "gateway_settings_clerk_id_idx" ON "app"."gateway_settings" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "messages_tab_id_idx" ON "app"."messages" USING btree ("tab_id");--> statement-breakpoint
CREATE INDEX "messages_tab_seq_idx" ON "app"."messages" USING btree ("tab_id","seq");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "app"."messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "org_invites_email_idx" ON "iam"."org_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "org_invites_token_idx" ON "iam"."org_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "org_invites_org_id_idx" ON "iam"."org_invites" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_memberships_org_id_idx" ON "iam"."org_memberships" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "orgs_name_idx" ON "iam"."orgs" USING btree ("name");--> statement-breakpoint
CREATE INDEX "orgs_test_run_id_idx" ON "iam"."orgs" USING btree ("test_run_id");--> statement-breakpoint
CREATE INDEX "providers_provider_key_idx" ON "integrations"."providers" USING btree ("provider_key");--> statement-breakpoint
CREATE INDEX "providers_is_active_idx" ON "integrations"."providers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "referrals_referrer_id_idx" ON "iam"."referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "referrals_referred_id_idx" ON "iam"."referrals" USING btree ("referred_id");--> statement-breakpoint
CREATE INDEX "secret_keys_user_id_idx" ON "lockbox"."secret_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "secret_keys_key_id_idx" ON "lockbox"."secret_keys" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX "secret_keys_secret_hash_idx" ON "lockbox"."secret_keys" USING btree ("secret_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "iam"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_domain_tab_idx" ON "iam"."sessions" USING btree ("domain_id","tab_id");--> statement-breakpoint
CREATE INDEX "sessions_sdk_session_id_idx" ON "iam"."sessions" USING btree ("sdk_session_id");--> statement-breakpoint
CREATE INDEX "templates_name_idx" ON "app"."templates" USING btree ("name");--> statement-breakpoint
CREATE INDEX "user_secrets_user_id_idx" ON "lockbox"."user_secrets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_secrets_namespace_idx" ON "lockbox"."user_secrets" USING btree ("namespace");--> statement-breakpoint
CREATE INDEX "user_secrets_name_idx" ON "lockbox"."user_secrets" USING btree ("name");--> statement-breakpoint
CREATE INDEX "user_secrets_user_namespace_name_idx" ON "lockbox"."user_secrets" USING btree ("user_id","namespace","name");--> statement-breakpoint
CREATE INDEX "user_secrets_is_current_idx" ON "lockbox"."user_secrets" USING btree ("is_current");--> statement-breakpoint
CREATE INDEX "user_tokens_user_id_idx" ON "integrations"."user_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_tokens_provider_id_idx" ON "integrations"."user_tokens" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "user_tokens_user_provider_idx" ON "integrations"."user_tokens" USING btree ("user_id","provider_id");--> statement-breakpoint
CREATE INDEX "user_tokens_is_valid_idx" ON "integrations"."user_tokens" USING btree ("is_valid");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "iam"."users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_clerk_id_idx" ON "iam"."users" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "users_invite_code_idx" ON "iam"."users" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "users_test_run_id_idx" ON "iam"."users" USING btree ("test_run_id");