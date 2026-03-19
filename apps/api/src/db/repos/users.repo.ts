import type { IamDatabase } from "@webalive/database"
import { InternalError, NotFoundError } from "../../infra/errors"
import { iam } from "../clients"

const USER_COLUMNS = "user_id, email, display_name, status, created_at, updated_at, metadata" as const

export type UserRow = Pick<
  IamDatabase["iam"]["Tables"]["users"]["Row"],
  "user_id" | "email" | "display_name" | "status" | "created_at" | "updated_at" | "metadata"
>

export async function findAll(): Promise<UserRow[]> {
  const { data, error } = await iam
    .from("users")
    .select(USER_COLUMNS)
    .eq("is_test_env", false)
    .order("created_at", { ascending: false })
    .overrideTypes<UserRow[], { merge: false }>()

  if (error) {
    throw new InternalError(`Failed to fetch users: ${error.message}`)
  }
  return data ?? []
}

export async function findById(userId: string): Promise<UserRow> {
  const { data, error } = await iam
    .from("users")
    .select(USER_COLUMNS)
    .eq("user_id", userId)
    .single()
    .overrideTypes<UserRow, { merge: false }>()

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
    .select(USER_COLUMNS)
    .eq("email", email)
    .maybeSingle()
    .overrideTypes<UserRow | null, { merge: false }>()

  if (error) {
    throw new InternalError(`Failed to find user by email: ${error.message}`)
  }
  return data
}

export async function updateMetadata(userId: string, metadata: UserRow["metadata"]): Promise<void> {
  const { error } = await iam.from("users").update({ metadata }).eq("user_id", userId)

  if (error) {
    throw new InternalError(`Failed to update user metadata: ${error.message}`)
  }
}
