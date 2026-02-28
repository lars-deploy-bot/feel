import { useSyncExternalStore } from "react"

let version = 0
const listeners = new Set<() => void>()

/** Notify all subscribers that file(s) changed. */
export function notifyFileChange(): void {
  version++
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): number {
  return version
}

/**
 * React hook that returns a monotonically increasing version number.
 * Re-renders the component whenever `notifyFileChange()` is called.
 */
export function useFileChangeVersion(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
