import { headers, cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import path from 'node:path'
import { z } from 'zod'
import { type Options, type PermissionResult } from '@anthropic-ai/claude-agent-sdk'
import { getWorkspace } from '../workspaceRetriever'
import { createClaudeStream, createSSEResponse } from '../streamHandler'

export const runtime = 'nodejs'

export async function POST(req: Request) {
	const requestId = Math.random().toString(36).substring(2, 8)
	console.log(`[Claude Stream ${requestId}] === STREAM REQUEST START ===`)

	try {
		const jar = await cookies()
		console.log(`[Claude Stream ${requestId}] Checking session cookie...`)

		if (!jar.get('session')) {
			console.log(`[Claude Stream ${requestId}] No session cookie found`)
			return NextResponse.json(
				{
					ok: false,
					error: 'no_session',
					message: 'Authentication required - no session cookie found',
				},
				{ status: 401 },
			)
		}
		console.log(`[Claude Stream ${requestId}] Session cookie verified`)

		console.log(`[Claude Stream ${requestId}] Parsing request body...`)
		let body
		try {
			body = await req.json()
			console.log(`[Claude Stream ${requestId}] Raw body keys:`, Object.keys(body))
		} catch (jsonError) {
			console.error(`[Claude Stream ${requestId}] Failed to parse JSON body:`, jsonError)
			return NextResponse.json(
				{
					ok: false,
					error: 'invalid_json',
					message: 'Request body is not valid JSON',
					details: jsonError instanceof Error ? jsonError.message : 'Unknown JSON parse error',
				},
				{ status: 400 },
			)
		}

		const host = (await headers()).get('host') || 'localhost'
		console.log(`[Claude Stream ${requestId}] Host: ${host}`)

		// Get workspace using dedicated handler
		const workspaceResult = getWorkspace({ host, body, requestId })
		if (!workspaceResult.success) {
			return workspaceResult.response
		}
		const cwd = workspaceResult.workspace

		console.log(`[Claude Stream ${requestId}] Working directory: ${cwd}`)
		console.log(`[Claude Stream ${requestId}] Claude model: ${process.env.CLAUDE_MODEL || 'not set'}`)

		// Validate message field
		const QuerySchema = z.object({
			message: z.string().min(1),
		})

		const parseResult = QuerySchema.safeParse(body)
		if (!parseResult.success) {
			console.error(`[Claude Stream ${requestId}] Schema validation failed:`, parseResult.error.errors)
			return NextResponse.json(
				{
					ok: false,
					error: 'invalid_message',
					message: 'Message field is required and must be a non-empty string',
					details: parseResult.error.errors,
				},
				{ status: 400 },
			)
		}

		const { message } = parseResult.data
		console.log(
			`[Claude Stream ${requestId}] Message received (${message.length} chars): ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
		)

		const canUseTool: Options['canUseTool'] = async (toolName, input) => {
			console.log(`[Claude Stream ${requestId}] Tool requested: ${toolName}`)
			console.log(`[Claude Stream ${requestId}] Tool input:`, JSON.stringify(input, null, 2))

			const ALLOWED = new Set(['Write', 'Edit', 'Read', 'Glob', 'Grep'])
			if (!ALLOWED.has(toolName)) {
				console.log(`[Claude Stream ${requestId}] Tool denied: ${toolName}`)
				return { behavior: 'deny', message: `tool_not_allowed: ${toolName}` }
			}

			const filePath = (input as any).file_path || (input as any).notebook_path || (input as any).path || null

			if (filePath) {
				const norm = path.normalize(filePath)
				console.log(`[Claude Stream ${requestId}] File path requested: ${norm}`)
				if (!norm.startsWith(cwd + path.sep)) {
					console.log(`[Claude Stream ${requestId}] Path denied - outside workspace: ${norm}`)
					return { behavior: 'deny', message: 'path_outside_workspace' }
				}
				console.log(`[Claude Stream ${requestId}] Path allowed: ${norm}`)
			}

			const allow: PermissionResult = {
				behavior: 'allow',
				updatedInput: input,
				updatedPermissions: [],
			}
			console.log(`[Claude Stream ${requestId}] Tool allowed: ${toolName}`)
			return allow
		}

		const claudeOptions: Options = {
			cwd,
			allowedTools: ['Write', 'Edit', 'Read', 'Glob', 'Grep'],
			permissionMode: 'acceptEdits',
			canUseTool,
			systemPrompt: { type: 'preset', preset: 'claude_code' },
			settingSources: [],
			model: process.env.CLAUDE_MODEL,
			apiKey: process.env.ANTH_API_SECRET,
		}

		console.log(`[Claude Stream ${requestId}] Creating stream...`)

		// Create and return SSE stream
		const stream = createClaudeStream({
			message,
			claudeOptions,
			requestId,
			host,
			cwd,
		})

		return createSSEResponse(stream)
	} catch (outerError) {
		console.error(`[Claude Stream ${requestId}] Outer catch - request processing failed:`, outerError)
		return NextResponse.json(
			{
				ok: false,
				error: 'request_processing_failed',
				message: 'Failed to process streaming request',
				details: outerError instanceof Error ? outerError.message : 'Unknown error',
				requestId,
			},
			{ status: 500 },
		)
	}
}
