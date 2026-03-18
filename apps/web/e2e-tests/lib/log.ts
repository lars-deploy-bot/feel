/**
 * Structured logging helpers for live E2E tests.
 *
 * Uses Playwright's built-in test.step() and annotations instead of console.log.
 * Results appear in Playwright's HTML report with proper nesting.
 */

import { test } from "@playwright/test"

/** Wrap a logical test phase in a named step (appears in Playwright report). */
export async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return test.step(name, fn)
}

/** Add a structured annotation to the current test (visible in report). */
export function annotate(type: string, description: string): void {
  test.info().annotations.push({ type, description })
}
