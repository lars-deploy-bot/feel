import { exec } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { isManagerAuthenticated } from "@/features/auth/lib/auth"
import { loadDomainPasswords } from "@/types/guards/api"
import type { ViteConfigInfo } from "@/types/domain"

const execAsync = promisify(exec)

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Get Vite config information for a domain
 * GET /api/manager/vite-config?domain=example.com
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
		return NextResponse.json(
			{ error: "Domain parameter required" },
			{ status: 400 },
		)
	}

	try {
		const info = await getViteConfigInfo(domain)
		return NextResponse.json({ ok: true, info })
	} catch (error) {
		console.error("Failed to get vite config:", error)
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to get vite config",
			},
			{ status: 500 },
		)
	}
}

/**
 * Fix Vite config port mismatch
 * POST /api/manager/vite-config
 * Body: { domain: string, action: "fix-port" }
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
		return NextResponse.json(
			{ error: "Domain parameter required" },
			{ status: 400 },
		)
	}

	if (action !== "fix-port") {
		return NextResponse.json({ error: "Invalid action" }, { status: 400 })
	}

	try {
		await fixViteConfigPort(domain)
		const info = await getViteConfigInfo(domain)
		return NextResponse.json({ ok: true, message: "Port fixed", info })
	} catch (error) {
		console.error("Failed to fix vite config:", error)
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to fix vite config",
			},
			{ status: 500 },
		)
	}
}

async function getViteConfigInfo(domain: string): Promise<ViteConfigInfo> {
	const domains = loadDomainPasswords()
	const config = domains[domain]

	if (!config) {
		throw new Error("Domain not found in registry")
	}

	const expectedPort = config.port
	const sitePath = `/srv/webalive/sites/${domain}`
	const slug = domain.replace(/[^a-zA-Z0-9]/g, "-")

	// Check for systemd override file
	let hasSystemdOverride = false
	let systemdOverridePort: number | null = null
	const overridePath = `/etc/systemd/system/site@${slug}.service.d/port-override.conf`

	try {
		await execAsync(`test -f "${overridePath}"`)
		hasSystemdOverride = true

		// Try to parse port from override file
		const overrideContent = await readFile(overridePath, "utf-8")
		const portMatch = overrideContent.match(/--port\s+(\d+)/)
		if (portMatch) {
			systemdOverridePort = Number.parseInt(portMatch[1])
		}
	} catch {
		hasSystemdOverride = false
	}

	// Check for vite.config.ts (preferred)
	let configPath: string | null = null
	let configContent: string | null = null

	try {
		const tsPath = `${sitePath}/user/vite.config.ts`
		await execAsync(`test -f "${tsPath}"`)
		configPath = tsPath
		configContent = await readFile(tsPath, "utf-8")
	} catch {
		// Try .js
		try {
			const jsPath = `${sitePath}/user/vite.config.js`
			await execAsync(`test -f "${jsPath}"`)
			configPath = jsPath
			configContent = await readFile(jsPath, "utf-8")
		} catch {
			return {
				domain,
				expectedPort,
				actualPort: null,
				portMismatch: hasSystemdOverride,
				configPath: null,
				allowedHosts: null,
				hasSystemdOverride,
				systemdOverridePort,
				error: "Vite config not found",
			}
		}
	}

	// Parse port from config
	let actualPort: number | null = null
	const portMatch = configContent.match(/port:\s*(\d+)/)
	if (portMatch) {
		actualPort = Number.parseInt(portMatch[1])
	}

	// Parse allowedHosts from config
	let allowedHosts: string[] | null = null
	const allowedHostsMatch = configContent.match(
		/allowedHosts:\s*\[(.*?)\]/s,
	)
	if (allowedHostsMatch) {
		const hostsStr = allowedHostsMatch[1]
		allowedHosts = hostsStr
			.split(",")
			.map((h) => h.trim().replace(/['"]/g, ""))
			.filter((h) => h)
	}

	const portMismatch = (actualPort !== null && actualPort !== expectedPort) || hasSystemdOverride

	return {
		domain,
		expectedPort,
		actualPort,
		portMismatch,
		configPath,
		allowedHosts,
		hasSystemdOverride,
		systemdOverridePort,
	}
}

async function fixViteConfigPort(domain: string): Promise<void> {
	const info = await getViteConfigInfo(domain)
	const slug = domain.replace(/[^a-zA-Z0-9]/g, "-")
	const user = `site-${slug}`

	// Step 1: Remove systemd override file if it exists
	if (info.hasSystemdOverride) {
		const overridePath = `/etc/systemd/system/site@${slug}.service.d/port-override.conf`
		try {
			await execAsync(`rm -f "${overridePath}"`)
			await execAsync("systemctl daemon-reload")
		} catch (error) {
			throw new Error(
				`Failed to remove systemd override: ${error instanceof Error ? error.message : "Unknown error"}`,
			)
		}
	}

	// Step 2: Fix vite config port if needed
	if (info.configPath && info.actualPort && info.actualPort !== info.expectedPort) {
		// Replace port in config using sed
		// This replaces ALL occurrences of "port: <old>" with "port: <new>"
		try {
			await execAsync(
				`sudo -u ${user} sed -i 's/port: ${info.actualPort}/port: ${info.expectedPort}/g' "${info.configPath}"`,
			)
		} catch (error) {
			throw new Error(
				`Failed to update vite config: ${error instanceof Error ? error.message : "Unknown error"}`,
			)
		}
	}

	// Step 3: Restart the service to apply changes
	try {
		await execAsync(`systemctl restart site@${slug}.service`)
	} catch (error) {
		console.error("Failed to restart service:", error)
		// Don't throw - config was updated successfully
	}
}
