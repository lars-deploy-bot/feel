"use client"

/**
 * @deprecated This page is no longer part of the primary user flow.
 * Users now select organization and workspace directly in the chat interface.
 * This page redirects to /chat for backwards compatibility.
 */

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function WorkspaceSelectionPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to chat where org/workspace selection is now handled inline
    router.push("/chat")
  }, [router])

  return null
}
