import { iam } from "../clients"
import { InternalError, NotFoundError } from "../../infra/errors"

export type UserRow = {
  user_id: string
  email: string | null
  display_name: string | null
  status: string
  created_at: string
  updated_at: string
}

export async function findAll(): Promise<UserRow[]> {
  const { data, error } = await iam
    .from("users")
    .select("user_id, email, display_name, status, created_at, updated_at")
    .eq("is_test_env", false)
    .order("created_at", { ascending: false })

  if (error) {
    throw new InternalError(`Failed to fetch users: ${error.message}`)
  }
  return data ?? []
}

export async function findById(userId: string): Promise<UserRow> {
  const { data, error } = await iam
    .from("users")
    .select("user_id, email, display_name, status, created_at, updated_at")
    .eq("user_id", userId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      throw new NotFoundError(`User ${userId} not found`)
    }
    throw new InternalError(`Failed to fetch user: ${error.message}`)
  }
  return data
}

export async function findByEmail(email: string): Promise<UserRow | null> {
  const { data, error } = await iam
    .from("users")
    .select("user_id, email, display_name, status, created_at, updated_at")
    .eq("email", email)
    .maybeSingle()

  if (error) {
    throw new InternalError(`Failed to find user by email: ${error.message}`)
  }
  return data
}
