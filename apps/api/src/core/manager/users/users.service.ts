import { usersRepo } from "../../../db/repos"
import type { ManagerUser } from "./users.types"

export async function listUsers(): Promise<ManagerUser[]> {
  const users = await usersRepo.findAll()
  return users.map(u => ({
    user_id: u.user_id,
    email: u.email,
    display_name: u.display_name,
    status: u.status,
    created_at: u.created_at,
    updated_at: u.updated_at,
  }))
}

export async function getUserById(userId: string): Promise<ManagerUser> {
  const u = await usersRepo.findById(userId)
  return {
    user_id: u.user_id,
    email: u.email,
    display_name: u.display_name,
    status: u.status,
    created_at: u.created_at,
    updated_at: u.updated_at,
  }
}
