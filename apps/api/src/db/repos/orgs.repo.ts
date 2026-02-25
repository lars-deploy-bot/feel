import { InternalError, NotFoundError } from "../../infra/errors"
import { app, iam } from "../clients"

export type OrgRow = {
  org_id: string
  name: string
  credits: number
  created_at: string | null
  updated_at: string | null
  is_test_env: boolean | null
}

export async function findAll(): Promise<OrgRow[]> {
  const { data, error } = await iam
    .from("orgs")
    .select("org_id, name, credits, created_at, updated_at, is_test_env")
    .eq("is_test_env", false)
    .order("created_at", { ascending: false })

  if (error) {
    throw new InternalError(`Failed to fetch orgs: ${error.message}`)
  }
  return data ?? []
}

export async function findById(orgId: string): Promise<OrgRow> {
  const { data, error } = await iam
    .from("orgs")
    .select("org_id, name, credits, created_at, updated_at, is_test_env")
    .eq("org_id", orgId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      throw new NotFoundError(`Org ${orgId} not found`)
    }
    throw new InternalError(`Failed to fetch org: ${error.message}`)
  }
  return data
}

export async function create(name: string, credits: number): Promise<OrgRow> {
  const { data, error } = await iam
    .from("orgs")
    .insert({ name, credits })
    .select("org_id, name, credits, created_at, updated_at, is_test_env")
    .single()

  if (error) {
    throw new InternalError(`Failed to create org: ${error.message}`)
  }
  return data
}

export async function updateCredits(orgId: string, credits: number): Promise<OrgRow> {
  const { data, error } = await iam
    .from("orgs")
    .update({ credits })
    .eq("org_id", orgId)
    .select("org_id, name, credits, created_at, updated_at, is_test_env")
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      throw new NotFoundError(`Org ${orgId} not found`)
    }
    throw new InternalError(`Failed to update org credits: ${error.message}`)
  }
  return data
}

export async function deleteOrg(orgId: string): Promise<void> {
  // 1. Nullify org_id on domains in app schema
  const { error: domainsError } = await app.from("domains").update({ org_id: null }).eq("org_id", orgId)

  if (domainsError) {
    throw new InternalError(`Failed to nullify domain org references: ${domainsError.message}`)
  }

  // 2. Delete org invites (FK constraint)
  const { error: invitesError } = await iam.from("org_invites").delete().eq("org_id", orgId)

  if (invitesError) {
    throw new InternalError(`Failed to delete org invites: ${invitesError.message}`)
  }

  // 3. Delete org memberships (FK constraint)
  const { error: membershipsError } = await iam.from("org_memberships").delete().eq("org_id", orgId)

  if (membershipsError) {
    throw new InternalError(`Failed to delete org memberships: ${membershipsError.message}`)
  }

  // 4. Delete the org itself
  const { error: orgError } = await iam.from("orgs").delete().eq("org_id", orgId)

  if (orgError) {
    throw new InternalError(`Failed to delete org: ${orgError.message}`)
  }
}
