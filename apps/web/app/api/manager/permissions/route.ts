import { exec } from "node:child_process"
import { promisify } from "node:util"
import { type NextRequest, NextResponse } from "next/server"
import { isManagerAuthenticated } from "@/features/auth/lib/auth"

const execAsync = promisify(exec)

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface PermissionCheckResult {
  domain: string
  expectedOwner: string
  siteDirectoryExists: boolean
  totalFiles: number
  rootOwnedFiles: number
  wrongOwnerFiles: number
  rootOwnedFilesList: string[]
  wrongOwnerFilesList: string[]
  error?: string
}

/**
 * Check file permissions for a domain
 * GET /api/manager/permissions?domain=example.com
 */
export async function GET(request: NextRequest) {
  // Check manager authentication
  const isAuth = await isManagerAuthenticated()
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const domain = searchParams.get("domain")

  if (!domain) {
    return NextResponse.json({ error: "Domain parameter required" }, { status: 400 })
  }

  try {
    const result = await checkDomainPermissions(domain)
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    console.error("Failed to check permissions:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to check permissions",
      },
      { status: 500 },
    )
  }
}

/**
 * Fix file permissions for a domain
 * POST /api/manager/permissions
 * Body: { domain: string, action: "fix" }
 */
export async function POST(request: NextRequest) {
  // Check manager authentication
  const isAuth = await isManagerAuthenticated()
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { domain, action } = body

  if (!domain) {
    return NextResponse.json({ error: "Domain parameter required" }, { status: 400 })
  }

  if (action !== "fix") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  try {
    await fixDomainPermissions(domain)
    const result = await checkDomainPermissions(domain)
    return NextResponse.json({ ok: true, message: "Permissions fixed", result })
  } catch (error) {
    console.error("Failed to fix permissions:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fix permissions",
      },
      { status: 500 },
    )
  }
}

async function checkDomainPermissions(domain: string): Promise<PermissionCheckResult> {
  const slug = domain.replace(/[^a-zA-Z0-9]/g, "-")
  const expectedOwner = `site-${slug}`
  const siteDir = `/srv/webalive/sites/${domain}`

  const result: PermissionCheckResult = {
    domain,
    expectedOwner,
    siteDirectoryExists: false,
    totalFiles: 0,
    rootOwnedFiles: 0,
    wrongOwnerFiles: 0,
    rootOwnedFilesList: [],
    wrongOwnerFilesList: [],
  }

  // Check if site directory exists
  try {
    await execAsync(`test -d "${siteDir}"`)
    result.siteDirectoryExists = true
  } catch {
    result.siteDirectoryExists = false
    result.error = "Site directory does not exist"
    return result
  }

  // Count total files
  try {
    const { stdout: totalOutput } = await execAsync(`find "${siteDir}" -type f | wc -l`)
    result.totalFiles = Number.parseInt(totalOutput.trim(), 10)
  } catch (error) {
    console.error("Failed to count total files:", error)
  }

  // Find root-owned files
  try {
    const { stdout: rootFiles } = await execAsync(`find "${siteDir}" -user root -type f 2>/dev/null || true`)
    const rootFilesList = rootFiles
      .trim()
      .split("\n")
      .filter(f => f)
    result.rootOwnedFiles = rootFilesList.length
    result.rootOwnedFilesList = rootFilesList.slice(0, 10) // Limit to first 10 for display
  } catch (error) {
    console.error("Failed to find root-owned files:", error)
  }

  // Find files owned by anyone other than expected owner
  try {
    const { stdout: wrongFiles } = await execAsync(
      `find "${siteDir}" ! -user "${expectedOwner}" -type f 2>/dev/null || true`,
    )
    const wrongFilesList = wrongFiles
      .trim()
      .split("\n")
      .filter(f => f)
    result.wrongOwnerFiles = wrongFilesList.length
    result.wrongOwnerFilesList = wrongFilesList.slice(0, 10) // Limit to first 10 for display
  } catch (error) {
    console.error("Failed to find wrong-owner files:", error)
  }

  return result
}

async function fixDomainPermissions(domain: string): Promise<void> {
  const slug = domain.replace(/[^a-zA-Z0-9]/g, "-")
  const expectedOwner = `site-${slug}`
  const siteDir = `/srv/webalive/sites/${domain}`

  // Check if site directory exists FIRST (before revealing user existence)
  try {
    await execAsync(`test -d "${siteDir}"`)
  } catch {
    throw new Error("Site directory does not exist")
  }

  // Check if user exists
  try {
    await execAsync(`id "${expectedOwner}" >/dev/null 2>&1`)
  } catch {
    throw new Error(`User ${expectedOwner} does not exist`)
  }

  // Fix ownership recursively
  try {
    await execAsync(`chown -R "${expectedOwner}:${expectedOwner}" "${siteDir}"`)
  } catch (error) {
    throw new Error(`Failed to fix permissions: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
