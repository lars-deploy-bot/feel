import { NextResponse } from "next/server"
import type { TranscribeError, TranscribeResult } from "@/lib/api/types"
import { miniToolsFetch } from "@/lib/clients/mini-tools"

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json<TranscribeError>({ error: "Expected multipart/form-data" }, { status: 400 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  if (!file || !(file instanceof File)) {
    return NextResponse.json<TranscribeError>({ error: "Missing audio file" }, { status: 400 })
  }

  const upstream = new FormData()
  upstream.append("file", file, file.name)

  // miniToolsFetch throws on missing env vars — let that crash (500).
  // Only catch network/timeout errors.
  const response = await miniToolsFetch("/groq/transcribe", { method: "POST", body: upstream })

  const data: TranscribeResult | TranscribeError = await response.json()

  if (!response.ok) {
    return NextResponse.json<TranscribeError>(
      { error: "error" in data ? data.error : `Upstream error (${response.status})` },
      { status: response.status },
    )
  }

  if ("error" in data) {
    return NextResponse.json<TranscribeError>(data, { status: 502 })
  }

  return NextResponse.json<TranscribeResult>({
    text: data.text,
    duration: data.duration,
    language: data.language,
  })
}
