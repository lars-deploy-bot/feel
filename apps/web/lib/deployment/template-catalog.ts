import { existsSync } from "node:fs"
import type { AppDatabase } from "@webalive/database"
import { DEPLOYMENT_TEMPLATES, DOMAINS, getDeploymentTemplatePublicHostname, PATHS } from "@webalive/shared"
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

function getSharedTemplateForRow(row: Pick<TemplateRow, "template_id" | "source_path">) {
  const templateById = DEPLOYMENT_TEMPLATES.find(template => template.id === row.template_id)
  if (templateById) {
    return templateById
  }

  const pathSegments = row.source_path.split("/").filter(segment => segment.length > 0)
  const directoryName = pathSegments[pathSegments.length - 1]
  if (!directoryName) {
    return undefined
  }

  return DEPLOYMENT_TEMPLATES.find(template => template.internalHostname === directoryName)
}

function withLocalPreviewUrl(row: TemplateRow): TemplateRow {
  const sharedTemplate = getSharedTemplateForRow(row)
  if (!sharedTemplate) {
    return row
  }

  return {
    ...row,
    preview_url: `https://${getDeploymentTemplatePublicHostname(sharedTemplate, DOMAINS.WILDCARD)}`,
  }
}

function buildFilesystemTemplateCatalog(): TemplateRow[] {
  return DEPLOYMENT_TEMPLATES.flatMap(template => {
    const sourcePath = `${PATHS.TEMPLATES_ROOT}/${template.internalHostname}`
    if (!existsSync(sourcePath)) {
      return []
    }

    return [
      {
        template_id: template.id,
        name: template.name,
        description: template.description,
        ai_description: null,
        source_path: sourcePath,
        preview_url: `https://${getDeploymentTemplatePublicHostname(template, DOMAINS.WILDCARD)}`,
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
    return data.map(withLocalPreviewUrl)
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
    return withLocalPreviewUrl(data)
  }

  const fallbackTemplates = buildFilesystemTemplateCatalog()
  return fallbackTemplates.find(template => template.template_id === templateId) ?? null
}
