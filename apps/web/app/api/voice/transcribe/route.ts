import { isValidVoiceLanguage } from "@webalive/shared"
import { NextResponse } from "next/server"
import { AuthenticationError, requireSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import type { TranscribeResult } from "@/lib/api/types"
import { ApiClientError, apiClient } from "@/lib/api-client"
import { ErrorCodes } from "@/lib/error-codes"

/**
 * Thin proxy: authenticate user session, then forward to apps/api voice service.
 * All validation, retry, and Groq communication lives in apps/api.
 */
export async function POST(request: Request) {
  try {
    await requireSessionUser()
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return structuredErrorResponse(ErrorCodes.AUTH_REQUIRED, { status: 401 })
    }
    throw error
  }

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.includes("multipart/form-data")) {
    return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, { status: 400 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  if (!file || !(file instanceof File)) {
    return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, { status: 400 })
  }

  // Forward to apps/api voice service
  const upstream = new FormData()
  upstream.append("file", file, file.name)
  const language = formData.get("language")
  if (typeof language === "string" && isValidVoiceLanguage(language)) {
    upstream.append("language", language)
  }

  try {
    const result = await apiClient.postRaw<TranscribeResult>("/voice/transcribe", upstream)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed"
    const status = err instanceof ApiClientError ? err.status : 502
    return structuredErrorResponse(ErrorCodes.REQUEST_PROCESSING_FAILED, {
      status,
      details: { upstream: message },
    })
  }
}
