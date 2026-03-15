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
const VOICE_LANGUAGES_INTERNAL = {
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
} satisfies Record<string, string>

export const VOICE_LANGUAGES: Readonly<typeof VOICE_LANGUAGES_INTERNAL> = VOICE_LANGUAGES_INTERNAL

export type VoiceLanguage = keyof typeof VOICE_LANGUAGES_INTERNAL

/**
 * All language codes as a tuple — for Zod schemas and runtime validation.
 * The type assertion is avoided by explicitly listing codes.
 */
export const VOICE_LANGUAGE_CODES: [VoiceLanguage, ...VoiceLanguage[]] = [
  "en",
  "nl",
  "de",
  "fr",
  "es",
  "pt",
  "it",
  "ja",
  "zh",
  "ko",
  "ar",
  "ru",
  "pl",
  "tr",
  "sv",
  "da",
  "no",
]

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

/**
 * Localized "thinking" phrases — shown while Claude is processing.
 * Casual, human, slightly playful.
 */
const THINKING_PHRASES: Record<VoiceLanguage, string> = {
  en: "thinking",
  nl: "even nadenken",
  de: "denke nach",
  fr: "je réfléchis",
  es: "pensando",
  pt: "pensando",
  it: "sto pensando",
  ja: "考え中",
  zh: "思考中",
  ko: "생각 중",
  ar: "أفكر",
  ru: "думаю",
  pl: "myślę",
  tr: "düşünüyorum",
  sv: "tänker",
  da: "tænker",
  no: "tenker",
}

export function getThinkingPhrase(lang: VoiceLanguage): string {
  return THINKING_PHRASES[lang]
}
