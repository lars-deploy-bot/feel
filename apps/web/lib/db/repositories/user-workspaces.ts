/**
 * User-Workspace repository - manage user access to workspaces
 * Clean abstraction layer for authorization queries
 */

import { and, eq } from "drizzle-orm"
import { db } from "../client"
import type { NewUserWorkspace, User, UserWorkspace, Workspace } from "../schema"
import { userWorkspaces, workspaces } from "../schema"

export const userWorkspaceRepository = {
  /**
   * Check if user has access to workspace
   */
  async hasAccess(userId: string, workspaceId: string): Promise<boolean> {
    const result = await db.query.userWorkspaces.findFirst({
      where: and(eq(userWorkspaces.userId, userId), eq(userWorkspaces.workspaceId, workspaceId)),
    })
    return !!result
  },

  /**
   * Check if user has access to workspace by domain
   */
  async hasAccessByDomain(userId: string, domain: string): Promise<boolean> {
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.domain, domain),
    })

    if (!workspace) return false

    return this.hasAccess(userId, workspace.id)
  },

  /**
   * Get all workspaces for a user
   */
  async getWorkspacesForUser(userId: string): Promise<
    Array<{
      workspace: Workspace
      role: "owner" | "member" | "viewer"
      linkedAt: Date
    }>
  > {
    const results = await db.query.userWorkspaces.findMany({
      where: eq(userWorkspaces.userId, userId),
      with: {
        workspace: true,
      },
    })

    // Type assertion needed because db client uses runtime detection (Bun vs Node.js build)
    // Actual runtime type: UserWorkspace & { workspace: Workspace }
    return results.map((result: UserWorkspace & { workspace: Workspace }) => ({
      workspace: result.workspace,
      role: result.role,
      linkedAt: result.createdAt,
    }))
  },

  /**
   * Get user's role for a workspace
   */
  async getRole(userId: string, workspaceId: string): Promise<"owner" | "member" | "viewer" | null> {
    const result = await db.query.userWorkspaces.findFirst({
      where: and(eq(userWorkspaces.userId, userId), eq(userWorkspaces.workspaceId, workspaceId)),
    })

    return result?.role || null
  },

  /**
   * Grant user access to workspace
   */
  async grantAccess(link: NewUserWorkspace): Promise<UserWorkspace> {
    const [created] = await db.insert(userWorkspaces).values(link).returning()
    if (!created) {
      throw new Error("Failed to grant workspace access")
    }
    return created
  },

  /**
   * Revoke user access to workspace
   */
  async revokeAccess(userId: string, workspaceId: string): Promise<void> {
    await db
      .delete(userWorkspaces)
      .where(and(eq(userWorkspaces.userId, userId), eq(userWorkspaces.workspaceId, workspaceId)))
  },

  /**
   * Update user's role for a workspace
   */
  async updateRole(userId: string, workspaceId: string, role: "owner" | "member" | "viewer"): Promise<void> {
    await db
      .update(userWorkspaces)
      .set({ role })
      .where(and(eq(userWorkspaces.userId, userId), eq(userWorkspaces.workspaceId, workspaceId)))
  },

  /**
   * Get all users for a workspace
   */
  async getUsersForWorkspace(workspaceId: string): Promise<
    Array<{
      userId: string
      email: string
      name: string | null
      role: "owner" | "member" | "viewer"
    }>
  > {
    const results = await db.query.userWorkspaces.findMany({
      where: eq(userWorkspaces.workspaceId, workspaceId),
      with: {
        user: true,
      },
    })

    // Type assertion needed because db client uses runtime detection (Bun vs Node.js build)
    // Actual runtime type: UserWorkspace & { user: User }
    return results.map((result: UserWorkspace & { user: User }) => ({
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.role,
    }))
  },
}
