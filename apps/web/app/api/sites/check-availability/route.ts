import { type NextRequest, NextResponse } from "next/server"
import { siteMetadataStore } from "@/lib/siteMetadataStore"
import { validateSlug } from "@/lib/slug-utils"

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")

  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 })
  }

  // Validate slug format
  const validation = validateSlug(slug)
  if (!validation.valid) {
    return NextResponse.json({ available: false, error: validation.error }, { status: 200 })
  }

  // Check if slug exists
  const exists = await siteMetadataStore.exists(slug)

  return NextResponse.json({
    available: !exists,
    slug,
  })
}
