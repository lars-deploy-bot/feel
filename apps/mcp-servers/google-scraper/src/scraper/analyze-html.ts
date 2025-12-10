#!/usr/bin/env bun
/**
 * Analyze captured HTML to find review structure.
 */

import { readFile } from "node:fs/promises"
import * as cheerio from "cheerio"

const filepath = process.argv[2]
if (!filepath) {
  console.error("Usage: bun run src/scraper/analyze-html.ts <html-file>")
  process.exit(1)
}

const html = await readFile(filepath, "utf-8")
const $ = cheerio.load(html)

console.log("=== Review Analysis ===\n")

// Try different review container selectors
const selectors = [
  "div.jftiEf", // Common review container
  "div[data-review-id]", // Data attribute approach
  "div.WMbnJf", // Another potential container
  ".wiI7pd", // Review text
  ".d4r55", // Author name
  ".rsqaWe", // Timestamp
  ".kvMYJc", // Star rating container
  ".DU9Pgb", // Rating section
]

for (const selector of selectors) {
  const count = $(selector).length
  console.log(`${selector}: ${count} matches`)
}

console.log("\n=== Sample Content ===\n")

// Try to extract reviews using jftiEf container
const reviews = $("div.jftiEf")
console.log(`Found ${reviews.length} potential reviews via .jftiEf`)

reviews.slice(0, 3).each((i, el) => {
  const $review = $(el)
  console.log(`\n--- Review ${i + 1} ---`)

  // Author
  const author = $review.find(".d4r55").text().trim()
  console.log(`Author: ${author || "(not found)"}`)

  // Rating stars - try multiple approaches
  const ratingLabel = $review.find('[aria-label*="star"]').attr("aria-label")
  const ratingRole = $review.find('[role="img"][aria-label]').attr("aria-label")
  const starsContainer = $review.find(".kvMYJc")
  const _filledStars = starsContainer.find('img[src*="star"]').length
  console.log(`Rating label: ${ratingLabel || "(not found)"}`)
  console.log(`Rating role: ${ratingRole || "(not found)"}`)
  console.log(`Stars container HTML: ${starsContainer.html()?.slice(0, 200) || "(not found)"}`)

  // Timestamp
  const timestamp = $review.find(".rsqaWe").text().trim()
  console.log(`Time: ${timestamp || "(not found)"}`)

  // Review text
  const text = $review.find(".wiI7pd").text().trim()
  console.log(`Text: ${text.slice(0, 200) || "(not found)"}${text.length > 200 ? "..." : ""}`)
})

// Also try MyEned (another text container)
console.log("\n=== Alternative: .MyEned ===")
const texts = $(".MyEned")
console.log(`Found ${texts.length} .MyEned elements`)

texts.slice(0, 3).each((i, el) => {
  const text = $(el).text().trim()
  if (text) {
    console.log(`\n[${i + 1}] ${text.slice(0, 150)}${text.length > 150 ? "..." : ""}`)
  }
})

// Check for data-review-id
console.log("\n=== Looking for review IDs ===")
const withReviewId = $("[data-review-id]")
console.log(`Elements with data-review-id: ${withReviewId.length}`)

// Look at parent structure of wiI7pd
console.log("\n=== Parent structure of .wiI7pd ===")
const reviewTexts = $(".wiI7pd")
if (reviewTexts.length > 0) {
  const sample = reviewTexts.first()
  const parents = sample.parents().slice(0, 5)
  parents.each((i, el) => {
    const classes = $(el).attr("class") || "(no class)"
    console.log(`Parent ${i}: ${classes.split(" ").slice(0, 3).join(" ")}`)
  })
}
