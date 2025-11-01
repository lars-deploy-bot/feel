import { type NextRequest, NextResponse } from "next/server"
import { isInputSafeWithDebug } from "@/app/features/handlers/formatMessage"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { input } = body

    if (!input || typeof input !== "string") {
      return NextResponse.json({ error: "Input is required and must be a string" }, { status: 400 })
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
    return NextResponse.json(
      {
        error: "Failed to check input safety",
        result: "error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
