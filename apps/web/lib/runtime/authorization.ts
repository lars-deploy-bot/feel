import {
  authorizeRuntimeAccess,
  type RuntimeAccessDecision,
  type RuntimeScope,
  requireRuntimeScope,
} from "@webalive/runtime-auth"
import type { SessionUser } from "@/features/auth/lib/auth"

function buildRuntimeDecision(
  user: SessionUser,
  workspace: string,
  hasWorkspaceAccess: boolean,
): RuntimeAccessDecision {
  return authorizeRuntimeAccess({
    userId: user.id,
    workspace,
    hasWorkspaceAccess,
    isAdmin: user.isAdmin,
    isSuperadmin: user.isSuperadmin,
    canWriteFiles: true,
    canDeleteFiles: true,
    canEnsureRunning: true,
    canLeaseTerminal: true,
  })
}

export function getRuntimeAccessDecision(
  user: SessionUser,
  workspace: string,
  hasWorkspaceAccess: boolean,
): RuntimeAccessDecision {
  return buildRuntimeDecision(user, workspace, hasWorkspaceAccess)
}

export function requireWorkspaceRuntimeScope(
  user: SessionUser,
  workspace: string,
  hasWorkspaceAccess: boolean,
  scope: RuntimeScope,
): void {
  const decision = buildRuntimeDecision(user, workspace, hasWorkspaceAccess)
  requireRuntimeScope(decision.scopes, scope)
}
