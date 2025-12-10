#!/usr/bin/env bun
/**
 * Test review extraction and explore stable selectors.
 *
 * Usage:
 *   bun run src/scraper/test-reviews.ts [html-file]
 *   bun run src/scraper/test-reviews.ts --explore [html-file]
 */

import { readFile } from "node:fs/promises"
import * as cheerio from "cheerio"
import { searchSingleBusiness } from "./extractors/detail.js"

const args = process.argv.slice(2)
const exploreMode = args[0] === "--explore"
const filepath = (exploreMode ? args[1] : args[0]) || "test-html/prainha_itacare_brazil_2025-12-10T14-09-45-643Z.html"

const html = await readFile(filepath, "utf-8")

if (exploreMode) {
  // Explore stable selectors that don't rely on minified class names
  const $ = cheerio.load(html)

  console.log("=== Exploring stable selectors ===\n")

  // 1. data-review-id is a stable attribute
  console.log("1. Elements with data-review-id:")
  const reviewIds = $("[data-review-id]")
  console.log(`   Found: ${reviewIds.length} elements`)
  reviewIds.slice(0, 2).each((_i, el) => {
    const id = $(el).attr("data-review-id")
    console.log(`   Sample ID: ${id}`)
  })

  // 2. aria-label patterns (stable for accessibility)
  console.log("\n2. Star rating via aria-label:")
  const starLabels = $('[role="img"][aria-label]')
  console.log(`   Found: ${starLabels.length} elements`)
  starLabels.slice(0, 3).each((_i, el) => {
    console.log(`   Label: ${$(el).attr("aria-label")}`)
  })

  // 3. Semantic structure - look for review containers by structure
  console.log("\n3. Potential review containers (by structure):")
  // Reviews typically have: avatar, name, rating, time, text
  // Look for divs that contain both a link to contributor and rating
  const containers = $("div").filter((_, el) => {
    const $el = $(el)
    const hasContributorLink = $el.find('a[href*="/contrib/"]').length > 0
    const hasRating = $el.find('[role="img"][aria-label*="star"], [role="img"][aria-label*="Stern"]').length > 0
    return hasContributorLink && hasRating
  })
  console.log(`   Found: ${containers.length} potential review containers`)

  // 4. jsaction attributes (Google-specific but stable)
  console.log("\n4. jsaction attributes in review area:")
  const jsactions = new Set<string>()
  $("[jsaction]").each((_, el) => {
    const action = $(el).attr("jsaction") || ""
    if (action.includes("review") || action.includes("Review")) {
      jsactions.add(action.slice(0, 80))
    }
  })
  console.log(`   Review-related jsactions: ${jsactions.size}`)
  for (const action of [...jsactions].slice(0, 3)) {
    console.log(`   - ${action}`)
  }

  // 5. data-* attributes that seem stable
  console.log("\n5. Stable data-* attributes:")
  const dataAttrs = new Map<string, number>()
  $("[data-review-id], [data-hveid], [data-index]").each((_, el) => {
    for (const attr of Object.keys(el.attribs || {})) {
      if (attr.startsWith("data-")) {
        dataAttrs.set(attr, (dataAttrs.get(attr) || 0) + 1)
      }
    }
  })
  for (const [attr, count] of dataAttrs) {
    console.log(`   ${attr}: ${count} occurrences`)
  }

  // 6. Check contributor links structure
  console.log("\n6. Contributor link structure:")
  const contribLinks = $('a[href*="/contrib/"]')
  console.log(`   Found: ${contribLinks.length} contributor links`)
  contribLinks.slice(0, 2).each((_i, el) => {
    const href = $(el).attr("href")
    const text = $(el).text().trim()
    console.log(`   - "${text}" -> ${href?.slice(0, 60)}...`)
  })
} else {
  // Normal test mode
  console.log("Testing review extraction...")
  console.log("File:", filepath)
  console.log("")

  const result = await searchSingleBusiness(html, "https://example.com", { includeReviews: true, maxReviews: 5 })

  if (!result.success) {
    console.error("Error:", result.error)
    process.exit(1)
  }

  const biz = result.data.businesses[0]

  console.log("Business:", biz.storeName)
  console.log("Reviews found:", biz.reviews?.length ?? 0)
  console.log("")

  if (biz.reviews) {
    for (const review of biz.reviews) {
      console.log(`--- ${review.author} (${review.rating}★) - ${review.time} ---`)
      console.log(review.text.slice(0, 150) + (review.text.length > 150 ? "..." : ""))
      console.log("")
    }
  }
}
