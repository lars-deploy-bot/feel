import * as Sentry from "@sentry/nextjs"
import { requireEnv } from "@webalive/shared"
import { AuthenticationError, requireSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"

const BASE_PROMPT = [
  "BACKGROUND: Pure solid #FFFFFF white, completely flat, no shadows, no ground shadow, no gradient, no floor reflection. Just white.",
  "CHARACTER: Full body chunky cartoon game character. Big oversized head, small stubby legs, thick rounded body. Bold cel-shaded 3D render like Clash Royale, Brawl Stars, or Overwatch chibi. Colorful, vibrant, saturated colors. Thick dark outlines on everything.",
  "ROLE: This character is a {description}.",
  "THE FUNNY PART: Their outfit, armor, weapons, and accessories are literally made from objects of their job. Be creative and humorous — an email worker wears armor made of sealed envelopes with stamp shoulder pads, a coder has keyboard-key chainmail, a designer carries potion bottles filled with hex colors, a DevOps engineer has steampunk pipes labeled DEPLOY. The funnier and more literal the connection between job and gear, the better.",
  "FACE: Friendly, determined, slightly goofy smile. Big expressive eyes. This character WANTS to do the work.",
  "RENDER: Clean studio lighting, even from all sides. No dramatic shadows. Product photography quality. The character should look like a collectible vinyl toy you want on your desk.",
].join(" ")

const FETCH_TIMEOUT_MS = 30_000

export async function POST(req: Request) {
  try {
    await requireSessionUser()

    const body = await req.json()
    const description: unknown =
      typeof body === "object" && body !== null && "description" in body ? body.description : undefined
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
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("[Avatar Generate] Reve API failed:", text)
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 502 })
    }

    const data = await res.json()

    // Reve API returns { file_url } (store:true) or { image } (base64)
    // Sometimes returns a blank 1x1 PNG when rate limited — reject those
    let fileUrl: string | null = null

    if (typeof data.file_url === "string") {
      const headRes = await fetch(data.file_url, { method: "HEAD" })
      const size = Number(headRes.headers.get("content-length") ?? "0")
      if (size > 500) {
        fileUrl = data.file_url
      }
    }

    if (!fileUrl && typeof data.image === "string" && data.image.length > 1000) {
      fileUrl = `data:image/png;base64,${data.image}`
    }

    if (!fileUrl) {
      return structuredErrorResponse(ErrorCodes.IMAGE_PROCESSING_FAILED, { status: 429 })
    }

    return Response.json({ ok: true, file_url: fileUrl, prompt })
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }
    console.error("[Avatar Generate] Unexpected error:", err)
    Sentry.captureException(err)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }
}
