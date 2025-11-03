import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { browserManager } from "../../lib/browser-manager.js"

/**
 * Tool Parameters
 */
export const sandboxScreenshotParamsSchema = {
  workspaceUrl: z.string().describe("URL of the deployed workspace (e.g., https://two.goalive.nl)"),
  path: z.string().optional().default("/").describe('Path/route to screenshot (e.g., "/", "/dashboard", "/profile")'),
  fullPage: z
    .boolean()
    .optional()
    .default(false)
    .describe("Capture full page height (default: false, captures viewport only)"),
  waitTime: z
    .number()
    .optional()
    .default(2000)
    .describe("Milliseconds to wait before taking screenshot for page to fully load (default: 2000ms)"),
}

export type SandboxScreenshotParams = {
  workspaceUrl: string
  path?: string
  fullPage?: boolean
  waitTime?: number
}

export type SandboxScreenshotResult = {
  content: Array<{ type: "text" | "image"; text?: string; data?: string; mimeType?: string }>
  isError: boolean
}

/**
 * Business Logic: Take Screenshot of Deployed Site
 */
export async function sandboxScreenshot(params: SandboxScreenshotParams): Promise<SandboxScreenshotResult> {
  const { workspaceUrl, path = "/", fullPage = false, waitTime = 2000 } = params

  let context: Awaited<ReturnType<typeof browserManager.createContext>> | null = null

  try {
    // Build full URL
    const baseUrl = new URL(workspaceUrl)
    const fullUrl = new URL(path, baseUrl).toString()

    // Create browser context
    context = await browserManager.createContext()
    const page = await context.newPage()

    // Navigate to the page
    console.log(`[sandbox-screenshot] Navigating to ${fullUrl}`)
    await page.goto(fullUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    })

    // Wait for page to settle
    console.log(`[sandbox-screenshot] Waiting ${waitTime}ms for page to settle...`)
    await page.waitForTimeout(waitTime)

    // Take screenshot
    console.log(`[sandbox-screenshot] Taking screenshot (fullPage: ${fullPage})`)
    const screenshot = await page.screenshot({
      type: "png",
      fullPage,
    })

    // Close the page and context
    await page.close()
    await context.close()
    context = null

    // Save screenshot to temp directory
    const screenshotDir = join(tmpdir(), "alive-screenshots")
    await mkdir(screenshotDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const sanitizedPath = path.replace(/\//g, "_") || "root"
    const filename = `screenshot-${sanitizedPath}-${timestamp}.png`
    const filepath = join(screenshotDir, filename)

    await writeFile(filepath, screenshot)
    console.log(`[sandbox-screenshot] Screenshot saved to ${filepath}`)

    // Convert to base64 for inline display
    const base64Screenshot = screenshot.toString("base64")

    return {
      content: [
        {
          type: "text" as const,
          text: `# Screenshot: ${fullUrl}\n\n**Path:** ${path}\n**Full Page:** ${fullPage}\n**Saved to:** ${filepath}\n\n`,
        },
        {
          type: "image" as const,
          data: base64Screenshot,
          mimeType: "image/png",
        },
      ],
      isError: false,
    }
  } catch (error) {
    // Clean up context if still open
    if (context) {
      try {
        await context.close()
      } catch {}
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      content: [
        {
          type: "text" as const,
          text: `# Failed to Take Screenshot\n\n**URL:** ${workspaceUrl}\n**Path:** ${path}\n\n**Error:** ${errorMessage}\n\n**Troubleshooting:**\n- Verify the URL is accessible\n- Check if the site is deployed and running\n- Ensure the URL includes the protocol (https://)\n- Try a different path if the current one requires authentication`,
        },
      ],
      isError: true,
    }
  }
}

/**
 * MCP Tool Registration
 */
export const sandboxScreenshotTool = tool(
  "sandbox_screenshot",
  "Captures a screenshot of a deployed website at a specific route/path. Useful for visual debugging, verifying UI changes, and documenting issues. Cannot access auth-protected pages.",
  sandboxScreenshotParamsSchema,
  async args => {
    return sandboxScreenshot(args)
  },
)
