import { existsSync } from "node:fs"
import type { AppDatabase } from "@webalive/database"
import { DEPLOYMENT_TEMPLATES, PATHS } from "@webalive/shared"
import { createAppClient } from "@/lib/supabase/app"

type TemplateRow = Pick<
  AppDatabase["app"]["Tables"]["templates"]["Row"],
  | "template_id"
  | "name"
  | "description"
  | "ai_description"
  | "source_path"
  | "preview_url"
  | "image_url"
  | "is_active"
  | "deploy_count"
>

function buildFilesystemTemplateCatalog(): TemplateRow[] {
  return DEPLOYMENT_TEMPLATES.flatMap(({ id, hostname, name, description }) => {
    const sourcePath = `${PATHS.TEMPLATES_ROOT}/${hostname}`
    if (!existsSync(sourcePath)) {
      return []
    }

    return [
      {
        template_id: id,
        name,
        description,
        ai_description: null,
        source_path: sourcePath,
        preview_url: `https://${hostname}`,
        image_url: null,
        is_active: true,
        deploy_count: 0,
      },
    ]
  })
}

export async function listDeploymentTemplates(): Promise<TemplateRow[]> {
  const supabase = await createAppClient("service")

  const { data, error } = await supabase
    .from("templates")
    .select(
      "template_id, name, description, ai_description, source_path, preview_url, image_url, is_active, deploy_count",
    )
    .eq("is_active", true)
    .order("deploy_count", { ascending: false, nullsFirst: false })

  if (error) {
    throw new Error(`[deployment templates] app.templates query failed: ${error.message} (code: ${error.code})`)
  }

  if (data && data.length > 0) {
    return data
  }

  return buildFilesystemTemplateCatalog()
}

export async function findDeploymentTemplateById(templateId: string): Promise<TemplateRow | null> {
  const supabase = await createAppClient("service")

  const { data, error } = await supabase
    .from("templates")
    .select(
      "template_id, name, description, ai_description, source_path, preview_url, image_url, is_active, deploy_count",
    )
    .eq("template_id", templateId)
    .maybeSingle()

  if (error) {
    throw new Error(`[deployment template] app.templates lookup failed: ${error.message} (code: ${error.code})`)
  }

  if (data) {
    return data
  }

  const fallbackTemplates = buildFilesystemTemplateCatalog()
  return fallbackTemplates.find(template => template.template_id === templateId) ?? null
}
