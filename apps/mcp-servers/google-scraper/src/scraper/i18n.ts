/**
 * Internationalization data for Google Maps scraping.
 * Single source of truth for all language-specific patterns.
 */

// Language definitions with all translatable terms
const LANGS = {
  en: {
    reviews: "Reviews",
    photo: "Photo of",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    time: ["month", "week", "day", "year", "hour", "minute"],
    ago: "ago",
  },
  de: {
    reviews: "Rezensionen",
    photo: "Foto von",
    days: ["montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag"],
    time: ["Monat", "Woche", "Tag", "Jahr", "Stunde", "Minute"],
    ago: "vor",
  },
  es: {
    reviews: "Reseñas",
    photo: "Foto de",
    days: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"],
    time: ["mes", "semana", "día", "año", "hora", "minuto"],
    ago: "hace",
  },
  pt: {
    reviews: "Avaliações",
    photo: "Foto de",
    days: ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"],
    time: ["mês", "semana", "dia", "ano", "hora", "minuto"],
    ago: "atrás",
  },
  fr: {
    reviews: "Avis",
    photo: "Photo de",
    days: ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"],
    time: ["mois", "semaine", "jour", "an", "heure", "minute"],
    ago: "il y a",
  },
  it: {
    reviews: "Recensioni",
    photo: "Foto di",
    days: ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"],
    time: ["mese", "settimana", "giorno", "anno", "ora", "minuto"],
    ago: "fa",
  },
  nl: {
    reviews: "Beoordelingen",
    photo: "Foto van",
    days: ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"],
    time: ["maand", "week", "dag", "jaar", "uur", "minuut"],
    ago: "geleden",
  },
  ru: {
    reviews: "Отзывы",
    photo: "Фото",
    days: ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"],
    time: ["месяц", "неделя", "день", "год", "час", "минута"],
    ago: "назад",
  },
  zh: {
    reviews: "评论",
    photo: "照片",
    days: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    time: ["月", "周", "天", "年", "小时", "分钟"],
    ago: "前",
  },
  ja: {
    reviews: "レビュー",
    photo: "写真",
    days: ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"],
    time: ["か月", "週間", "日", "年", "時間", "分"],
    ago: "前",
  },
} as const

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"
const DAY_KEYS: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

// Build derived patterns from LANGS
export const REVIEW_TAB_SELECTORS = [
  ...Object.values(LANGS).map(l => `button[aria-label*="${l.reviews}"]`),
  'button[data-tab-index="1"]', // Fallback
]

export const PHOTO_PREFIXES = Object.values(LANGS).map(l => l.photo)

const TIME_UNITS = Object.values(LANGS).flatMap(l => l.time)
const AGO_PATTERNS = Object.values(LANGS).map(l => l.ago)

// Regex for relative time detection
const timeUnitsPattern = TIME_UNITS.join("|")
const agoPattern = AGO_PATTERNS.map(a => (a.includes(" ") ? `^${a}\\s+` : `${a}$`)).join("|")
export const RELATIVE_TIME_REGEX = new RegExp(`\\d+\\s*(${timeUnitsPattern})|${agoPattern}`, "i")

// Day name to key mapping (built from LANGS)
export const DAY_MAP: Record<string, DayKey> = Object.values(LANGS).reduce(
  (acc, lang) => {
    lang.days.forEach((day, i) => {
      acc[day.toLowerCase()] = DAY_KEYS[i]
    })
    return acc
  },
  {} as Record<string, DayKey>,
)

// Helpers
export const isRelativeTime = (text: string) => RELATIVE_TIME_REGEX.test(text)

export function extractAuthorFromLabel(label: string): string {
  for (const prefix of PHOTO_PREFIXES) {
    if (label.toLowerCase().startsWith(prefix.toLowerCase())) {
      return label
        .slice(prefix.length)
        .replace(/^[:\s]+/, "")
        .trim()
    }
  }
  return label
}

// Debug helper - log what languages are configured
export function debugI18n() {
  console.log("Configured languages:", Object.keys(LANGS).join(", "))
  console.log("Review tab selectors:", REVIEW_TAB_SELECTORS.length)
  console.log("Time units:", TIME_UNITS.length)
  console.log("Day mappings:", Object.keys(DAY_MAP).length)
}
