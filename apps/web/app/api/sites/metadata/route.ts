import { type NextRequest, NextResponse } from "next/server"
import { siteMetadataStore } from "@/lib/siteMetadataStore"
import { isValidSlug } from "@/features/deployment/lib/slug-utils"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const slug = url.searchParams.get("slug")

  if (!slug) {
    return NextResponse.json(
      {
        ok: false,
        error: "MISSING_SLUG",
        message: "Query parameter 'slug' is required",
      },
      { status: 400 },
    )
  }

  // Validate slug format
  if (!isValidSlug(slug)) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_SLUG",
        message: "Invalid slug format",
      },
      { status: 400 },
    )
  }

  try {
    const metadata = await siteMetadataStore.getSite(slug)

    if (!metadata) {
      return NextResponse.json(
        {
          ok: false,
          error: "SITE_NOT_FOUND",
          message: `Site with slug '${slug}' not found`,
        },
        { status: 404 },
      )
    }

    return NextResponse.json(
      {
        ok: true,
        metadata,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error(`[Metadata API] Failed to fetch metadata for slug ${slug}:`, error)

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Failed to fetch site metadata",
      },
      { status: 500 },
    )
  }
}
