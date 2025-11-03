import { type Browser, type BrowserContext, chromium, type Page } from "playwright"

/**
 * Browser Manager
 *
 * Manages a singleton Playwright browser instance for debugging tools.
 * Provides browser contexts for isolated page sessions.
 */
class BrowserManager {
  private browser: Browser | null = null
  private isLaunching = false

  /**
   * Get or create the browser instance
   */
  async getBrowser(): Promise<Browser> {
    // If browser exists and is connected, return it
    if (this.browser?.isConnected()) {
      return this.browser
    }

    // If already launching, wait for it
    if (this.isLaunching) {
      while (this.isLaunching) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (this.browser?.isConnected()) {
        return this.browser
      }
    }

    // Launch new browser
    this.isLaunching = true
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      })
      return this.browser
    } finally {
      this.isLaunching = false
    }
  }

  /**
   * Create a new browser context (isolated session)
   */
  async createContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser()
    return await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    })
  }

  /**
   * Create a new page in a context
   */
  async createPage(): Promise<Page> {
    const context = await this.createContext()
    return await context.newPage()
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser?.isConnected()) {
      await this.browser.close()
    }
    this.browser = null
  }

  /**
   * Get browser status
   */
  isConnected(): boolean {
    return this.browser?.isConnected() ?? false
  }
}

// Export singleton instance
export const browserManager = new BrowserManager()

// Export types
export type { Browser, BrowserContext, Page } from "playwright"
