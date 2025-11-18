/**
 * Session repository - manage Claude SDK session persistence
 * Replaces in-memory session store with database-backed storage
 */

import { randomUUID } from "node:crypto"
import { and, eq, lt } from "drizzle-orm"
import { db, rawDb } from "../client"
import { sessions } from "../schema"

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export const sessionRepository = {
  /**
   * Get SDK session ID for a conversation
   */
  async get(userId: string, workspaceId: string, conversationId: string): Promise<string | null> {
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.userId, userId),
        eq(sessions.workspaceId, workspaceId),
        eq(sessions.conversationId, conversationId),
      ),
    })

    if (!session) return null

    // Check if session expired
    if (session.expiresAt < new Date()) {
      await this.delete(userId, workspaceId, conversationId)
      return null
    }

    // Update last activity
    await db.update(sessions).set({ lastActivity: new Date() }).where(eq(sessions.id, session.id))

    return session.sdkSessionId
  },

  /**
   * Save SDK session ID for a conversation
   * Upserts - updates if exists, inserts if not
   */
  async set(userId: string, workspaceId: string, conversationId: string, sdkSessionId: string): Promise<void> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

    // Try to find existing session
    const existing = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.userId, userId),
        eq(sessions.workspaceId, workspaceId),
        eq(sessions.conversationId, conversationId),
      ),
    })

    if (existing) {
      // Update existing
      await db
        .update(sessions)
        .set({
          sdkSessionId,
          lastActivity: now,
          expiresAt,
        })
        .where(eq(sessions.id, existing.id))
    } else {
      // Insert new
      await db.insert(sessions).values({
        id: randomUUID(),
        userId,
        workspaceId,
        conversationId,
        sdkSessionId,
        lastActivity: now,
        expiresAt,
      })
    }
  },

  /**
   * Delete a specific session
   */
  async delete(userId: string, workspaceId: string, conversationId: string): Promise<void> {
    await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.workspaceId, workspaceId),
          eq(sessions.conversationId, conversationId),
        ),
      )
  },

  /**
   * Delete all sessions for a user
   */
  async deleteAllForUser(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId))
  },

  /**
   * Delete all sessions for a workspace
   */
  async deleteAllForWorkspace(workspaceId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.workspaceId, workspaceId))
  },

  /**
   * Clean up expired sessions
   * Should be run periodically (e.g., daily cron job)
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date()
    const result = await db.delete(sessions).where(lt(sessions.expiresAt, now))

    return result.changes || 0
  },

  /**
   * Get session count (for monitoring)
   */
  async count(): Promise<number> {
    const result = rawDb.query("SELECT COUNT(*) as count FROM sessions").get() as {
      count: number
    }
    return result.count
  },

  /**
   * Get active session count (not expired)
   */
  async countActive(): Promise<number> {
    const now = Math.floor(Date.now() / 1000)
    const result = rawDb.query("SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?").get(now) as {
      count: number
    }
    return result.count
  },
}
