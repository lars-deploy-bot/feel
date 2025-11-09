import { readFile, realpath } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Template categories available in the system
 */
export const TEMPLATE_CATEGORIES = [
	"sliders",
	"maps",
	"file-upload",
	"blog",
] as const

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

/**
 * Zod schema for get_template parameters (raw shape, not z.object())
 */
export const getTemplateParamsSchema = {
	id: z
		.string()
		.describe(
			"Versioned template ID in format {name}-v{major}.{minor}.{patch}. " +
				"Examples: 'carousel-thumbnails-v1.0.0', 'map-basic-markers-v1.0.0'. " +
				"CRITICAL: Only use when user message contains EXACT phrase 'Use template: {template-id}'. " +
				"Do NOT call for natural language requests like 'build a carousel' or 'create a map'.",
		),
}

export type GetTemplateParams = {
	id: string
}

export type GetTemplateResult = {
	content: Array<{ type: "text"; text: string }>
	isError: boolean
}

/**
 * Validates if a resolved path is within the allowed base directory
 */
function isPathWithinBase(resolvedPath: string, basePath: string): boolean {
	const normalizedPath = resolve(resolvedPath)
	const normalizedBase = resolve(basePath)
	return normalizedPath.startsWith(normalizedBase + "/") || normalizedPath === normalizedBase
}

/**
 * Get a specific template by ID
 */
export async function getTemplate(
	params: GetTemplateParams,
	templatesBasePath: string,
): Promise<GetTemplateResult> {
	try {
		const { id } = params

		// Security: Validate input length (prevent DOS)
		if (id.length > 100) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Template ID too long. Maximum length is 100 characters.`,
					},
				],
				isError: true,
			}
		}

		// Security: Validate input is not empty or whitespace only
		if (!id || id.trim().length === 0) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Template ID cannot be empty.`,
					},
				],
				isError: true,
			}
		}

		// Security: Reject any path traversal attempts
		if (id.includes("..") || id.includes("/") || id.includes("\\")) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Invalid template ID: path traversal detected. Template IDs should only contain alphanumeric characters, hyphens, and dots.`,
					},
				],
				isError: true,
			}
		}

		// Security: Validate characters (only alphanumeric, hyphens, dots)
		if (!/^[a-z0-9.-]+$/i.test(id)) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Invalid template ID: contains invalid characters. Only alphanumeric, hyphens, and dots are allowed.`,
					},
				],
				isError: true,
			}
		}

		// Validate template ID format (should end with -vX.Y.Z)
		if (!id.match(/^[a-z0-9-]+-v\d+\.\d+\.\d+$/i)) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Invalid template ID format: "${id}". Template IDs should match pattern: {name}-v{major}.{minor}.{patch} (e.g., "carousel-thumbnails-v1.0.0").`,
					},
				],
				isError: true,
			}
		}

		const templateFile = `${id}.md`
		const templatePath = join(templatesBasePath, templateFile)

		// Security: Resolve real path and verify it's within templates directory
		const resolvedBase = resolve(templatesBasePath)
		const resolvedPath = resolve(templatePath)

		if (!isPathWithinBase(resolvedPath, resolvedBase)) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Security error: Template path is outside allowed directory.`,
					},
				],
				isError: true,
			}
		}

		try {
			// Read file content
			const content = await readFile(resolvedPath, "utf-8")

			// Security: Check file size (prevent memory exhaustion)
			if (content.length > 500000) {
				// 500KB limit
				return {
					content: [
						{
							type: "text" as const,
							text: `Template file too large. Maximum size is 500KB.`,
						},
					],
					isError: true,
				}
			}

			// Security: Verify it's actually a symlink-free path
			try {
				const realPath = await realpath(resolvedPath)
				if (!isPathWithinBase(realPath, resolvedBase)) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Security error: Template symlink points outside allowed directory.`,
							},
						],
						isError: true,
					}
				}
			} catch (realpathError) {
				// File doesn't exist or can't be resolved - will be caught below
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `# Template: ${id}\n\n${content}\n\n---\n\n**Ready to implement this template.**`,
					},
				],
				isError: false,
			}
		} catch (fileError) {
			// Template file not found
			return {
				content: [
					{
						type: "text" as const,
						text: `Template "${id}" not found.`,
					},
				],
				isError: true,
			}
		}
	} catch (error) {
		return {
			content: [
				{
					type: "text" as const,
					text: `Error retrieving template: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
			isError: true,
		}
	}
}

/**
 * MCP tool: get_template
 *
 * Retrieves a specific implementation template by ID.
 * Templates contain detailed instructions for building components, features, or integrations.
 *
 * WHEN to use: ONLY when the user message contains the EXACT phrase "Use template: {template-id}"
 * (This phrase is sent automatically when user clicks a template in the UI)
 *
 * DO NOT use when:
 * - User says "build a carousel" or "create a map" (use your own implementation instead)
 * - User asks "what templates exist" (there's no discovery tool)
 * - Similar feature requests without the exact trigger phrase
 *
 * HOW to use: Extract the template ID from "Use template: {id}" and call with that exact ID
 */
export const getTemplateTool = tool(
	"get_template",
	"Retrieves implementation instructions for a specific template. " +
		"CRITICAL TRIGGER: Only call when user message contains EXACT phrase 'Use template: carousel-thumbnails-v1.0.0' (or similar template ID). " +
		"This phrase is sent by the UI when user clicks a template button. " +
		"DO NOT call for natural language requests like 'build a carousel', 'create a map', or 'I need file upload'. " +
		"For those, implement from scratch - do NOT try to find a matching template. " +
		"Templates include file structure, dependencies, and step-by-step implementation.",
	getTemplateParamsSchema,
	async (args) => {
		const packageRoot = join(__dirname, "../../..")
		const templatesBasePath = join(packageRoot, "internals-folder/templates")
		return getTemplate(args, templatesBasePath)
	},
)
