/**
 * Deploy Contract Test
 *
 * This test exists because the deploy pipeline has THREE consumers of the
 * same DB schema (API, deployer-rs, bash script) and they MUST agree.
 *
 * The contract file uses compile-time assertions for column existence
 * (TypeScript won't compile if a column is missing). This test validates
 * the runtime invariants: enum values, stage ordering, and Zod schema shapes.
 */

import { describe, expect, it } from "vitest"
import {
  ApplicationZ,
  BuildZ,
  CreateBuildBodyZ,
  CreateDeploymentBodyZ,
  DEPLOY_ARTIFACT_KINDS,
  DEPLOY_DEPLOYMENT_ACTIONS,
  DEPLOY_ENVIRONMENT_NAMES,
  DEPLOY_TASK_STATUSES,
  DEPLOYER_BUILD_STAGES,
  DEPLOYER_DEPLOYMENT_STAGES,
  DEPLOYER_WORKER_STATUSES,
  DeployerHealthZ,
  DeploymentZ,
  ReleaseZ,
} from "../deploy-contract"

describe("deploy contract", () => {
  describe("enums are non-empty and include critical values", () => {
    it("task_status", () => {
      expect(DEPLOY_TASK_STATUSES.length).toBeGreaterThanOrEqual(4)
      for (const s of ["pending", "running", "succeeded", "failed"]) {
        expect(DEPLOY_TASK_STATUSES).toContain(s)
      }
    })

    it("deployment_action", () => {
      for (const a of ["deploy", "promote", "rollback"]) {
        expect(DEPLOY_DEPLOYMENT_ACTIONS).toContain(a)
      }
    })

    it("environment_name", () => {
      expect(DEPLOY_ENVIRONMENT_NAMES).toContain("staging")
      expect(DEPLOY_ENVIRONMENT_NAMES).toContain("production")
    })

    it("artifact_kind includes docker_image", () => {
      expect(DEPLOY_ARTIFACT_KINDS).toContain("docker_image")
    })

    it("deployer worker statuses", () => {
      for (const s of ["starting", "idle", "building", "deploying", "error"]) {
        expect(DEPLOYER_WORKER_STATUSES).toContain(s)
      }
    })
  })

  describe("pipeline stages", () => {
    it("build: starts with resolve_commit, ends with record_release", () => {
      expect(DEPLOYER_BUILD_STAGES[0]).toBe("resolve_commit")
      expect(DEPLOYER_BUILD_STAGES.at(-1)).toBe("record_release")
    })

    it("deployment: starts with prepare_runtime, ends with public_health", () => {
      expect(DEPLOYER_DEPLOYMENT_STAGES[0]).toBe("prepare_runtime")
      expect(DEPLOYER_DEPLOYMENT_STAGES.at(-1)).toBe("public_health")
    })

    it("no duplicates across build and deployment stages", () => {
      const all = [...DEPLOYER_BUILD_STAGES, ...DEPLOYER_DEPLOYMENT_STAGES]
      expect(new Set(all).size).toBe(all.length)
    })
  })

  describe("Zod schemas parse valid data", () => {
    const now = new Date().toISOString()

    it("BuildZ", () => {
      const result = BuildZ.safeParse({
        build_id: "dep_build_1",
        application_id: "dep_app_1",
        status: "pending",
        git_ref: "main",
        git_sha: null,
        commit_message: null,
        artifact_kind: "docker_image",
        artifact_ref: null,
        artifact_digest: null,
        build_log_path: null,
        error_message: null,
        started_at: null,
        finished_at: null,
        created_at: now,
      })
      expect(result.success).toBe(true)
    })

    it("BuildZ rejects unknown status", () => {
      const result = BuildZ.safeParse({
        build_id: "x",
        application_id: "x",
        status: "bogus",
        git_ref: "x",
        git_sha: null,
        commit_message: null,
        artifact_kind: "docker_image",
        artifact_ref: null,
        artifact_digest: null,
        build_log_path: null,
        error_message: null,
        started_at: null,
        finished_at: null,
        created_at: now,
      })
      expect(result.success).toBe(false)
    })

    it("DeploymentZ", () => {
      const result = DeploymentZ.safeParse({
        deployment_id: "d1",
        environment_id: "e1",
        environment_name: "staging",
        environment_hostname: "staging.test",
        environment_port: 8998,
        release_id: "r1",
        action: "deploy",
        status: "succeeded",
        deployment_log_path: null,
        error_message: null,
        healthcheck_status: 200,
        started_at: now,
        finished_at: now,
        created_at: now,
      })
      expect(result.success).toBe(true)
    })

    it("ReleaseZ", () => {
      const result = ReleaseZ.safeParse({
        release_id: "r1",
        application_id: "a1",
        build_id: "b1",
        git_sha: "abc",
        commit_message: null,
        artifact_kind: "docker_image",
        artifact_ref: "img:latest",
        artifact_digest: "sha256:abc",
        created_at: now,
        staging_status: "succeeded",
        production_status: null,
      })
      expect(result.success).toBe(true)
    })

    it("ApplicationZ", () => {
      const result = ApplicationZ.safeParse({
        application_id: "a1",
        slug: "alive",
        display_name: "Alive",
        repo_owner: "test",
        repo_name: "repo",
        default_branch: "main",
        config_path: "alive.toml",
        environments: [],
        recent_builds: [],
        recent_releases: [],
        recent_deployments: [],
      })
      expect(result.success).toBe(true)
    })

    it("CreateBuildBodyZ rejects extra fields (strict)", () => {
      const result = CreateBuildBodyZ.safeParse({
        application_id: "a1",
        server_id: "s1",
        git_ref: "main",
        git_sha: "abc",
        commit_message: "test",
        extra: "nope",
      })
      expect(result.success).toBe(false)
    })

    it("CreateDeploymentBodyZ defaults action to deploy", () => {
      const result = CreateDeploymentBodyZ.safeParse({
        environment_id: "e1",
        release_id: "r1",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.action).toBe("deploy")
      }
    })

    it("DeployerHealthZ", () => {
      const result = DeployerHealthZ.safeParse({
        ok: true,
        worker: {
          status: "idle",
          last_poll_at: now,
          current_build_id: null,
          current_deployment_id: null,
          last_error: null,
        },
      })
      expect(result.success).toBe(true)
    })

    it("DeployerHealthZ rejects unknown worker status", () => {
      const result = DeployerHealthZ.safeParse({
        ok: true,
        worker: {
          status: "sleeping",
          last_poll_at: null,
          current_build_id: null,
          current_deployment_id: null,
          last_error: null,
        },
      })
      expect(result.success).toBe(false)
    })
  })
})
