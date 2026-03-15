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
 * Localized "thinking" phrase pools — one is picked randomly each time.
 * Casual, human, slightly playful. Languages without a pool fall back to English.
 */
const THINKING_POOLS: Partial<Record<VoiceLanguage, string[]>> = {
  en: [
    "thinking",
    "hmm let me think",
    "hold on, brainwaves incoming",
    "buffering genius",
    "consulting my inner wizard",
    "neurons firing",
    "one braincell working overtime",
    "loading brilliance",
    "almost had a thought",
    "thinking very hard",
    "mentally sprinting",
    "cranking the think-machine",
    "assembling brain juice",
    "on it like a bonnet",
    "processing at the speed of thought",
    "doing brain things",
    "just a sec, vibes loading",
    "connecting braincells",
    "deep in the sauce",
    "give me a hot second",
    "brain.exe is running",
    "summoning the answer",
    "my last braincell is trying",
    "entering the think tank",
    "mentally doing push-ups",
    "downloading wisdom",
    "rummaging through thoughts",
    "shaking the magic 8 ball",
    "warming up the brain oven",
    "engaging turbo think",
  ],
  nl: [
    "even nadenken",
    "momentje hoor",
    "ff m'n hersenen opstarten",
    "aan het puzzelen",
    "druk druk druk",
    "effe dimmen, ik denk",
    "hmm laat me even",
    "bezig met briljant zijn",
    "een momentje geduld aub",
    "mijn hersencellen overleggen",
    "ik ben er bijna",
    "denk denk denk",
    "even m'n beste beentje voorzetten",
    "aan het toveren",
    "wacht wacht ik heb het zo",
    "even m'n koppie kraken",
    "het kwartje valt bijna",
    "ik ga los",
    "concentratie modus aan",
    "ff de boel op een rijtje zetten",
  ],
  de: [
    "denke nach",
    "Moment mal",
    "Hirn wird hochgefahren",
    "bin am grübeln",
    "Sekündchen bitte",
    "Zahnräder drehen sich",
    "denke scharf nach",
    "Gehirnschmalz wird aktiviert",
    "fast hab ich's",
    "hmm lass mich mal",
    "bin voll dabei",
    "Denkkappe ist auf",
    "wird gleich genial",
    "ich knobel noch",
    "Kopf raucht schon",
    "einen klitzekleinen Moment",
    "Synapsen feuern",
    "gleich hab ich's",
    "Hirnzellen im Einsatz",
    "Denkmodus aktiviert",
  ],
}

const FALLBACK_POOL = THINKING_POOLS.en

export function getThinkingPhrase(lang: VoiceLanguage): string {
  const pool = THINKING_POOLS[lang] ?? FALLBACK_POOL
  if (!pool) return "thinking"
  return pool[Math.floor(Math.random() * pool.length)]
}
