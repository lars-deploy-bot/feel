import { promises as fs } from "node:fs"

/**
 * Ensures a directory exists, creating it recursively if needed.
 * Handles EEXIST errors gracefully.
 *
 * @param dirPath - The directory path to ensure exists
 * @example
 * await ensureDirectory('/path/to/dir')
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    if (error instanceof Error && !error.message.includes("EEXIST")) {
      throw error
    }
    // Directory already exists, ignore
  }
}

/**
 * Reads and parses a JSON file. Returns null if file doesn't exist.
 * Throws if the file exists but contains invalid JSON.
 *
 * @param filePath - The JSON file path to read
 * @param defaultValue - Optional default value to return if file doesn't exist
 * @returns Parsed JSON data or default value/null if file doesn't exist
 * @example
 * const config = await readJsonFile<Config>('/path/to/config.json', {})
 */
export async function readJsonFile<T>(filePath: string, defaultValue?: T): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    return JSON.parse(content) as T
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      return defaultValue ?? null
    }
    throw error
  }
}

/**
 * Writes data to a JSON file with pretty printing.
 *
 * @param filePath - The file path to write to
 * @param data - The data to serialize as JSON
 * @param options - Options for JSON serialization
 * @example
 * await writeJsonFile('/path/to/config.json', { foo: 'bar' })
 * await writeJsonFile('/path/to/config.json', data, { spaces: 4 })
 */
export async function writeJsonFile<T>(filePath: string, data: T, options?: { spaces?: number }): Promise<void> {
  const spaces = options?.spaces ?? 2
  await fs.writeFile(filePath, JSON.stringify(data, null, spaces), "utf-8")
}
