import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"

import { askAI } from "../../lib/ask-ai"

export const generatePersonaParamsSchema = {
  query: z.string().describe("What would the best person in this world do? (the task or role you need)"),
  style_preferences: z.string().describe("What makes it lovable to you? What qualities should it have?"),
  extra_things_to_know: z.string().optional().describe("Extra context about the website or project"),
}

export type GeneratePersonaParams = {
  query: string
  style_preferences: string
  extra_things_to_know?: string
}

// Schema for the generated persona
const personaSchema = z.object({
  famous_person: z.string().describe("The famous person who would approach this task ideally"),
  why_this_person: z.string().describe("Why this person is perfect for this specific task"),
  qualities_and_skills: z.array(z.string()).describe("Their key qualities and skills that matter for this task"),
  how_they_approach_problems: z.string().describe("How this person typically tackles challenges"),
  what_makes_them_different: z.string().describe("What sets them apart from everyone else in their field"),
  what_theyre_good_at: z.array(z.string()).describe("Specific things they excel at"),
  how_they_feel_about_things: z.string().describe("Their intuition and instincts about what works"),
  what_they_value: z.array(z.string()).describe("What matters most to them - their core values"),
  how_they_check_their_work: z.object({
    standards: z.array(z.string()).describe("The standards they hold themselves to"),
    process: z.string().describe("How they evaluate if something is good"),
    red_flags: z.array(z.string()).describe("What they would immediately reject as not good enough"),
  }),
  quote_that_captures_them: z.string().describe("A real or representative quote that captures their philosophy"),
})

export type PersonaProfile = z.infer<typeof personaSchema>

export type GeneratePersonaResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
  persona?: PersonaProfile
}

function formatPersonaAsMarkdown(persona: PersonaProfile): string {
  const lines: string[] = []

  lines.push(`# ${persona.famous_person}`)
  lines.push("")
  lines.push(`> ${persona.quote_that_captures_them}`)
  lines.push("")

  lines.push("## Why Them?")
  lines.push(persona.why_this_person)
  lines.push("")

  lines.push("## Qualities & Skills")
  persona.qualities_and_skills.forEach(q => {
    lines.push(`- ${q}`)
  })
  lines.push("")

  lines.push("## How They Approach Problems")
  lines.push(persona.how_they_approach_problems)
  lines.push("")

  lines.push("## What Makes Them Different")
  lines.push(persona.what_makes_them_different)
  lines.push("")

  lines.push("## What They're Good At")
  persona.what_theyre_good_at.forEach(skill => {
    lines.push(`- ${skill}`)
  })
  lines.push("")

  lines.push("## How They Feel About Things")
  lines.push(persona.how_they_feel_about_things)
  lines.push("")

  lines.push("## What They Value")
  persona.what_they_value.forEach(value => {
    lines.push(`- ${value}`)
  })
  lines.push("")

  lines.push("## How They Check Their Work")
  lines.push("**Standards They Hold:**")
  persona.how_they_check_their_work.standards.forEach(standard => {
    lines.push(`- ${standard}`)
  })
  lines.push("")

  lines.push("**Their Process:**")
  lines.push(persona.how_they_check_their_work.process)
  lines.push("")

  lines.push("**Red Flags (What They'd Reject):**")
  persona.how_they_check_their_work.red_flags.forEach(flag => {
    lines.push(`- ${flag}`)
  })

  return lines.join("\n")
}

export async function generatePersona(params: GeneratePersonaParams): Promise<GeneratePersonaResult> {
  try {
    const { query, style_preferences, extra_things_to_know } = params

    const prompt = `Find the ideal famous person to approach this task. Not someone fictional - a real, recognizable person who embodies what's needed.

**The Task:** ${query}

**What Makes It Lovable:** ${style_preferences}

${extra_things_to_know ? `**Project Context:** ${extra_things_to_know}` : ""}

Choose a famous person (real, known to history or current times) who:
- Would approach this task exactly as needed
- Has a proven track record of creating/building excellently
- Embodies the qualities in "What Makes It Lovable"

This can be anyone from any field - designers, engineers (backend, frontend, full-stack), artists, writers, executives, scientists, entrepreneurs, craftspeople, etc. Don't be biased towards specific people - pick whoever actually fits best.

Describe this person's:
1. Qualities and skills that matter for THIS task
2. How they typically approach problems
3. What makes them different/better than others
4. Specific things they excel at
5. Their intuition about what works (how they feel about things)
6. What they deeply value
7. How they check their own work (standards, process, what they would reject)

Make it specific to the task. Avoid generic answers.

Return a JSON object with these fields:
{
  "famous_person": "string",
  "why_this_person": "string",
  "qualities_and_skills": ["string"],
  "how_they_approach_problems": "string",
  "what_makes_them_different": "string",
  "what_theyre_good_at": ["string"],
  "how_they_feel_about_things": "string",
  "what_they_value": ["string"],
  "how_they_check_their_work": {
    "standards": ["string"],
    "process": "string",
    "red_flags": ["string"]
  },
  "quote_that_captures_them": "string"
}`

    const responseText = await askAI(prompt)
    const personaData = JSON.parse(responseText)
    const persona = personaSchema.parse(personaData)

    const personaText = formatPersonaAsMarkdown(persona)

    return {
      content: [
        {
          type: "text",
          text: personaText,
        },
      ],
      isError: false,
      persona,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Determine error type for gentle user messaging
    let userMessage = "Something went wrong while generating the persona."
    if (
      errorMessage.includes("GROQ_API_SECRET") ||
      errorMessage.includes("API") ||
      errorMessage.includes("authentication")
    ) {
      userMessage =
        "Unable to reach the AI service. Please try again in a moment, or check that the API key is configured correctly."
    } else if (errorMessage.includes("No response")) {
      userMessage =
        "The AI service didn't respond. This sometimes happens - feel free to try again."
    } else if (errorMessage.includes("JSON")) {
      userMessage =
        "The response format was unexpected. Please try again with a clearer task description."
    }

    return {
      content: [
        {
          type: "text",
          text: `${userMessage}\n\nDetails: ${errorMessage}`,
        },
      ],
      isError: true,
    }
  }
}

export const generatePersonaTool = tool(
  "generate_persona",
  "Generates a famous person persona who would approach your task ideally. Not fictional - a real person known for excelling at what you need. Returns their qualities, approach to problems, values, intuition, and standards for quality. Perfect for understanding how an excellent person would tackle your specific challenge.",
  generatePersonaParamsSchema,
  async args => {
    return generatePersona(args)
  }
)
