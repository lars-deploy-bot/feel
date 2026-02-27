export interface AuthSession {
  sid: string
  userId: string
  userAgent: string | null
  ipAddress: string | null
  deviceLabel: string | null
  createdAt: Date
  lastActiveAt: Date
  expiresAt: Date
  revokedAt: Date | null
  revokedBy: string | null
}

export interface AuthSessionListItem {
  sid: string
  deviceLabel: string | null
  ipAddress: string | null
  createdAt: string
  lastActiveAt: string
  isCurrent: boolean
}

export interface RevokeResult {
  revoked: boolean
}
