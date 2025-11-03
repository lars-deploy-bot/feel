import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"

export const restartServerParamsSchema = {
	workspaceRoot: z.string().describe("The root path of the workspace (e.g., /srv/webalive/sites/example.com/user)"),
}

export type RestartServerParams = {
	workspaceRoot: string
}

export type RestartServerResult = {
	content: Array<{ type: "text"; text: string }>
	isError: boolean
}

export async function restartServer(params: RestartServerParams): Promise<RestartServerResult> {
	const { workspaceRoot } = params

	try {
		const response = await fetch("http://localhost:8998/api/restart-workspace", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ workspaceRoot }),
		})

		const result = (await response.json()) as { success?: boolean; message?: string }

		if (result.success) {
			return {
				content: [
					{
						type: "text" as const,
						text: `✓ ${result.message}\n\nThe server has been restarted and should now reflect your changes.`,
					},
				],
				isError: false,
			}
		}

		return {
			content: [
				{
					type: "text" as const,
					text: `✗ ${result.message}`,
				},
			],
			isError: true,
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)

		return {
			content: [
				{
					type: "text" as const,
					text: `✗ Failed to call restart API\n\nError: ${errorMessage}`,
				},
			],
			isError: true,
		}
	}
}

export const restartServerTool = tool(
	"restart_dev_server",
	"Restarts the systemd dev server for the current workspace. Use this after making structural changes that require a server restart (e.g., changing from localStorage to server-side state, adding new dependencies, modifying server configuration).",
	restartServerParamsSchema,
	async (args) => {
		return restartServer(args)
	},
)
