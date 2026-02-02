"use client"

/**
 * Chat Layout with Modal Slot
 *
 * Uses Next.js parallel routes (@modal) to render settings as an overlay
 * while keeping the chat page mounted underneath.
 *
 * When navigating to /settings from /chat:
 * - The intercepting route (.)settings captures the navigation
 * - Settings renders in the @modal slot
 * - Chat remains visible as the background
 */
export default function ChatLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
