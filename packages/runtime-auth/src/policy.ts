import type { RuntimeRole, RuntimeScope } from "./scopes.js"

export interface RuntimeAuthorizationFacts {
  userId: string
  workspace: string
  hasWorkspaceAccess: boolean
  isAdmin: boolean
  isSuperadmin: boolean
  canWriteFiles: boolean
  canDeleteFiles: boolean
  canEnsureRunning: boolean
  canLeaseTerminal: boolean
}

export interface RuntimeAccessDecision {
  userId: string
  workspace: string
  role: RuntimeRole
  scopes: RuntimeScope[]
}

export class RuntimePermissionError extends Error {
  readonly code = "RUNTIME_PERMISSION_DENIED"

  constructor(message: string) {
    super(message)
    this.name = "RuntimePermissionError"
  }
}

function deriveRuntimeRole(facts: RuntimeAuthorizationFacts): RuntimeRole {
  if (facts.isSuperadmin) {
    return "superadmin"
  }
  if (facts.isAdmin) {
    return "admin"
  }
  return "user"
}

function createScopeSet(): Set<RuntimeScope> {
  return new Set<RuntimeScope>(["runtime:connect", "files:list", "files:read"])
}

export function authorizeRuntimeAccess(facts: RuntimeAuthorizationFacts): RuntimeAccessDecision {
  if (!facts.userId) {
    throw new Error("Runtime authorization requires a userId")
  }
  if (!facts.workspace) {
    throw new Error("Runtime authorization requires a workspace")
  }
  if (!facts.hasWorkspaceAccess) {
    throw new RuntimePermissionError(`User ${facts.userId} cannot access workspace ${facts.workspace}`)
  }

  const scopes = createScopeSet()
  if (facts.canWriteFiles) {
    scopes.add("files:write")
  }
  if (facts.canDeleteFiles) {
    scopes.add("files:delete")
  }
  if (facts.canEnsureRunning) {
    scopes.add("runtime:ensure-running")
  }
  if (facts.canLeaseTerminal) {
    scopes.add("terminal:lease")
  }

  return {
    userId: facts.userId,
    workspace: facts.workspace,
    role: deriveRuntimeRole(facts),
    scopes: Array.from(scopes),
  }
}

export function hasRuntimeScope(scopes: readonly RuntimeScope[], scope: RuntimeScope): boolean {
  return scopes.includes(scope)
}

export function requireRuntimeScope(scopes: readonly RuntimeScope[], scope: RuntimeScope): void {
  if (!hasRuntimeScope(scopes, scope)) {
    throw new RuntimePermissionError(`Missing runtime scope: ${scope}`)
  }
}
