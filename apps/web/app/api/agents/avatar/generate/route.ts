import * as Sentry from "@sentry/nextjs"
import { requireEnv } from "@webalive/shared"
import { requireSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"

const BASE_PROMPT =
  "Full body portrait of an adult {description}. Standing on pure white background, no shadows, no ground shadow. Disney Pixar 3D animation style. Full body visible from head to shoes. Clean flat studio render, even lighting, no shadows."

export async function POST(req: Request) {
  try {
    await requireSessionUser()

    const { description } = (await req.json()) as { description?: string }
    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { field: "description", message: "Description is required" },
      })
    }

    if (description.length > 500) {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { field: "description", message: "Description too long (max 500 chars)" },
      })
    }

    const prompt = BASE_PROMPT.replace("{description}", description.trim())
    const apiKey = requireEnv("ALIVE_SECRET_KEY")

    const res = await fetch("https://services.alive.best/tools/reve/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        aspect_ratio: "9:16",
        store: true,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("[Avatar Generate] Reve API failed:", text)
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 502 })
    }

    const data = await res.json()
    return Response.json({ ok: true, file_url: data.file_url, prompt })
  } catch (err) {
    console.error("[Avatar Generate] Unexpected error:", err)
    Sentry.captureException(err)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }
}
