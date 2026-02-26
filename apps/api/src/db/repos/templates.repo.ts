import { InternalError } from "../../infra/errors"
import { app } from "../clients"

export type TemplateRow = {
  template_id: string
  name: string
  description: string | null
  ai_description: string | null
  source_path: string
  preview_url: string | null
  image_url: string | null
  is_active: boolean | null
  deploy_count: number | null
}

export async function findAll(): Promise<TemplateRow[]> {
  const { data, error } = await app
    .from("templates")
    .select(
      "template_id, name, description, ai_description, source_path, preview_url, image_url, is_active, deploy_count",
    )
    .order("name", { ascending: true })

  if (error) {
    throw new InternalError(`Failed to fetch templates: ${error.message}`)
  }
  return data ?? []
}

export async function findActive(): Promise<TemplateRow[]> {
  const { data, error } = await app
    .from("templates")
    .select(
      "template_id, name, description, ai_description, source_path, preview_url, image_url, is_active, deploy_count",
    )
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    throw new InternalError(`Failed to fetch active templates: ${error.message}`)
  }
  return data ?? []
}
