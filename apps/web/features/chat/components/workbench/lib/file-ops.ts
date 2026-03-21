/**
 * High-level file operations that orchestrate API calls, cache invalidation, and change notifications.
 * Eliminates ad-hoc coordination between components.
 * All functions throw on failure (fail fast).
 */

import { deleteFile, uploadFile, writeFile } from "./file-api"
import { invalidateContent, invalidateList, optimisticRemoveFromList } from "./file-cache"
import { notifyFileChange } from "./file-events"
import { getFileName, getParentPath } from "./file-path"

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

/** Delete a file or directory. Optimistically removes from tree, then confirms via API. */
export async function removeFile(
  workspace: string,
  path: string,
  options?: { worktree?: string | null; recursive?: boolean },
): Promise<void> {
  const parentPath = getParentPath(path)
  const fileName = getFileName(path)

  // Optimistic: remove from cached listing immediately so the tree updates instantly
  optimisticRemoveFromList(workspace, options?.worktree, parentPath, fileName)
  invalidateContent(workspace, options?.worktree, path)
  notifyFileChange()

  try {
    await deleteFile(workspace, path, options)
  } catch (err) {
    // Delete failed — invalidate the parent listing so the tree re-fetches the real state
    invalidateList(workspace, options?.worktree, parentPath)
    notifyFileChange()
    throw err
  }
}

/** Upload a file, invalidate caches, and notify subscribers. Throws on failure. */
export async function uploadFileToWorkspace(
  workspace: string,
  file: File,
  worktree?: string | null,
): Promise<{ path: string; originalName: string }> {
  const result = await uploadFile(workspace, file, worktree)
  // Invalidate the parent directory from the returned path (e.g. ".uploads")
  invalidateList(workspace, worktree, getParentPath(result.path))
  // Also invalidate root since the uploads dir may be newly created
  invalidateList(workspace, worktree, "")
  notifyFileChange()
  return result
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
