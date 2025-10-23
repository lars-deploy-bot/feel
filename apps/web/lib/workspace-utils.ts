import { NextResponse } from 'next/server'
import { getWorkspace } from '@/app/features/claude/workspaceRetriever'
import { addCorsHeaders } from '@/lib/cors-utils'

export interface WorkspaceRequest {
	workspace?: string
	[key: string]: unknown
}

export interface ResolvedWorkspace {
	success: true
	workspace: string
}

export interface WorkspaceError {
	success: false
	response: NextResponse
}

export type WorkspaceResult = ResolvedWorkspace | WorkspaceError

export function resolveWorkspace(
	host: string,
	body: WorkspaceRequest,
	requestId: string,
	origin: string | null = null,
): WorkspaceResult {
	const workspaceResult = getWorkspace({ host, body, requestId })

	if (!workspaceResult.success) {
		const res = NextResponse.json(
			{
				ok: false,
				error: 'workspace_error',
				message: 'Failed to resolve workspace',
				requestId,
			},
			{ status: 400 },
		)
		if (origin) {
			addCorsHeaders(res, origin)
		}
		return { success: false, response: res }
	}

	return { success: true, workspace: workspaceResult.workspace }
}
