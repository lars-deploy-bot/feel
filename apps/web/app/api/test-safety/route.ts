import { type NextRequest, NextResponse } from "next/server"
import { createErrorResponse } from "@/features/auth/lib/auth"
import { isInputSafeWithDebug } from "@/features/chat/lib/formatMessage"
import { ErrorCodes } from "@/lib/error-codes"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { input } = body

    if (!input || typeof input !== "string") {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, 400, { field: "input" })
    }

    console.log(`[Safety Test] Checking input: "${input}"`)

    // Use the debug version to get EVERYTHING
    const result = await isInputSafeWithDebug(input)

    return NextResponse.json({
      result: result.result,
      debug: {
        groqStatus: "connected",
        hasGroqSecret: !!process.env.GROQ_API_SECRET,
        rawGroqResponse: result.debug.rawContent || "",
        input: input,
        fullChatCompletion: result.debug.fullResponse,
        error: result.debug.error,
        model: result.debug.model,
        prompt: result.debug.prompt,
      },
    })
  } catch (error) {
    console.error("[Safety Test] Error:", error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500, {
      exception: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
