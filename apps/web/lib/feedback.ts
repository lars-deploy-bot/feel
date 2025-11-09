import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { FeedbackEntry, FeedbackStore } from "@/types/feedback"

/**
 * Get feedback file path with fallback logic
 * Similar pattern to domain-passwords.json
 * @param customPath - Optional custom path for testing
 */
function getFeedbackFilePath(customPath?: string): string {
  // Return custom path if provided (for testing)
  if (customPath) {
    return customPath
  }
  // PRODUCTION: Use persistent location outside of git and build process
  const persistentPath = "/var/lib/claude-bridge/feedback.json"
  const persistentDir = dirname(persistentPath)

  // Check if persistent location exists or is writable
  if (existsSync(persistentPath)) {
    return persistentPath
  }

  // Check if persistent directory exists and is writable (production server)
  if (existsSync(persistentDir)) {
    try {
      // Try to access the directory to verify write permissions
      mkdirSync(persistentDir, { recursive: true })
      return persistentPath
    } catch {
      // Directory exists but not writable, fall through to dev paths
    }
  }

  // Fallback paths for development/testing
  const devPaths = [join(process.cwd(), "feedback.json"), "/root/webalive/claude-bridge/feedback.json"]

  for (const path of devPaths) {
    if (existsSync(path)) {
      console.log("Found feedback file at:", path)
      return path
    }
  }

  // Return first dev path for creation (cwd) in development
  console.log("Feedback file not found, using development path:", devPaths[0])
  return devPaths[0]
}

/**
 * Load feedback from JSON file
 * @param customPath - Optional custom path for testing
 */
export function loadFeedback(customPath?: string): FeedbackStore {
  try {
    const filePath = getFeedbackFilePath(customPath)
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf8")
      const parsed = JSON.parse(content) as unknown

      if (parsed && typeof parsed === "object" && "entries" in parsed && Array.isArray(parsed.entries)) {
        return parsed as FeedbackStore
      }

      console.warn("Invalid feedback file structure, resetting to empty store")
    }
  } catch (error) {
    console.warn("Failed to read feedback file:", error)
  }

  return { entries: [] }
}

/**
 * Save feedback to JSON file
 * @param store - Feedback store to save
 * @param customPath - Optional custom path for testing
 */
export function saveFeedback(store: FeedbackStore, customPath?: string): void {
  try {
    const filePath = getFeedbackFilePath(customPath)

    // Ensure directory exists
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(filePath, JSON.stringify(store, null, 2))
  } catch (error) {
    console.error("Failed to save feedback file:", error)
    throw error
  }
}

/**
 * Add a new feedback entry
 * @param entry - Feedback entry to add (without id and timestamp)
 * @param customPath - Optional custom path for testing
 */
export function addFeedbackEntry(entry: Omit<FeedbackEntry, "id" | "timestamp">, customPath?: string): FeedbackEntry {
  const store = loadFeedback(customPath)

  const newEntry: FeedbackEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }

  store.entries.push(newEntry)
  saveFeedback(store, customPath)

  return newEntry
}

/**
 * Get all feedback entries (for admin/manager view)
 * @param customPath - Optional custom path for testing
 */
export function getAllFeedback(customPath?: string): FeedbackEntry[] {
  const store = loadFeedback(customPath)
  return store.entries
}

/**
 * Get feedback entries for a specific workspace
 * @param workspace - Workspace to filter by
 * @param customPath - Optional custom path for testing
 */
export function getFeedbackByWorkspace(workspace: string, customPath?: string): FeedbackEntry[] {
  const store = loadFeedback(customPath)
  return store.entries.filter(entry => entry.workspace === workspace)
}
