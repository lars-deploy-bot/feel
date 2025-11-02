/**
 * Environment variable validation (T3 OSS pattern)
 * Validates required vars at build/startup time
 */

interface Env {
  ANTH_API_SECRET: string
  CLAUDE_MODEL: string
  CLAUDE_MAX_TURNS: string
  NODE_ENV: string
  WORKSPACE_BASE: string
  BRIDGE_PASSCODE?: string
  GROQ_API_SECRET?: string
  GITHUB_WEBHOOK_SECRET?: string
  DEPLOY_BRANCH?: string
  BRIDGE_ENV?: string
  LOCAL_TEMPLATE_PATH?: string
}

function validateEnv(): Env {
  const errors: string[] = []

  if (!process.env.ANTH_API_SECRET) {
    errors.push("ANTH_API_SECRET is required")
  }

  if (errors.length > 0) {
    const errorList = errors.map(e => `  - ${e}`).join("\n")
    throw new Error(
      `❌ Invalid environment variables:\n${errorList}\n\n` +
      `Check your .env file. See .env.example for reference.`
    )
  }

  return {
    ANTH_API_SECRET: process.env.ANTH_API_SECRET!,
    CLAUDE_MODEL: process.env.CLAUDE_MODEL ?? "claude-sonnet-4-5",
    CLAUDE_MAX_TURNS: process.env.CLAUDE_MAX_TURNS ?? "25",
    NODE_ENV: process.env.NODE_ENV ?? "production",
    WORKSPACE_BASE: process.env.WORKSPACE_BASE ?? "/srv/webalive/sites",
    BRIDGE_PASSCODE: process.env.BRIDGE_PASSCODE,
    GROQ_API_SECRET: process.env.GROQ_API_SECRET,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
    DEPLOY_BRANCH: process.env.DEPLOY_BRANCH,
    BRIDGE_ENV: process.env.BRIDGE_ENV,
    LOCAL_TEMPLATE_PATH: process.env.LOCAL_TEMPLATE_PATH,
  }
}

export const env = validateEnv()
