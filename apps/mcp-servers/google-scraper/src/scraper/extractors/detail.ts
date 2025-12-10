import * as cheerio from "cheerio"
import type { GoogleMapsBusiness, GoogleMapsResult, GoogleMapsReview, ProxyConfig } from "../types.js"
import { parseHours, parseNumber, sanitizeJSON, setupPage, cleanupBrowser, clickReviewsTabAndWait } from "../utils.js"
import { isRelativeTime, extractAuthorFromLabel } from "../i18n.js"

type ExtractResult = { success: true; data: GoogleMapsResult } | { success: false; error: string }

/**
 * Parse star rating from aria-label like "5 Sterne", "4 stars", "3 estrelas"
 */
function parseStarRating(label: string | undefined): number | null {
  if (!label) return null
  const match = label.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Extract reviews from HTML using stable selectors.
 *
 * Strategy (in order of stability):
 * 1. Class-based selectors (most reliable for structure, may need updates)
 * 2. data-review-id for deduplication
 * 3. aria-label for ratings (accessibility requirement = stable)
 */
function extractReviews($: cheerio.CheerioAPI, maxReviews = 5): GoogleMapsReview[] {
  const reviews: GoogleMapsReview[] = []
  const seenTexts = new Set<string>()

  // Primary strategy: Use class-based selectors (jftiEf is the review container)
  // These may change but are the most reliable for structure
  $("div.jftiEf").each((_i, el) => {
    if (reviews.length >= maxReviews) return false

    const $review = $(el)

    // Author - try class first, then aria-label fallback
    let author = $review.find(".d4r55").text().trim()
    if (!author) {
      const authorLabel = $review.find('button[aria-label*="Photo"], button[aria-label*="Foto"]').attr("aria-label")
      if (authorLabel) {
        author = extractAuthorFromLabel(authorLabel)
      }
    }

    // Rating - use aria-label (stable accessibility requirement)
    const ratingLabel = $review.find('[role="img"][aria-label]').attr("aria-label")
    const rating = parseStarRating(ratingLabel)

    // Time - class first, then pattern matching fallback using shared utility
    let time = $review.find(".rsqaWe").text().trim()
    if (!time) {
      $review.find("span").each((_, span) => {
        const text = $(span).text().trim()
        if (isRelativeTime(text)) {
          time = text
          return false
        }
      })
    }

    // Review text - try multiple class selectors
    const text = $review.find(".wiI7pd, .MyEned").first().text().trim()

    // Deduplicate by text content
    if (text && seenTexts.has(text)) return
    if (text) seenTexts.add(text)

    if (author || text) {
      reviews.push({
        author: author || "Anonymous",
        rating,
        text: text || "",
        time: time || "",
      })
    }
  })

  // Fallback: If no reviews found via classes, try data-review-id approach
  if (reviews.length === 0) {
    const reviewIds = new Set<string>()

    $("[data-review-id]").each((_, el) => {
      if (reviews.length >= maxReviews) return false

      const reviewId = $(el).attr("data-review-id")
      if (!reviewId || reviewIds.has(reviewId)) return
      reviewIds.add(reviewId)

      // Walk up to find container with review content
      let $container = $(el)
      for (let j = 0; j < 8; j++) {
        const $parent = $container.parent()
        if ($parent.length === 0) break
        const hasRating = $parent.find('[role="img"][aria-label]').length > 0
        const textLen = $parent.find("span, div").text().length
        if (hasRating && textLen > 100) {
          $container = $parent
          break
        }
        $container = $parent
      }

      const ratingLabel = $container.find('[role="img"][aria-label]').first().attr("aria-label")
      const rating = parseStarRating(ratingLabel)

      // Find the longest text block as review content
      let text = ""
      $container.find("span").each((_, span) => {
        const content = $(span).text().trim()
        if (content.length > text.length && content.length > 30 && !content.includes("star")) {
          text = content
        }
      })

      if (text && !seenTexts.has(text)) {
        seenTexts.add(text)
        reviews.push({
          author: "Anonymous",
          rating,
          text,
          time: "",
        })
      }
    })
  }

  return reviews
}

/**
 * Extract business data from a single Google Maps business page.
 */
export async function searchSingleBusiness(
  html: string,
  pageUrl: string,
  options: { includeReviews?: boolean; maxReviews?: number } = {},
): Promise<ExtractResult> {
  const { includeReviews = false, maxReviews = 5 } = options

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

    // Extract reviews if requested
    const reviews = includeReviews ? extractReviews($, maxReviews) : undefined

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
      reviews,
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
  options: { includeReviews?: boolean; maxReviews?: number } = {},
): Promise<{ originalUrl: string; business: GoogleMapsBusiness | null }> {
  const { includeReviews = false, maxReviews = 5 } = options

  try {
    const { browser, page } = await setupPage(proxy)
    await page.goto(googleUrl, { waitUntil: "networkidle2" })

    // If we need reviews, click the Reviews tab and wait for content
    if (includeReviews) {
      await clickReviewsTabAndWait(page)
    }

    const html = await page.content()
    const result = await searchSingleBusiness(html, googleUrl, { includeReviews, maxReviews })
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
