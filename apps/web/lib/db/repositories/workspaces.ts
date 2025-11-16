/**
 * Workspace repository - database operations for workspaces
 * Clean abstraction layer for workspace-related queries
 */

import { eq } from "drizzle-orm"
import { db } from "../client"
import type { NewWorkspace, Workspace } from "../schema"
import { workspaces } from "../schema"

export const workspaceRepository = {
  /**
   * Find workspace by domain
   */
  async findByDomain(domain: string): Promise<Workspace | null> {
    const result = await db.query.workspaces.findFirst({
      where: eq(workspaces.domain, domain),
    })
    return result || null
  },

  /**
   * Find workspace by ID
   */
  async findById(id: string): Promise<Workspace | null> {
    const result = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, id),
    })
    return result || null
  },

  /**
   * Create new workspace
   */
  async create(workspace: NewWorkspace): Promise<Workspace> {
    const [created] = await db.insert(workspaces).values(workspace).returning()
    if (!created) {
      throw new Error("Failed to create workspace")
    }
    return created
  },

  /**
   * Update workspace credits
   */
  async updateCredits(id: string, credits: number): Promise<void> {
    await db
      .update(workspaces)
      .set({
        credits,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, id))
  },

  /**
   * Decrement workspace credits
   */
  async decrementCredits(id: string, amount: number): Promise<void> {
    const workspace = await this.findById(id)
    if (!workspace) {
      throw new Error("Workspace not found")
    }

    const newCredits = Math.max(0, workspace.credits - amount)
    await this.updateCredits(id, newCredits)
  },

  /**
   * Delete workspace (cascades to user_workspaces and sessions)
   */
  async delete(id: string): Promise<void> {
    await db.delete(workspaces).where(eq(workspaces.id, id))
  },

  /**
   * Get all workspaces (admin only)
   */
  async findAll(): Promise<Workspace[]> {
    // Type assertion needed because db client uses runtime detection (Bun vs Node.js build)
    return db.query.workspaces.findMany({
      orderBy: (workspaces: typeof import("../schema").workspaces, { asc }: any) => [asc(workspaces.domain)],
    })
  },
}
