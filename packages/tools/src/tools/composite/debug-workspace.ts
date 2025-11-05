import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { readServerLogs } from "../debug/read-server-logs.js"

/**
 * Composite tool: Combines log reading, analysis, and actionable suggestions
 * Implements Anthropic best practice: higher-level operations reduce round trips
 */

export const debugWorkspaceParamsSchema = {
  workspace: z
    .string()
    .min(1)
    .regex(/^[a-z0-9.-]+$/i)
    .describe("Workspace domain (e.g., 'two.goalive.nl')"),
  lines: z.number().int().min(1).max(1000).optional().default(200).describe("Log lines to analyze (default: 200)"),
  since: z.string().optional().describe('Time range (e.g., "5 minutes ago", "1 hour ago")'),
}

export type DebugWorkspaceParams = {
  workspace: string
  lines?: number
  since?: string
}

export type DebugWorkspaceResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

interface DebugAnalysis {
  errorCount: number
  warningCount: number
  commonPatterns: string[]
  suggestedActions: string[]
  suggestedGuides: Array<{ category: string; topic: string; reason: string }>
}

function analyzeErrors(logOutput: string): DebugAnalysis {
  const analysis: DebugAnalysis = {
    errorCount: 0,
    warningCount: 0,
    commonPatterns: [],
    suggestedActions: [],
    suggestedGuides: [],
  }

  // Count errors and warnings
  const errorMatch = logOutput.match(/\*\*Errors:\*\* (\d+)/i)
  const warnMatch = logOutput.match(/\*\*Warnings:\*\* (\d+)/i)

  if (errorMatch) analysis.errorCount = Number.parseInt(errorMatch[1], 10)
  if (warnMatch) analysis.warningCount = Number.parseInt(warnMatch[1], 10)

  const lowerLog = logOutput.toLowerCase()

  // Detect common patterns and suggest actions
  if (lowerLog.includes("enoent") || lowerLog.includes("no such file")) {
    analysis.commonPatterns.push("Missing files or directories")
    analysis.suggestedActions.push("Check file paths in your code")
    analysis.suggestedGuides.push({
      category: "workflows",
      topic: "file-structure",
      reason: "File path errors detected",
    })
  }

  if (lowerLog.includes("module") && lowerLog.includes("not found")) {
    analysis.commonPatterns.push("Missing dependencies")
    analysis.suggestedActions.push("Run `bun install` to install dependencies")
  }

  if (lowerLog.includes("port") && lowerLog.includes("in use")) {
    analysis.commonPatterns.push("Port already in use")
    analysis.suggestedActions.push("Restart the dev server to free the port")
    analysis.suggestedActions.push("Use mcp__workspace-management__restart_dev_server")
  }

  if (lowerLog.includes("syntax") || lowerLog.includes("unexpected token")) {
    analysis.commonPatterns.push("Syntax errors in code")
    analysis.suggestedActions.push("Check recent code changes for syntax issues")
  }

  if (lowerLog.includes("vite") && lowerLog.includes("error")) {
    analysis.commonPatterns.push("Vite build errors")
    analysis.suggestedGuides.push({
      category: "workflows",
      topic: "vite",
      reason: "Vite build issues detected",
    })
  }

  if (lowerLog.includes("type") && lowerLog.includes("error")) {
    analysis.commonPatterns.push("TypeScript type errors")
    analysis.suggestedActions.push("Check TypeScript errors in your IDE")
  }

  if (lowerLog.includes("permission denied") || lowerLog.includes("eacces")) {
    analysis.commonPatterns.push("Permission errors")
    analysis.suggestedActions.push("Check file/directory permissions")
  }

  // General suggestions based on error count
  if (analysis.errorCount > 0) {
    analysis.suggestedActions.push("Read full logs with summary_only: false for complete details")
  }

  if (analysis.errorCount > 10) {
    analysis.suggestedActions.push("Multiple errors detected - consider restarting dev server")
    analysis.suggestedActions.push("Use mcp__workspace-management__restart_dev_server")
  }

  return analysis
}

export async function debugWorkspace(params: DebugWorkspaceParams): Promise<DebugWorkspaceResult> {
  const { workspace, lines = 200, since } = params

  try {
    // Step 1: Read logs in summary mode
    const logsResult = await readServerLogs({
      workspace,
      lines,
      since,
      summary_only: true,
    })

    if (logsResult.isError) {
      return logsResult
    }

    const logOutput = logsResult.content[0].text

    // Step 2: Analyze logs
    const analysis = analyzeErrors(logOutput)

    // Step 3: Build comprehensive debug report
    let report = `# Workspace Debug Report: ${workspace}\n\n`
    report += logOutput
    report += "\n\n---\n\n"

    report += "## Automated Analysis\n\n"

    if (analysis.errorCount === 0 && analysis.warningCount === 0) {
      report += "✅ **No errors or warnings detected** - workspace appears healthy!\n\n"
      report += "**Suggested next steps:**\n"
      report += "- Verify application is running correctly\n"
      report += "- Check browser console for client-side issues\n"
      return {
        content: [{ type: "text" as const, text: report }],
        isError: false,
      }
    }

    // Report findings
    if (analysis.commonPatterns.length > 0) {
      report += "### Detected Issues\n"
      for (const pattern of analysis.commonPatterns) {
        report += `- ${pattern}\n`
      }
      report += "\n"
    }

    // Suggested actions
    if (analysis.suggestedActions.length > 0) {
      report += "### Recommended Actions\n"
      for (let i = 0; i < analysis.suggestedActions.length; i++) {
        report += `${i + 1}. ${analysis.suggestedActions[i]}\n`
      }
      report += "\n"
    }

    // Suggested guides
    if (analysis.suggestedGuides.length > 0) {
      report += "### Helpful Guides\n"
      for (const guide of analysis.suggestedGuides) {
        report += `- **${guide.category}** (topic: "${guide.topic}"): ${guide.reason}\n`
        report += `  Use: \`mcp__tools__get_guide({ category: "${guide.category}", topic: "${guide.topic}" })\`\n`
      }
      report += "\n"
    }

    // Quick actions
    report += "### Quick Actions\n"
    report += `- **Read full logs**: \`mcp__tools__read_server_logs({ workspace: "${workspace}", summary_only: false })\`\n`
    report += `- **Restart server**: \`mcp__workspace-management__restart_dev_server({ workspace: "${workspace}" })\`\n`
    report += `- **Search for specific errors**: \`mcp__tools__read_server_logs({ workspace: "${workspace}", search: "error" })\`\n`

    return {
      content: [
        {
          type: "text" as const,
          text: report,
        },
      ],
      isError: false,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      content: [
        {
          type: "text" as const,
          text: `# Debug Failed\n\n**Workspace:** ${workspace}\n\n**Error:** ${errorMessage}`,
        },
      ],
      isError: true,
    }
  }
}

export const debugWorkspaceTool = tool(
  "debug_workspace",
  `Composite debugging tool: Reads logs, analyzes common issues, and suggests actionable fixes. One-stop debugging that reduces round trips.

Use this FIRST when troubleshooting workspace issues. Provides:
- Log summary with error/warning counts
- Pattern detection (missing files, dependencies, syntax errors)
- Actionable recommendations
- Relevant guide suggestions
- Quick action commands

Examples:
- debug_workspace({ workspace: "two.goalive.nl" })
- debug_workspace({ workspace: "demo.goalive.nl", since: "10 minutes ago" })`,
  debugWorkspaceParamsSchema,
  async args => {
    return debugWorkspace(args)
  },
)
