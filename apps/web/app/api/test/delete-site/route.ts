import { execFile } from "node:child_process"
import { env } from "@webalive/env/server"
import { PATHS } from "@webalive/shared"
import { structuredErrorResponse } from "@/lib/api/responses"
import { extractSlugFromDomain } from "@/lib/config"
import { inspectSiteOccupancy } from "@/lib/deployment/site-occupancy"
import { ErrorCodes } from "@/lib/error-codes"
import { createAppClient } from "@/lib/supabase/app"
import { createIamClient } from "@/lib/supabase/iam"
import {
  CleanupDeployedSiteRequestSchema,
  CleanupDeployedSiteResponseSchema,
  isReusableLiveDeployDomain,
} from "@/lib/testing/e2e-site-deployment"

function runDeleteSiteScript(domain: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(`${PATHS.ALIVE_ROOT}/scripts/sites/delete-site.sh`, [domain, "--force"], error => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

export async function DELETE(req: Request) {
  const isTestEnv = env.NODE_ENV === "test" || env.ALIVE_ENV === "local"
  const testSecret = req.headers.get("x-test-secret")
  const expectedSecret = env.E2E_TEST_SECRET
  const hasValidSecret = expectedSecret && testSecret === expectedSecret

  if (!isTestEnv && !hasValidSecret) {
    return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 404 })
  }

  const parsed = CleanupDeployedSiteRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, {
      status: 400,
      details: { message: "Invalid request body for delete-site" },
    })
  }

  const { domain } = parsed.data
  const app = await createAppClient("service")
  const iam = await createIamClient("service")

  const { data: domainRow, error: domainError } = await app
    .from("domains")
    .select("org_id, is_test_env")
    .eq("hostname", domain)
    .maybeSingle()

  if (domainError) {
    console.error("[test/delete-site] Failed domain lookup:", domainError)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  if (!domainRow) {
    if (isReusableLiveDeployDomain(domain)) {
      const slug = extractSlugFromDomain(domain)
      if (slug) {
        const occupancy = inspectSiteOccupancy(slug)
        if (occupancy.occupied) {
          try {
            await runDeleteSiteScript(domain)
          } catch (error) {
            console.error("[test/delete-site] delete-site.sh failed during leaked reusable cleanup:", {
              domain,
              reason: occupancy.reason,
              error: error instanceof Error ? error.message : String(error),
            })
            return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, {
              status: 500,
              details: { message: "delete-site.sh failed" },
            })
          }

          return Response.json(CleanupDeployedSiteResponseSchema.parse({ ok: true, domain }))
        }
      }
    }

    return structuredErrorResponse(ErrorCodes.SITE_NOT_FOUND, {
      status: 404,
      details: { message: `Domain not found: ${domain}` },
    })
  }

  if (!domainRow.org_id) {
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, {
      status: 500,
      details: { message: `Domain ${domain} has no org_id` },
    })
  }

  const { data: orgRow, error: orgError } = await iam
    .from("orgs")
    .select("is_test_env, test_run_id")
    .eq("org_id", domainRow.org_id)
    .maybeSingle()

  if (orgError) {
    console.error("[test/delete-site] Failed org lookup:", orgError)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  const isTestDomain = domainRow.is_test_env || Boolean(orgRow?.is_test_env) || Boolean(orgRow?.test_run_id)
  if (!isTestDomain) {
    return structuredErrorResponse(ErrorCodes.FORBIDDEN, {
      status: 403,
      details: { message: `Refusing to delete non-test domain: ${domain}` },
    })
  }

  try {
    await runDeleteSiteScript(domain)
  } catch (error) {
    console.error("[test/delete-site] delete-site.sh failed:", {
      domain,
      error: error instanceof Error ? error.message : String(error),
    })
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, {
      status: 500,
      details: { message: "delete-site.sh failed" },
    })
  }

  return Response.json(CleanupDeployedSiteResponseSchema.parse({ ok: true, domain }))
}
