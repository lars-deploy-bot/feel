import * as cheerio from "cheerio"
import type { GoogleMapsBusiness, GoogleMapsResult, ProxyConfig } from "../types.js"
import { parseHours, parseNumber, sanitizeJSON, setupPage, cleanupBrowser } from "../utils.js"

type ExtractResult = { success: true; data: GoogleMapsResult } | { success: false; error: string }

/**
 * Extract business data from a single Google Maps business page.
 */
export async function searchSingleBusiness(html: string, pageUrl: string): Promise<ExtractResult> {
  try {
    const $ = cheerio.load(html)

    // 1. Name and main image
    const main = $('div[role="main"][aria-label]')
    const storeName = main.attr("aria-label") || null
    const mainImage = main.find("img[decoding='async']").first().attr("src") || null

    // 2. Rating & reviews
    const stars = $(".fontDisplayLarge").text() || null
    const reviewsLabel = $('span[aria-label$="reviews"]').attr("aria-label") || null
    const numberOfReviews = parseNumber(reviewsLabel ?? undefined)

    // 3. Website, phone, address, category, status
    const bizWebsite = $('a[data-item-id="authority"]').attr("href") || null
    const phoneLabel = $('button[data-item-id^="phone:"]').attr("aria-label") || ""
    const phone = phoneLabel.replace(/^Phone:\s*/, "").trim() || null
    const addressLabel = $('button[data-item-id="address"]').attr("aria-label") || ""
    const address = addressLabel.replace(/^Address:\s*/, "").trim() || null
    const category = $('button[jsaction*="category"]').text().trim() || null

    // Hours/status
    const hoursText = $('div[aria-expanded][jsaction*="openhours"] span.ZDu9vd').text().trim()
    const status = hoursText ? hoursText.split("⋅").map(s => s.trim())[0] : null
    const hoursTable = $("div.fontBodyMedium table.fontBodyMedium").first().parent().html() || null

    // Place ID from URL
    const placeIdMatch = pageUrl.match(/ChI[^?&]+/)
    const placeId = placeIdMatch?.[0] ?? null

    const googleUrl = $('a[href^="https://www.google.com/maps/place"]').attr("href") || pageUrl || null

    const business: GoogleMapsBusiness = {
      placeId: placeId || undefined,
      storeName: storeName || undefined,
      ratingText: undefined,
      stars: stars || null,
      numberOfReviews,
      googleUrl: googleUrl || undefined,
      bizWebsite: bizWebsite || undefined,
      address: address || undefined,
      category: category || undefined,
      status: status || undefined,
      phone: phone || undefined,
      mainImage: mainImage || undefined,
      hours: parseHours(hoursTable),
    }

    return {
      success: true,
      data: {
        businesses: [business],
        html,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Scrape a single detail URL in its own ephemeral browser.
 */
export async function scrapeDetailPage(
  googleUrl: string,
  proxy?: ProxyConfig,
): Promise<{ originalUrl: string; business: GoogleMapsBusiness | null }> {
  try {
    const { browser, page } = await setupPage(proxy)
    await page.goto(googleUrl, { waitUntil: "networkidle2" })
    const html = await page.content()
    const result = await searchSingleBusiness(html, googleUrl)
    await cleanupBrowser(browser)

    if (result.success && result.data.businesses.length > 0) {
      return {
        originalUrl: googleUrl,
        business: sanitizeJSON<GoogleMapsBusiness>(result.data.businesses[0] as Record<string, unknown>),
      }
    }
    return { originalUrl: googleUrl, business: null }
  } catch {
    return { originalUrl: googleUrl, business: null }
  }
}
