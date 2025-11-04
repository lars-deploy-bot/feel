import { existsSync } from "node:fs"
import path from "node:path"
import { type NextRequest, NextResponse } from "next/server"
import { buildSubdomain, WORKSPACE_BASE } from "@/lib/config"
import { validateSlug } from "@/lib/slug-utils"

interface AvailabilityResponse {
  available: boolean
  slug?: string
  error?: string
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.toLowerCase()

  if (!slug) {
    return NextResponse.json({ available: false, error: "slug required" } as AvailabilityResponse, { status: 400 })
  }

  const validation = validateSlug(slug)
  if (!validation.valid) {
    return NextResponse.json({ available: false, error: validation.error } as AvailabilityResponse, { status: 200 })
  }

  // Check if domain directory exists
  const fullDomain = buildSubdomain(slug)
  const sitePath = path.join(WORKSPACE_BASE, fullDomain)
  const exists = existsSync(sitePath)

  console.log(`[Availability] Checking slug "${slug}" -> domain "${fullDomain}" -> path "${sitePath}" -> exists: ${exists}`)

  return NextResponse.json({ available: !exists, slug } as AvailabilityResponse, { status: 200 })
}
