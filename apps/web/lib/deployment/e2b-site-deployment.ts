import type { SandboxStatus } from "@webalive/database"
import { SANDBOX_WORKSPACE_ROOT, SandboxManager } from "@webalive/sandbox"
import { assignPort } from "@webalive/site-controller"
import type { Sandbox } from "e2b"
import type { ResolvedDomain } from "@/lib/domain/resolve-domain-runtime"
import { getE2bDomain } from "@/lib/env"
import { prepareE2bScratchWorkspace } from "@/lib/sandbox/e2b-workspace"
import { createAppClient } from "@/lib/supabase/app"

export interface E2bSiteDeploymentResult {
  port: number
  serviceName: string
  scratchWorkspace: string
}

async function updateSandboxState(domainId: string, sandboxId: string, status: SandboxStatus) {
  const app = await createAppClient("service")
  const { error } = await app
    .from("domains")
    .update({
      sandbox_id: sandboxId.length > 0 ? sandboxId : null,
      sandbox_status: status,
    })
    .eq("domain_id", domainId)

  if (error) {
    throw new Error(`Failed to persist sandbox state for ${domainId}: ${error.message}`)
  }
}

async function ensureSandboxGitRepo(sandbox: Sandbox, hostname: string): Promise<void> {
  const init = await sandbox.commands.run(
    [
      `cd ${SANDBOX_WORKSPACE_ROOT}`,
      "if [ ! -d .git ]; then git init --initial-branch=main >/dev/null 2>&1 || git init >/dev/null 2>&1; fi",
      "git add -A",
      `if ! git rev-parse --verify HEAD >/dev/null 2>&1; then git -c user.name=alive -c user.email=site@${hostname} commit --allow-empty --no-gpg-sign -m "Initial workspace snapshot" >/dev/null 2>&1; fi`,
    ].join(" && "),
    { timeoutMs: 20_000, cwd: SANDBOX_WORKSPACE_ROOT },
  )

  if (init.exitCode !== 0) {
    throw new Error(`Failed to initialize git repository in sandbox: ${init.stderr || init.stdout || "unknown error"}`)
  }
}

async function markSandboxDead(domainId: string, sandboxId: string): Promise<void> {
  try {
    // CAS guard: only update if the current sandbox_id still matches.
    // Prevents stale rollbacks from overwriting a newer sandbox.
    const app = await createAppClient("service")
    const { error } = await app
      .from("domains")
      .update({ sandbox_id: null, sandbox_status: "dead" })
      .eq("domain_id", domainId)
      .eq("sandbox_id", sandboxId)

    if (error) {
      console.error(`[E2B Site Deployment] Failed to mark sandbox dead for ${domainId}: ${error.message}`)
    }
  } catch (error) {
    console.error(
      `[E2B Site Deployment] Failed to mark sandbox dead for ${domainId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

export async function prepareE2bSiteDeployment(params: {
  domain: string
  templatePath: string
}): Promise<E2bSiteDeploymentResult> {
  const port = (await assignPort({ domain: params.domain })).port
  const scratchWorkspace = await prepareE2bScratchWorkspace(params.domain, params.templatePath)

  return {
    port,
    serviceName: `e2b-site@${params.domain}`,
    scratchWorkspace,
  }
}

export async function createInitialSiteSandbox(domain: ResolvedDomain, scratchWorkspace: string): Promise<void> {
  const manager = new SandboxManager({
    persistence: {
      updateSandbox: updateSandboxState,
    },
    domain: getE2bDomain(),
  })

  const sandbox = await manager.getOrCreate(
    {
      ...domain,
      is_test_env: domain.is_test_env ?? undefined,
    },
    scratchWorkspace,
  )
  try {
    await ensureSandboxGitRepo(sandbox, domain.hostname)
  } catch (error) {
    try {
      await sandbox.kill()
    } catch {
      // Ignore kill errors during rollback; best effort only.
    }
    await markSandboxDead(domain.domain_id, sandbox.sandboxId)
    throw error
  }
}
