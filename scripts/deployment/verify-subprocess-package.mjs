#!/usr/bin/env node

import { pathToFileURL } from "node:url"

const [, , entryPathArg] = process.argv

if (!entryPathArg) {
  console.error("Usage: verify-subprocess-package.mjs <entry-path>")
  process.exit(1)
}

const entryUrl = pathToFileURL(entryPathArg).href

try {
  await import(entryUrl)
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  console.error(message)
  process.exit(1)
}

console.log("ok")
