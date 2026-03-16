/**
 * High-level file operations that orchestrate API calls, cache invalidation, and change notifications.
 * Eliminates ad-hoc coordination between components.
 * All functions throw on failure (fail fast).
 */

import { writeFile } from "./file-api"
import { invalidateContent, invalidateList } from "./file-cache"
import { notifyFileChange } from "./file-events"
import { getParentPath } from "./file-path"

interface FSEvent {
  op: "modify" | "create" | "remove" | "rename"
  path: string
  isDir: boolean
}

/** Write a file, invalidate all relevant caches, and notify subscribers. Throws on failure. */
export async function saveFile(
  workspace: string,
  path: string,
  content: string,
  worktree?: string | null,
): Promise<void> {
  await writeFile(workspace, path, content, worktree)
  invalidateContent(workspace, worktree, path)
  invalidateList(workspace, worktree, getParentPath(path))
  notifyFileChange()
}

/** Handle filesystem events from the file watcher. Invalidates appropriate caches and notifies. */
export function handleFSEvents(events: FSEvent[], workspace: string, worktree: string | null | undefined): void {
  let hasChanges = false

  for (const ev of events) {
    switch (ev.op) {
      case "modify":
        if (!ev.isDir) {
          invalidateContent(workspace, worktree, ev.path)
          hasChanges = true
        }
        break

      case "create":
      case "remove":
      case "rename":
        invalidateList(workspace, worktree, getParentPath(ev.path))
        invalidateContent(workspace, worktree, ev.path)
        hasChanges = true
        break
    }
  }

  if (hasChanges) {
    notifyFileChange()
  }
}
