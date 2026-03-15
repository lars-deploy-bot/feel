/**
 * Voice / Response Language Configuration
 *
 * SINGLE SOURCE OF TRUTH for supported languages.
 * Used by Whisper transcription (Groq) and Claude system prompt.
 * All packages should import from here.
 */

/**
 * Supported languages keyed by ISO 639-1 code.
 */
export const VOICE_LANGUAGES = {
  en: "English",
  nl: "Dutch",
  de: "German",
  fr: "French",
  es: "Spanish",
  pt: "Portuguese",
  it: "Italian",
  ja: "Japanese",
  zh: "Chinese",
  ko: "Korean",
  ar: "Arabic",
  ru: "Russian",
  pl: "Polish",
  tr: "Turkish",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
} as const

export type VoiceLanguage = keyof typeof VOICE_LANGUAGES

/**
 * All language codes as a tuple — for Zod schemas and runtime validation.
 */
export const VOICE_LANGUAGE_CODES = Object.keys(VOICE_LANGUAGES) as [VoiceLanguage, ...VoiceLanguage[]]

/**
 * Default language
 */
export const DEFAULT_VOICE_LANGUAGE: VoiceLanguage = "en"

/**
 * Set of valid language codes for O(1) runtime validation
 */
const VALID_LANGUAGES = new Set<string>(Object.keys(VOICE_LANGUAGES))

/**
 * Type guard to check if a value is a valid voice language code
 */
export function isValidVoiceLanguage(value: unknown): value is VoiceLanguage {
  return typeof value === "string" && VALID_LANGUAGES.has(value)
}

/**
 * Get human-readable display name for a language code
 */
export function getLanguageDisplayName(lang: VoiceLanguage): string {
  return VOICE_LANGUAGES[lang]
}
