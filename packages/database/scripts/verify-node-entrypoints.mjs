const entrypoints = [
  "../dist/index.js",
  "../dist/deploy-enums.js",
  "../dist/drizzle-client.js",
  "../dist/schema/index.js",
]

for (const entrypoint of entrypoints) {
  try {
    await import(new URL(entrypoint, import.meta.url).href)
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error)
    console.error(`[database:verify-node-entrypoints] Failed to import ${entrypoint}\n${message}`)
    process.exit(1)
  }
}

console.log("[database:verify-node-entrypoints] OK")
