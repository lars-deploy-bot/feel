// Auto-generated deploy schema types
// Generated from Supabase database
// DO NOT EDIT MANUALLY - Run 'bun run gen:types' to regenerate
//
// Schema: deploy
// Project: qnvprftdorualkdyogka

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  deploy: {
    Tables: {
      applications: {
        Row: {
          application_id: string
          config_path: string
          created_at: string
          created_by_user_id: string | null
          default_branch: string
          display_name: string
          git_provider: Database["deploy"]["Enums"]["git_provider"]
          repo_name: string
          repo_owner: string
          slug: string
          updated_at: string
        }
        Insert: {
          application_id?: string
          config_path?: string
          created_at?: string
          created_by_user_id?: string | null
          default_branch?: string
          display_name: string
          git_provider?: Database["deploy"]["Enums"]["git_provider"]
          repo_name: string
          repo_owner: string
          slug: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          config_path?: string
          created_at?: string
          created_by_user_id?: string | null
          default_branch?: string
          display_name?: string
          git_provider?: Database["deploy"]["Enums"]["git_provider"]
          repo_name?: string
          repo_owner?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      builds: {
        Row: {
          alive_toml_snapshot: string | null
          application_id: string
          artifact_digest: string | null
          artifact_kind: Database["deploy"]["Enums"]["artifact_kind"]
          artifact_ref: string | null
          attempt_count: number
          build_id: string
          build_log_path: string | null
          builder_hostname: string | null
          commit_message: string | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          git_ref: string
          git_sha: string | null
          lease_expires_at: string | null
          lease_token: string | null
          metadata: Json
          requested_by_user_id: string | null
          started_at: string | null
          status: Database["deploy"]["Enums"]["task_status"]
          updated_at: string
        }
        Insert: {
          alive_toml_snapshot?: string | null
          application_id: string
          artifact_digest?: string | null
          artifact_kind?: Database["deploy"]["Enums"]["artifact_kind"]
          artifact_ref?: string | null
          attempt_count?: number
          build_id?: string
          build_log_path?: string | null
          builder_hostname?: string | null
          commit_message?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          git_ref: string
          git_sha?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          metadata?: Json
          requested_by_user_id?: string | null
          started_at?: string | null
          status?: Database["deploy"]["Enums"]["task_status"]
          updated_at?: string
        }
        Update: {
          alive_toml_snapshot?: string | null
          application_id?: string
          artifact_digest?: string | null
          artifact_kind?: Database["deploy"]["Enums"]["artifact_kind"]
          artifact_ref?: string | null
          attempt_count?: number
          build_id?: string
          build_log_path?: string | null
          builder_hostname?: string | null
          commit_message?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          git_ref?: string
          git_sha?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          metadata?: Json
          requested_by_user_id?: string | null
          started_at?: string | null
          status?: Database["deploy"]["Enums"]["task_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "builds_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
        ]
      }
      deployments: {
        Row: {
          action: Database["deploy"]["Enums"]["deployment_action"]
          attempt_count: number
          created_at: string
          deployment_id: string
          deployment_log_path: string | null
          environment_id: string
          error_message: string | null
          finished_at: string | null
          healthcheck_checked_at: string | null
          healthcheck_status: number | null
          lease_expires_at: string | null
          lease_token: string | null
          metadata: Json
          previous_deployment_id: string | null
          promoted_from_deployment_id: string | null
          release_id: string
          requested_by_user_id: string | null
          rollback_of_deployment_id: string | null
          started_at: string | null
          status: Database["deploy"]["Enums"]["task_status"]
          updated_at: string
        }
        Insert: {
          action?: Database["deploy"]["Enums"]["deployment_action"]
          attempt_count?: number
          created_at?: string
          deployment_id?: string
          deployment_log_path?: string | null
          environment_id: string
          error_message?: string | null
          finished_at?: string | null
          healthcheck_checked_at?: string | null
          healthcheck_status?: number | null
          lease_expires_at?: string | null
          lease_token?: string | null
          metadata?: Json
          previous_deployment_id?: string | null
          promoted_from_deployment_id?: string | null
          release_id: string
          requested_by_user_id?: string | null
          rollback_of_deployment_id?: string | null
          started_at?: string | null
          status?: Database["deploy"]["Enums"]["task_status"]
          updated_at?: string
        }
        Update: {
          action?: Database["deploy"]["Enums"]["deployment_action"]
          attempt_count?: number
          created_at?: string
          deployment_id?: string
          deployment_log_path?: string | null
          environment_id?: string
          error_message?: string | null
          finished_at?: string | null
          healthcheck_checked_at?: string | null
          healthcheck_status?: number | null
          lease_expires_at?: string | null
          lease_token?: string | null
          metadata?: Json
          previous_deployment_id?: string | null
          promoted_from_deployment_id?: string | null
          release_id?: string
          requested_by_user_id?: string | null
          rollback_of_deployment_id?: string | null
          started_at?: string | null
          status?: Database["deploy"]["Enums"]["task_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployments_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["environment_id"]
          },
          {
            foreignKeyName: "deployments_previous_deployment_id_fkey"
            columns: ["previous_deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "deployments_promoted_from_deployment_id_fkey"
            columns: ["promoted_from_deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "deployments_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["release_id"]
          },
          {
            foreignKeyName: "deployments_rollback_of_deployment_id_fkey"
            columns: ["rollback_of_deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["deployment_id"]
          },
        ]
      }
      environments: {
        Row: {
          allow_email: boolean
          application_id: string
          created_at: string
          domain_id: string | null
          environment_id: string
          executor: Database["deploy"]["Enums"]["executor_backend"]
          healthcheck_path: string
          hostname: string
          name: Database["deploy"]["Enums"]["environment_name"]
          port: number | null
          runtime_overrides: Json
          server_id: string
          updated_at: string
        }
        Insert: {
          allow_email?: boolean
          application_id: string
          created_at?: string
          domain_id?: string | null
          environment_id?: string
          executor?: Database["deploy"]["Enums"]["executor_backend"]
          healthcheck_path?: string
          hostname: string
          name: Database["deploy"]["Enums"]["environment_name"]
          port?: number | null
          runtime_overrides?: Json
          server_id: string
          updated_at?: string
        }
        Update: {
          allow_email?: boolean
          application_id?: string
          created_at?: string
          domain_id?: string | null
          environment_id?: string
          executor?: Database["deploy"]["Enums"]["executor_backend"]
          healthcheck_path?: string
          hostname?: string
          name?: Database["deploy"]["Enums"]["environment_name"]
          port?: number | null
          runtime_overrides?: Json
          server_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "environments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
        ]
      }
      releases: {
        Row: {
          alive_toml_snapshot: string
          application_id: string
          artifact_digest: string
          artifact_kind: Database["deploy"]["Enums"]["artifact_kind"]
          artifact_ref: string
          build_id: string
          commit_message: string | null
          created_at: string
          git_sha: string
          metadata: Json
          release_id: string
        }
        Insert: {
          alive_toml_snapshot: string
          application_id: string
          artifact_digest: string
          artifact_kind?: Database["deploy"]["Enums"]["artifact_kind"]
          artifact_ref: string
          build_id: string
          commit_message?: string | null
          created_at?: string
          git_sha: string
          metadata?: Json
          release_id?: string
        }
        Update: {
          alive_toml_snapshot?: string
          application_id?: string
          artifact_digest?: string
          artifact_kind?: Database["deploy"]["Enums"]["artifact_kind"]
          artifact_ref?: string
          build_id?: string
          commit_message?: string | null
          created_at?: string
          git_sha?: string
          metadata?: Json
          release_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "releases_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "releases_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: true
            referencedRelation: "builds"
            referencedColumns: ["build_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      artifact_kind: "docker_image"
      deployment_action: "deploy" | "promote" | "rollback"
      environment_name: "staging" | "production"
      executor_backend: "docker"
      git_provider: "github"
      task_status: "pending" | "running" | "succeeded" | "failed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals["deploy"]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  deploy: {
    Enums: {
      artifact_kind: ["docker_image"],
      deployment_action: ["deploy", "promote", "rollback"],
      environment_name: ["staging", "production"],
      executor_backend: ["docker"],
      git_provider: ["github"],
      task_status: ["pending", "running", "succeeded", "failed", "cancelled"],
    },
  },
} as const
