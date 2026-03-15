import { isValidVoiceLanguage } from "@webalive/shared"
import { NextResponse } from "next/server"
import { AuthenticationError, requireSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import type { TranscribeResult } from "@/lib/api/types"
import { miniToolsFetch } from "@/lib/clients/mini-tools"
import { ErrorCodes } from "@/lib/error-codes"

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

  const language = formData.get("language")

  const upstream = new FormData()
  upstream.append("file", file, file.name)
  if (typeof language === "string" && isValidVoiceLanguage(language)) {
    upstream.append("language", language)
  }

  const response = await miniToolsFetch("/groq/transcribe", { method: "POST", body: upstream })
  const data = await response.json()

  if (!response.ok) {
    return structuredErrorResponse(ErrorCodes.REQUEST_PROCESSING_FAILED, {
      status: response.status,
      details: { upstream: data.error },
    })
  }

  return NextResponse.json<TranscribeResult>({
    text: data.text,
    duration: data.duration,
    language: data.language,
  })
}
