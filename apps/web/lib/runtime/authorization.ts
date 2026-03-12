import {
  authorizeRuntimeAccess,
  type RuntimeAccessDecision,
  type RuntimeScope,
  requireRuntimeScope,
} from "@webalive/runtime-auth"
import type { SessionUser } from "@/features/auth/lib/auth"

function buildRuntimeDecision(user: SessionUser, workspace: string): RuntimeAccessDecision {
  return authorizeRuntimeAccess({
    userId: user.id,
    workspace,
    hasWorkspaceAccess: true,
    isAdmin: user.isAdmin,
    isSuperadmin: user.isSuperadmin,
    canWriteFiles: true,
    canDeleteFiles: true,
    canEnsureRunning: true,
    canLeaseTerminal: true,
  })
}

export function getRuntimeAccessDecision(user: SessionUser, workspace: string): RuntimeAccessDecision {
  return buildRuntimeDecision(user, workspace)
}

export function requireWorkspaceRuntimeScope(user: SessionUser, workspace: string, scope: RuntimeScope): void {
  const decision = buildRuntimeDecision(user, workspace)
  requireRuntimeScope(decision.scopes, scope)
}
