import { type NextRequest, NextResponse } from "next/server"
import { siteMetadataStore } from "@/lib/siteMetadataStore"
import { validateSlug } from "@/lib/slug-utils"

interface AvailabilityResponse {
  available: boolean
  slug?: string
  error?: string
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")

  if (!slug) {
    return NextResponse.json({ available: false, error: "slug required" } as AvailabilityResponse, { status: 400 })
  }

  const validation = validateSlug(slug)
  if (!validation.valid) {
    return NextResponse.json({ available: false, error: validation.error } as AvailabilityResponse, { status: 200 })
  }

  const exists = await siteMetadataStore.exists(slug)

  return NextResponse.json({ available: !exists, slug } as AvailabilityResponse, { status: 200 })
}
