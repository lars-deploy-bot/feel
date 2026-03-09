/**
 * Template validation using Supabase
 * Replaces the hardcoded TEMPLATES config with database-backed validation
 *
 * Supports per-server path overrides via server-config.json "templates" section.
 * This allows the same shared DB to work across servers with different file layouts.
 */

import { existsSync } from "node:fs"
import { resolveTemplatePath } from "@webalive/shared"
import { findDeploymentTemplateById } from "@/lib/deployment/template-catalog"

export interface ValidatedTemplate {
  template_id: string
  name: string
  source_path: string
  is_active: boolean
}

export interface TemplateValidationResult {
  valid: boolean
  template?: ValidatedTemplate
  error?: {
    code: "INVALID_TEMPLATE" | "TEMPLATE_NOT_FOUND" | "TEMPLATE_INACTIVE"
    templateId?: string
    message: string
  }
}

/**
 * Validate a template ID against Supabase and check if source path exists
 */
export async function validateTemplateFromDb(templateId: string | undefined): Promise<TemplateValidationResult> {
  if (!templateId) {
    return {
      valid: false,
      error: {
        code: "INVALID_TEMPLATE",
        message: "Template ID is required",
      },
    }
  }

  const template = await findDeploymentTemplateById(templateId)

  if (!template) {
    return {
      valid: false,
      error: {
        code: "INVALID_TEMPLATE",
        templateId,
        message: `Template "${templateId}" not found`,
      },
    }
  }

  if (!template.is_active) {
    return {
      valid: false,
      error: {
        code: "TEMPLATE_INACTIVE",
        templateId,
        message: `Template "${templateId}" is not active`,
      },
    }
  }

  // Resolve path using TEMPLATES_ROOT + directory name from DB source_path
  const sourcePath = resolveTemplatePath(template.source_path)

  if (!existsSync(sourcePath)) {
    return {
      valid: false,
      error: {
        code: "TEMPLATE_NOT_FOUND",
        templateId,
        message: `Template source path does not exist: ${sourcePath}. Sync template files to this server (git pull in templates dir).`,
      },
    }
  }

  return {
    valid: true,
    template: {
      template_id: template.template_id,
      name: template.name,
      source_path: sourcePath,
      is_active: template.is_active,
    },
  }
}
