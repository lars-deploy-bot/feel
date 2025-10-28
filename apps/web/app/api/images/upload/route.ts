import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { hasSessionCookie } from "@/types/guards/auth"
import { normalizeDomain } from "@/lib/domain-utils"
import { FilesystemStorage, uploadImage } from "@alive-brug/images"
import fs from "node:fs/promises"
import path from "node:path"

// Initialize storage
const storage = new FilesystemStorage({
  basePath: process.env.IMAGES_STORAGE_PATH || "/srv/webalive/storage",
  signatureSecret: process.env.IMAGES_SIGNATURE_SECRET
})

// Load domain-passwords.json to get tenant IDs
async function getTenantId(domain: string): Promise<string | null> {
  try {
    const configPath = path.join(process.cwd(), "../../domain-passwords.json")
    const configData = await fs.readFile(configPath, "utf-8")
    const config = JSON.parse(configData)

    const domainConfig = config[domain]
    if (!domainConfig || !domainConfig.tenantId) {
      return null
    }

    return domainConfig.tenantId
  } catch (error) {
    console.error("Error loading tenant ID:", error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const jar = await cookies()
    if (!hasSessionCookie(jar.get("session"))) {
      return NextResponse.json({ error: "no_session" }, { status: 401 })
    }

    // 2. Get tenant ID from domain
    const host = request.headers.get("host") || "localhost"
    const domain = normalizeDomain(host)
    const tenantId = await getTenantId(domain)

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_not_configured", message: "Domain not configured with tenant ID" },
        { status: 400 }
      )
    }

    // 3. Parse file from FormData
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "no_file", message: "No file provided" }, { status: 400 })
    }

    // 4. Convert to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 5. Get options
    const compress = formData.get("compress") !== "false"
    const variantsParam = formData.get("variants")
    const variants = variantsParam
      ? (variantsParam as string).split(",").map((v) => v.trim())
      : ["orig", "w640", "thumb"]

    // 6. Upload via storage adapter
    const result = await uploadImage(storage, tenantId, buffer, {
      visibility: "public",
      variants: variants as any,
      compress,
      maxWidth: 1920,
      targetSize: 150 * 1024
    })

    if (result.error) {
      return NextResponse.json(
        { error: result.error.code, message: result.error.message },
        { status: 500 }
      )
    }

    // 7. Return success
    return NextResponse.json({
      success: true,
      data: result.data
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      {
        error: "server_error",
        message: error instanceof Error ? error.message : "Internal server error"
      },
      { status: 500 }
    )
  }
}
