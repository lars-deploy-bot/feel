export type VoiceState = "idle" | "recording" | "transcribing"

// Re-export API types so hook doesn't need to know about lib/api
export type { TranscribeResponse } from "@/lib/api/types"
