import { useSyncExternalStore } from "react"

/**
 * Tiny reactive store — one shared state atom, no dependencies.
 * Usage:
 *   const countStore = createStore(0)
 *   function Counter() { const count = countStore.use(); ... }
 */
export function createStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()

  function getSnapshot() {
    return state
  }

  function subscribe(cb: () => void) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }

  function emit() {
    for (const cb of listeners) cb()
  }

  function set(value: T) {
    if (Object.is(state, value)) return
    state = value
    emit()
  }

  function update(fn: (prev: T) => T) {
    set(fn(state))
  }

  function use(): T {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  }

  return { get: getSnapshot, set, update, use, subscribe }
}
