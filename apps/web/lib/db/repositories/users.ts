/**
 * User repository - database operations for users
 * Clean abstraction layer for user-related queries
 */

import { eq } from "drizzle-orm"
import { db } from "../client"
import type { NewUser, User } from "../schema"
import { users } from "../schema"

export const userRepository = {
  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await db.query.users.findFirst({
      where: eq(users.email, email),
    })
    return result || null
  },

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const result = await db.query.users.findFirst({
      where: eq(users.id, id),
    })
    return result || null
  },

  /**
   * Create new user
   */
  async create(user: NewUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning()
    if (!created) {
      throw new Error("Failed to create user")
    }
    return created
  },

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
  },

  /**
   * Update user password
   */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
  },

  /**
   * Update user profile
   */
  async updateProfile(id: string, data: { name?: string; email?: string }): Promise<void> {
    await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
  },

  /**
   * Delete user (cascades to user_workspaces and sessions)
   */
  async delete(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id))
  },

  /**
   * Get all users (admin only)
   */
  async findAll(): Promise<User[]> {
    // Type assertion needed because db client uses runtime detection (Bun vs Node.js build)
    return db.query.users.findMany({
      orderBy: (users: typeof import("../schema").users, { desc }: any) => [desc(users.createdAt)],
    })
  },
}
