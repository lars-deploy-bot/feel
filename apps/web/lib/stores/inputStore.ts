"use client"

import { create } from "zustand"

/**
 * Tiny store for the chat input text.
 *
 * WHY THIS EXISTS:
 * The input value was previously a `useState` inside ChatPageContent (the God
 * component). Every keystroke caused React to re-render the ENTIRE page tree —
 * sidebar, message list, workbench, all modals — costing 75-150 ms per keypress.
 *
 * By moving the value into a Zustand store:
 * - Only components that subscribe to `useInputValue()` re-render on keystrokes
 *   (ChatInput + InputArea — the components that actually display the text).
 * - The parent page reads/writes imperatively via the exported helpers for
 *   discrete events (submit, tab switch, archive, template insert) without
 *   subscribing to every keystroke.
 */

interface InputState {
  value: string
  actions: {
    set: (value: string) => void
    clear: () => void
    append: (text: string) => void
  }
}

const inputStore = create<InputState>(set => ({
  value: "",
  actions: {
    set: (value: string) => set({ value }),
    clear: () => set({ value: "" }),
    append: (text: string) => set(s => ({ value: s.value.trim() ? `${s.value} ${text}` : text })),
  },
}))

// ── React hooks (cause re-renders — use only inside the input component) ─────

/** Subscribe to the input value. Causes re-render on every keystroke. */
export const useInputValue = () => inputStore(s => s.value)

/** Stable actions object — never changes, safe to use anywhere. */
export const useInputActions = () => inputStore(s => s.actions)

// ── Imperative helpers (no re-renders — use in callbacks, hooks, event handlers) ─

/** Read the current input value without subscribing. */
export const getInputValue = () => inputStore.getState().value

/** Replace the input value. */
export const setInput = (value: string) => inputStore.getState().actions.set(value)

/** Clear the input. */
export const clearInput = () => inputStore.getState().actions.clear()

/** Append text to the input (space-separated). */
export const appendInput = (text: string) => inputStore.getState().actions.append(text)
