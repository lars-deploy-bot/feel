"use client"

import { WebFetchInput } from "@/components/ui/chat/tools/webfetch/WebFetchInput"
import { WebFetchOutput } from "@/components/ui/chat/tools/webfetch/WebFetchOutput"

export function WebFetchPreview() {
  return (
    <div className="space-y-8">
      {/* Input States */}
      <section>
        <h3 className="text-sm font-medium text-black/60 dark:text-white/60 mb-4">Input - Simple URL</h3>
        <div className="max-w-lg p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <WebFetchInput url="https://example.com" prompt="Extract the main content from this page" />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-black/60 dark:text-white/60 mb-4">Input - GitHub URL</h3>
        <div className="max-w-lg p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <WebFetchInput
            url="https://github.com/anthropics/claude-code/blob/main/README.md"
            prompt="Get the installation instructions and key features from this README"
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-black/60 dark:text-white/60 mb-4">Input - Documentation</h3>
        <div className="max-w-lg p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <WebFetchInput
            url="https://docs.anthropic.com/claude/docs/intro-to-claude"
            prompt="Summarize the main capabilities and limitations of Claude as described on this page"
          />
        </div>
      </section>

      {/* Output States */}
      <section>
        <h3 className="text-sm font-medium text-black/60 dark:text-white/60 mb-4">Output - Success</h3>
        <div className="max-w-lg p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <WebFetchOutput
            url="https://example.com/api/docs"
            content={`# API Documentation

## Authentication
All API requests require an API key passed in the Authorization header.

## Endpoints

### GET /users
Returns a list of users.

### POST /users
Creates a new user.

## Rate Limits
- 100 requests per minute for free tier
- 1000 requests per minute for pro tier`}
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-black/60 dark:text-white/60 mb-4">Output - Long Content (Truncated)</h3>
        <div className="max-w-lg p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <WebFetchOutput
            url="https://en.wikipedia.org/wiki/Artificial_intelligence"
            content={`Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.

The term "artificial intelligence" had previously been used to describe machines that mimic and display "human" cognitive skills that are associated with the human mind, such as "learning" and "problem-solving". This definition has since been rejected by major AI researchers who now describe AI in terms of rationality and acting rationally, which does not limit how intelligence can be articulated.

AI applications include advanced web search engines (e.g., Google Search), recommendation systems (used by YouTube, Amazon, and Netflix), understanding human speech (such as Siri and Alexa), self-driving cars (e.g., Waymo), generative or creative tools (ChatGPT and AI art), automated decision-making, and competing at the highest level in strategic game systems (such as chess and Go).

${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50)}`}
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-black/60 dark:text-white/60 mb-4">Output - Error</h3>
        <div className="max-w-lg p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <WebFetchOutput
            url="https://invalid-domain-12345.com"
            error="Failed to fetch: ENOTFOUND invalid-domain-12345.com"
          />
        </div>
      </section>
    </div>
  )
}
