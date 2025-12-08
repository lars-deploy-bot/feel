import type { Browser, CookieData, Page } from "puppeteer"
import puppeteerExtra from "puppeteer-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import * as cheerio from "cheerio"
import type { ProxyConfig } from "./types.js"

// Cast to proper type - puppeteer-extra types don't fully expose the API
const puppeteer = puppeteerExtra as unknown as {
  use: (plugin: unknown) => void
  launch: (options?: Record<string, unknown>) => Promise<Browser>
}

// ============================================================================
// User Agents
// ============================================================================

export const UserAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
]

// ============================================================================
// Hostname Normalization
// ============================================================================

/**
 * Returns only the domain and TLD (last two parts) of a URL.
 */
export const normalizeHostname = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    const parts = hostname.split(".")
    return parts.length >= 2 ? parts.slice(-2).join(".") : hostname
  } catch {
    const cleanedUrl = url
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split("?")[0]
      .split("#")[0]

    const parts = cleanedUrl.split(".")
    return parts.length >= 2 ? parts.slice(-2).join(".") : cleanedUrl
  }
}

// ============================================================================
// Hours Parsing
// ============================================================================

function normalizeDashesAndSpaces(text: string): string {
  return text
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/−/g, "-")
    .replace(/\s+/g, " ")
}

export function parseHours(hoursTableHtml: string | null): {
  monday?: string
  tuesday?: string
  wednesday?: string
  thursday?: string
  friday?: string
  saturday?: string
  sunday?: string
} | null {
  if (!hoursTableHtml) {
    return null
  }

  let htmlToParse = hoursTableHtml
  if (hoursTableHtml.trim().startsWith("<tbody")) {
    htmlToParse = `<table>${hoursTableHtml}</table>`
  }

  const $ = cheerio.load(htmlToParse)
  const rows = $("tr").toArray()

  const hours: {
    monday?: string
    tuesday?: string
    wednesday?: string
    thursday?: string
    friday?: string
    saturday?: string
    sunday?: string
  } = {}

  const dayMap: Record<string, keyof typeof hours> = {
    // English
    monday: "monday",
    tuesday: "tuesday",
    wednesday: "wednesday",
    thursday: "thursday",
    friday: "friday",
    saturday: "saturday",
    sunday: "sunday",
    // German
    montag: "monday",
    dienstag: "tuesday",
    mittwoch: "wednesday",
    donnerstag: "thursday",
    freitag: "friday",
    samstag: "saturday",
    sonntag: "sunday",
    // French
    lundi: "monday",
    mardi: "tuesday",
    mercredi: "wednesday",
    jeudi: "thursday",
    vendredi: "friday",
    samedi: "saturday",
    dimanche: "sunday",
    // Dutch
    maandag: "monday",
    dinsdag: "tuesday",
    woensdag: "wednesday",
    donderdag: "thursday",
    vrijdag: "friday",
    zaterdag: "saturday",
    zondag: "sunday",
  }

  const rowData = rows
    .map(row => {
      const dayCell = $(row).find("td").first()
      const hoursCell = $(row).find("td").eq(1)
      const dayText = dayCell.find("div").first().text().toLowerCase().trim()
      const hoursText = normalizeDashesAndSpaces(hoursCell.find("li.G8aQO").text().trim())
      return { dayText, hoursText }
    })
    .filter(data => data.hoursText)

  for (const { dayText, hoursText } of rowData) {
    let dayKey: keyof typeof hours | undefined = dayMap[dayText]

    if (!dayKey) {
      for (const [name, key] of Object.entries(dayMap)) {
        if (dayText.includes(name)) {
          dayKey = key
          break
        }
      }
    }

    if (dayKey && hoursText) {
      hours[dayKey] = hoursText
    }
  }

  const assignedDays = Object.values(hours).filter(h => h !== undefined).length
  if (assignedDays < rowData.length && rowData.length === 7 && assignedDays === 0) {
    const sundayFirstOrder: (keyof typeof hours)[] = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ]
    rowData.forEach(({ hoursText }, index) => {
      if (index < sundayFirstOrder.length && hoursText) {
        hours[sundayFirstOrder[index]] = hoursText
      }
    })
  }

  return Object.keys(hours).length > 0 ? hours : null
}

// ============================================================================
// Browser Setup
// ============================================================================

/**
 * Check if the browser is available for launching.
 * Logs a warning if not installed.
 */
