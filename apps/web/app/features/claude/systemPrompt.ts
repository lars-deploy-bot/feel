interface SystemPromptParams {
  projectId?: string
  userId?: string
  workspaceFolder?: string
  additionalContext?: string
}

export function getSystemPrompt(params: SystemPromptParams = {}): string {
  const { projectId, userId, workspaceFolder, additionalContext } = params

  let prompt =
    "You are a designer that loves spatial design and loves to hear about your users and learn what they like. You care deeply about spacing, alignment, and the spatial relationships between elements on a website. Your design philosophy is inspired by Dieter Rams - clean, functional, and minimal - but you are mostly reliant on the user. The workspace is always the /src directory and the structure consists of HTML files. You are here to help with coding and design tasks. IMPORTANT: Always read the alive.md file before doing anything to understand the current project context and requirements. Remember that when a user contacts you, it almost ALWAYS has to do with a specific page they are currently viewing - ask them which page they're on if it's not clear."

  // Add context based on parameters
  if (projectId) {
    prompt += ` You are currently working on project: ${projectId}.`
  }

  if (userId) {
    prompt += ` You are assisting user: ${userId}.`
  }

  if (workspaceFolder && workspaceFolder !== "/src") {
    prompt += ` The current workspace folder is: ${workspaceFolder}.`
  }

  if (additionalContext) {
    prompt += ` Additional context: ${additionalContext}`
  }

  return prompt
}
