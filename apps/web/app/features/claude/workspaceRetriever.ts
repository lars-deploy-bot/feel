import { existsSync } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

export interface WorkspaceRequest {
	host: string
	body: any
	requestId: string
}

export type WorkspaceResult =
	| {
			success: true
			workspace: string
	  }
	| {
			success: false
			response: NextResponse
	  }

/**
 * Determines the workspace directory based on hostname and request body
 *
 * For terminal.* hostnames:
 * - Expects 'workspace' parameter in request body
 * - Must start with 'webalive/sites/'
 * - Returns full path: /root/{workspace}
 *
 * For other hostnames:
 * - Uses WORKSPACE_BASE environment variable or default
 * - Returns: {WORKSPACE_BASE}/{host}/src
 */
export function getWorkspace({ host, body, requestId }: WorkspaceRequest): WorkspaceResult {
	console.log(`[Workspace ${requestId}] Resolving workspace for host: ${host}`)

	if (host.startsWith('terminal.')) {
		return getTerminalWorkspace(body, requestId)
	} else {
		return getHostnameWorkspace(host, requestId)
	}
}

function getTerminalWorkspace(body: any, requestId: string): WorkspaceResult {
	const customWorkspace = body?.workspace

	if (!customWorkspace || typeof customWorkspace !== 'string') {
		console.error(`[Workspace ${requestId}] Missing or invalid workspace parameter`)
		return {
			success: false,
			response: NextResponse.json(
				{
					ok: false,
					error: 'missing_workspace',
					message: 'Terminal hostname requires workspace parameter in request body (string)',
				},
				{ status: 400 },
			),
		}
	}

	// Validate workspace path
	if (!customWorkspace.startsWith('webalive/sites/')) {
		console.error(`[Workspace ${requestId}] Invalid workspace path: ${customWorkspace}`)
		return {
			success: false,
			response: NextResponse.json(
				{
					ok: false,
					error: 'invalid_workspace',
					message: 'Workspace must start with webalive/sites/',
				},
				{ status: 400 },
			),
		}
	}

	// Prevent path traversal attacks
	const normalizedWorkspace = path.normalize(customWorkspace)
	if (normalizedWorkspace !== customWorkspace || normalizedWorkspace.includes('..')) {
		console.error(`[Workspace ${requestId}] Potential path traversal in workspace: ${customWorkspace}`)
		return {
			success: false,
			response: NextResponse.json(
				{
					ok: false,
					error: 'invalid_workspace',
					message: 'Invalid workspace path detected',
				},
				{ status: 400 },
			),
		}
	}

	const fullPath = path.join('/root', normalizedWorkspace)

	// Check if workspace directory exists
	if (!existsSync(fullPath)) {
		console.error(`[Workspace ${requestId}] Workspace directory does not exist: ${fullPath}`)
		return {
			success: false,
			response: NextResponse.json(
				{
					ok: false,
					error: 'workspace_not_found',
					message: `Workspace directory not found: ${normalizedWorkspace}`,
				},
				{ status: 404 },
			),
		}
	}

	console.log(`[Workspace ${requestId}] Using custom workspace: ${fullPath}`)
	return {
		success: true,
		workspace: fullPath,
	}
}

function getHostnameWorkspace(host: string, requestId: string): WorkspaceResult {
	const base = process.env.WORKSPACE_BASE || '/claude-bridge/sites'
	const workspace = path.join(base, host, 'src')

	// Check if workspace directory exists
	if (!existsSync(workspace)) {
		console.error(`[Workspace ${requestId}] Hostname workspace does not exist: ${workspace}`)
		return {
			success: false,
			response: NextResponse.json(
				{
					ok: false,
					error: 'workspace_not_found',
					message: `Workspace not found for host: ${host}. Expected: ${workspace}`,
				},
				{ status: 404 },
			),
		}
	}

	console.log(`[Workspace ${requestId}] Using hostname workspace: ${workspace}`)
	return {
		success: true,
		workspace,
	}
}