export async function checkBrowserAvailability(): Promise<boolean> {
  try {
    puppeteer.use(StealthPlugin())

    const launchOptions: Record<string, unknown> = {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    }

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
    }

    const browser = await puppeteer.launch(launchOptions)
    await browser.close()
    return true
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.error("=".repeat(70))
    console.error("WARNING: Browser not available for Google Maps scraper")
    console.error("=".repeat(70))
    console.error("")
    console.error("The Google Maps scraper requires a browser to be installed.")
    console.error("")
    console.error("To install the browser, run:")
    console.error("  npx puppeteer browsers install chrome")
    console.error("")
    console.error("Or if using Playwright:")
    console.error("  bunx playwright install chromium")
    console.error("")
    console.error(`Error details: ${errorMessage}`)
    console.error("=".repeat(70))

    return false
  }
}

export async function setupBrowser(proxy?: ProxyConfig): Promise<{ browser: Browser }> {
  puppeteer.use(StealthPlugin())

  const launchOptions: Record<string, unknown> = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  }

  // Support system Chromium (Docker)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
  }

  if (proxy) {
    launchOptions.args = [...(launchOptions.args as string[]), `--proxy-server=${proxy.ip}:${proxy.port}`]
  }

  const browser = await puppeteer.launch(launchOptions)

  const cookies: CookieData[] = [
    {
      name: "SOCS",
      value: "CAESHAgCEhJnd3NfMjAyNDA5MjQtMF9SQzIaAmVuIAEaBgiAjt23Bg",
      domain: ".google.com",
      path: "/",
      secure: true,
      sameSite: "Lax",
      expires: new Date("2026-10-28T14:13:10.467Z").getTime(),
    },
  ]

  await browser.setCookie(...cookies)
  return { browser }
}

export async function setupPage(proxy?: ProxyConfig): Promise<{ browser: Browser; page: Page }> {
  const { browser } = await setupBrowser(proxy)
  const page = await browser.newPage()

  if (proxy) {
    await page.authenticate({
      username: proxy.username,
      password: proxy.password,
    })
  }

  await page.setUserAgent(UserAgents[Math.floor(Math.random() * UserAgents.length)])
  return { browser, page }
}

export async function navigateToGoogleMaps(page: Page, query: string): Promise<void> {
  const mapsParsed = query.split(" ").join("+")
  const fullUrl = `https://www.google.com/maps/search/${mapsParsed}`

  await page.goto(fullUrl, { waitUntil: "networkidle2", timeout: 30000 })

  // Wait for either feed (multiple results) or detail panel (single result)
  await Promise.race([
    page.waitForSelector('div[role="feed"]', { timeout: 10000 }),
    page.waitForSelector("div.fontHeadlineLarge", { timeout: 10000 }),
  ]).catch(() => {
    // Fallback - just wait a bit for content to load
  })
}

export async function cleanupBrowser(browser: Browser): Promise<void> {
  const pages = await browser.pages()
  await Promise.all(pages.map(page => page.close()))
  await browser.close()
}

export async function detectFeed(page: Page): Promise<boolean> {
  return (await page.$('div[role="feed"]')) !== null
}

export async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const wrapper = document.querySelector('div[role="feed"]')

    await new Promise<void>(resolve => {
      let totalHeight = 0
      const distance = 1000
      const scrollDelay = 2000
      let noChangeCount = 0

      const timer = setInterval(async () => {
        const scrollHeightBefore = wrapper?.scrollHeight ?? 0
        wrapper?.scrollBy(0, distance)
        totalHeight += distance

        if (totalHeight >= scrollHeightBefore && scrollHeightBefore !== undefined) {
          totalHeight = 0
          await new Promise(r => setTimeout(r, scrollDelay))

          const scrollHeightAfter = wrapper?.scrollHeight

          if (
            scrollHeightAfter !== undefined &&
            scrollHeightBefore !== undefined &&
            scrollHeightAfter > scrollHeightBefore
          ) {
            noChangeCount = 0
            return
          }

          noChangeCount++
          if (noChangeCount >= 3) {
            clearInterval(timer)
            resolve()
          }
        }
      }, 200)
    })
  })
}

// ============================================================================
// Helpers
// ============================================================================

export function parseNumber(s?: string): number | null {
  if (!s) return null
  const m = s.match(/(\d+[.,]?\d*)/)
  return m ? Number(m[1].replace(",", ".")) : null
}

export function sanitizeJSON<T>(json: Record<string, unknown>): T {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(json)) {
    if (typeof value === "string") {
      sanitized[key] = value?.replace(/[\n\s]+/g, " ").trim() ?? ""
    } else {
      sanitized[key] = value
    }
  }
  return sanitized as T
}

export function isNullish(value: unknown): boolean {
  return value === null || value === undefined || value === ""
}
