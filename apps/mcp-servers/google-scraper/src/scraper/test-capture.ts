#!/usr/bin/env bun
/**
 * Test script to capture HTML from Google Maps pages for analysis.
 *
 * Usage:
 *   bun run src/scraper/test-capture.ts "beaches itacare brazil"
 *   bun run src/scraper/test-capture.ts --url "https://www.google.com/maps/place/..."
 *   bun run src/scraper/test-capture.ts --detail "beaches itacare brazil"  # Click first result
 */

import { setupPage, cleanupBrowser, navigateToGoogleMaps } from "./utils.js"
import { mkdir, writeFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, "../../test-html")

async function captureHtml(query: string, mode: "search" | "url" | "detail" = "search") {
  await mkdir(OUTPUT_DIR, { recursive: true })

  console.log("Setting up browser...")
  const { browser, page } = await setupPage()

  try {
    if (mode === "url") {
      console.log(`Navigating to URL: ${query}`)
      await page.goto(query, { waitUntil: "networkidle2", timeout: 30000 })
    } else {
      console.log(`Searching for: ${query}`)
      await navigateToGoogleMaps(page, query)
    }

    // Wait a bit for dynamic content
    await new Promise(r => setTimeout(r, 2000))

    // If detail mode, click first result to get to a single place page
    if (mode === "detail") {
      console.log("Looking for first result to click...")
      const firstResult = await page.$('a[href*="/maps/place/"]')
      if (firstResult) {
        console.log("Clicking first result...")
        await firstResult.click()
        await new Promise(r => setTimeout(r, 3000))
      }
    }

    // Check if we're on a single business page (has review section)
    const isSingleBusiness = (await page.$('div[role="main"][aria-label]')) !== null

    if (isSingleBusiness) {
      console.log("Detected: Single business page")

      // Try multiple selectors to find Reviews tab
      const reviewTabSelectors = [
        'button[aria-label*="Reviews"]',
        'button[aria-label*="reviews"]',
        'button[aria-label*="Avaliações"]', // Portuguese
        'button[data-tab-index="1"]',
      ]

      for (const selector of reviewTabSelectors) {
        const tab = await page.$(selector)
        if (tab) {
          console.log(`Clicking Reviews tab (${selector})...`)
          await tab.click()

          // Wait for network to settle after clicking
          await page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(() => {})

          // Wait for review content to appear
          console.log("Waiting for review elements...")
          await page.waitForSelector(".jftiEf, .wiI7pd", { timeout: 8000 }).catch(() => {
            console.log("No review elements found")
          })

          // Scroll to load more reviews
          console.log("Scrolling to load more...")
          for (let i = 0; i < 3; i++) {
            await page.evaluate(() => {
              const scrollable = document.querySelector("div.m6QErb.DxyBCb.kA9KIf.dS8AEf")
              scrollable?.scrollBy(0, 800)
            })
            await page.waitForNetworkIdle({ idleTime: 500, timeout: 3000 }).catch(() => {})
          }
          break
        }
      }
    } else {
      console.log("Detected: Multiple results feed")
    }

    const html = await page.content()
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const safeName = query.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")
    const filename = `${safeName}_${timestamp}.html`
    const filepath = join(OUTPUT_DIR, filename)

    await writeFile(filepath, html)
    console.log(`\nHTML saved to: ${filepath}`)
    console.log(`File size: ${(html.length / 1024).toFixed(1)} KB`)

    // Quick analysis for review-related classes
    console.log("\n--- Quick Analysis ---")
    console.log(`Contains 'review': ${html.includes("review")}`)
    console.log(`Contains 'Reviews': ${html.includes("Reviews")}`)
    console.log(`Contains 'jftiEf': ${html.includes("jftiEf")}`)
    console.log(`Contains 'wiI7pd': ${html.includes("wiI7pd")}`)
    console.log(`Contains 'rsqaWe': ${html.includes("rsqaWe")}`)
    console.log(`Contains 'd4r55': ${html.includes("d4r55")}`)
    console.log(`Contains 'MyEned': ${html.includes("MyEned")}`)

    return filepath
  } finally {
    await cleanupBrowser(browser)
  }
}

// Main
const args = process.argv.slice(2)

if (args.length === 0) {
  console.log("Usage:")
  console.log('  bun run src/scraper/test-capture.ts "beaches itacare brazil"')
  console.log('  bun run src/scraper/test-capture.ts --url "https://www.google.com/maps/place/..."')
  console.log('  bun run src/scraper/test-capture.ts --detail "beaches itacare brazil"')
  process.exit(1)
}

let mode: "search" | "url" | "detail" = "search"
let query: string

if (args[0] === "--url") {
  mode = "url"
  query = args[1]
} else if (args[0] === "--detail") {
  mode = "detail"
  query = args.slice(1).join(" ")
} else {
  query = args.join(" ")
}

if (!query) {
  console.error("Error: No query or URL provided")
  process.exit(1)
}

captureHtml(query, mode)
  .then(filepath => {
    console.log("\nDone! You can now analyze the HTML with:")
    console.log(`  grep -oE 'class="[^"]*"' ${filepath} | grep -i review | sort | uniq -c | sort -rn | head -20`)
    console.log(`  grep -oE 'aria-label="[^"]*"' ${filepath} | grep -i review | head -20`)
  })
  .catch(err => {
    console.error("Error:", err)
    process.exit(1)
  })
