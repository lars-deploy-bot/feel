/**
 * Google Maps Search - Core Logic
 *
 * Searches Google Maps for business information using Puppeteer.
 * Supports both single business pages and multi-result feeds.
 */

import type { GoogleMapsBusiness, GoogleMapsOptions, GoogleMapsResult, SearchInput } from "./types.js"
import {
  cleanupBrowser,
  detectFeed,
  navigateToGoogleMaps,
  normalizeHostname,
  sanitizeJSON,
  setupPage,
} from "./utils.js"
import { searchSingleBusiness } from "./extractors/detail.js"
import { handleMultipleFeed } from "./extractors/multiple.js"

export type SearchResult = { success: true; data: GoogleMapsResult } | { success: false; error: string }

/**
 * Search Google Maps for business information.
 *
 * @param input - Search configuration (query, mode, result count)
 * @param options - Additional options (logging, website filter, concurrency)
 * @returns Search result with businesses and HTML
 */
export async function searchGoogleMaps(input: SearchInput, options: GoogleMapsOptions = {}): Promise<SearchResult> {
  const { onlyIncludeWithWebsite, concurrency = 3, includeReviews = false, maxReviews = 5 } = options

  const { browser, page } = await setupPage()

  try {
    if (input.mode === "url") {
      await page.goto(input.url, { waitUntil: "networkidle2" })
    } else {
      await navigateToGoogleMaps(page, input.query)
    }
  } catch (err) {
    await cleanupBrowser(browser)
    return {
      success: false,
      error: `Navigation failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const isFeed = input.mode !== "url" && (await detectFeed(page))

  if (isFeed) {
    return await handleMultipleFeed({
      page,
      browser,
      input,
      onlyIncludeWithWebsite,
      concurrency,
      includeReviews,
      maxReviews,
    })
  }

  // Single business page - if we need reviews, click the tab first
  if (includeReviews) {
    const reviewTabSelectors = [
      'button[aria-label*="Reviews"]',
      'button[aria-label*="reviews"]',
      'button[aria-label*="Avaliações"]',
      'button[data-tab-index="1"]',
    ]

    for (const selector of reviewTabSelectors) {
      const tab = await page.$(selector)
      if (tab) {
        await tab.click()
        await page.waitForNetworkIdle({ idleTime: 1000, timeout: 8000 }).catch(() => {})
        await page.evaluate(() => {
          const scrollable = document.querySelector("div.m6QErb.DxyBCb.kA9KIf.dS8AEf")
          scrollable?.scrollBy(0, 500)
        })
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 3000 }).catch(() => {})
        break
      }
    }
  }

  const html = await page.content()
  const singleRes = await searchSingleBusiness(html, page.url(), { includeReviews, maxReviews })
  await cleanupBrowser(browser)

  if (!singleRes.success) {
    return singleRes
  }

  let bizArr: GoogleMapsBusiness[] =
    singleRes.data.businesses.length > 0
      ? [sanitizeJSON<GoogleMapsBusiness>(singleRes.data.businesses[0] as Record<string, unknown>)]
      : []

  if (onlyIncludeWithWebsite) {
    bizArr = bizArr.filter(
      b => b.bizWebsite && normalizeHostname(b.bizWebsite) === normalizeHostname(onlyIncludeWithWebsite),
    )
  }

  return {
    success: true,
    data: {
      businesses: bizArr,
      html,
    },
  }
}
