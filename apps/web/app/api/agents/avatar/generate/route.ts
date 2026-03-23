import * as Sentry from "@sentry/nextjs"
import { requireEnv } from "@webalive/shared"
import { AuthenticationError, requireSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"

const BASE_PROMPT =
  "Full body portrait of an adult {description}. Standing on pure white background, no shadows, no ground shadow. Disney Pixar 3D animation style. Full body visible from head to shoes. Clean flat studio render, even lighting, no shadows."

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

    // Reve API returns either { file_url } (when store:true works) or { image } (base64)
    let fileUrl: string | null = null
    if (typeof data.file_url === "string") {
      fileUrl = data.file_url
    } else if (typeof data.image === "string") {
      // Store the base64 image via the files endpoint
      const storeRes = await fetch("https://services.alive.best/tools/files/store", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: data.image, extension: "png" }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (storeRes.ok) {
        const storeData = await storeRes.json()
        if (typeof storeData.url === "string") fileUrl = storeData.url
      }
      // If store fails, return the image as a data URL so the frontend can still show it
      if (!fileUrl) {
        fileUrl = `data:image/png;base64,${data.image}`
      }
    }

    if (!fileUrl) {
      console.error("[Avatar Generate] No file_url or image in Reve response:", Object.keys(data))
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 502 })
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
