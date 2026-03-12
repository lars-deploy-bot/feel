import {
  type ConnectedSandboxRuntime,
  createConnectedSandboxRuntime,
  DEFAULT_SANDBOX_CONNECT_TIMEOUT_MS,
  type SandboxDomain,
} from "@webalive/sandbox"
import type { DomainRuntime } from "@/lib/domain/resolve-domain-runtime"
import { getE2bDomain } from "@/lib/env"
import { createAppClient } from "@/lib/supabase/app"

async function markSandboxDeadIfCurrent(domain: SandboxDomain): Promise<void> {
  if (!domain.sandbox_id) {
    return
  }

  const app = await createAppClient("service")
  const { error } = await app
    .from("domains")
    .update({ sandbox_status: "dead" })
    .eq("domain_id", domain.domain_id)
    .eq("sandbox_id", domain.sandbox_id)
    .eq("sandbox_status", "running")

  if (error) {
    throw new Error(`Failed to mark sandbox dead: ${error.message}`)
  }
}

let runtime: ConnectedSandboxRuntime | null = null

function toSandboxDomain(domain: DomainRuntime): SandboxDomain {
  return {
    ...domain,
    is_test_env: domain.is_test_env ?? undefined,
  }
}

export function getE2bFileRuntime(): ConnectedSandboxRuntime {
  if (runtime) {
    return runtime
  }

  runtime = createConnectedSandboxRuntime({
    e2bDomain: getE2bDomain(),
    connectTimeoutMs: DEFAULT_SANDBOX_CONNECT_TIMEOUT_MS,
    markDeadIfCurrent: markSandboxDeadIfCurrent,
  })

  return runtime
}

export async function getE2bFileEntryKind(
  domain: DomainRuntime,
  relativePath: string,
): Promise<"file" | "directory" | "unknown"> {
  return getE2bFileRuntime().getEntryKind(toSandboxDomain(domain), relativePath)
}

export async function readE2bTextFile(domain: DomainRuntime, relativePath: string): Promise<string> {
  return getE2bFileRuntime().readTextFile(toSandboxDomain(domain), relativePath)
}

export async function listE2bDirectory(domain: DomainRuntime, relativePath: string) {
  return getE2bFileRuntime().listDirectory(toSandboxDomain(domain), relativePath)
}

export async function writeE2bTextFile(domain: DomainRuntime, relativePath: string, content: string): Promise<void> {
  await getE2bFileRuntime().writeTextFile(toSandboxDomain(domain), relativePath, content)
}

export async function ensureE2bDirectory(domain: DomainRuntime, relativePath: string): Promise<void> {
  await getE2bFileRuntime().ensureDirectory(toSandboxDomain(domain), relativePath)
}

export async function writeE2bFile(
  domain: DomainRuntime,
  relativePath: string,
  content: string | ArrayBuffer,
): Promise<void> {
  await getE2bFileRuntime().writeFile(toSandboxDomain(domain), relativePath, content)
}

export async function deleteE2bPath(domain: DomainRuntime, relativePath: string) {
  return getE2bFileRuntime().deletePath(toSandboxDomain(domain), relativePath)
}
