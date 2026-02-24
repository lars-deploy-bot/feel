"use client"

import { PREVIEW_MESSAGES } from "@webalive/shared"
import { useCallback, useEffect, useRef, useState } from "react"
import { useWorkbenchContext } from "@/features/chat/lib/workbench-context"
import { getPreviewUrl } from "@/lib/preview-utils"

interface UsePreviewEngineOptions {
  workspace: string | null
  /** Skip token fetching (e.g. for superadmin workspace with no site to preview) */
  skipTokenFetch?: boolean
  /** Called when iframe navigates to a new path (memoize with useCallback) */
  onNavigate?: (path: string) => void
}

/**
 * Shared preview iframe engine used by both desktop and mobile workbench.
 *
 * Handles: token management, iframe loading state via postMessage,
 * path tracking, element selection (alive-tagger), and selector sync.
 */
export function usePreviewEngine({ workspace, skipTokenFetch, onNavigate }: UsePreviewEngineOptions) {
  const { setSelectedElement, selectorActive, deactivateSelector } = useWorkbenchContext()

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [path, setPath] = useState("/")
  const [isLoading, setIsLoading] = useState(true)
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const tokenFetchRef = useRef<AbortController | null>(null)

  // Ref for onNavigate to avoid re-registering the message listener
  const onNavigateRef = useRef(onNavigate)
  onNavigateRef.current = onNavigate

  // Preview URL with token for iframe (bypasses third-party cookie blocking)
  const previewUrl = workspace ? getPreviewUrl(workspace, { path, token: previewToken ?? undefined }) : ""

  // --- Token management ---

  const fetchPreviewToken = useCallback(async () => {
    tokenFetchRef.current?.abort()
    tokenFetchRef.current = new AbortController()
    try {
      const response = await fetch("/api/auth/preview-token", {
        method: "POST",
        signal: tokenFetchRef.current.signal,
      })
      if (response.ok) {
        const data = await response.json()
        setPreviewToken(data.token)
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("[PreviewEngine] Failed to fetch preview token:", error)
      }
    }
  }, [])

  useEffect(() => {
    if (workspace && !skipTokenFetch) {
      fetchPreviewToken()
    }
    return () => tokenFetchRef.current?.abort()
  }, [workspace, skipTokenFetch, fetchPreviewToken])

  // Refresh token every 4 minutes (tokens expire in 5 minutes)
  useEffect(() => {
    if (!workspace || skipTokenFetch) return
    const interval = setInterval(fetchPreviewToken, 4 * 60 * 1000)
    return () => clearInterval(interval)
  }, [workspace, skipTokenFetch, fetchPreviewToken])

  // --- Iframe ref ---

  // Callback ref (load event is unreliable for cross-origin iframes)
  const setIframeRef = useCallback((iframe: HTMLIFrameElement | null) => {
    iframeRef.current = iframe
  }, [])

  // --- Selector sync ---

  // Sync selector state after iframe loads
  useEffect(() => {
    if (!isLoading && selectorActive && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "alive-tagger-activate" }, "*")
    }
  }, [isLoading, selectorActive])

  // Send activation/deactivation message when selectorActive changes
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: selectorActive ? "alive-tagger-activate" : "alive-tagger-deactivate" },
        "*",
      )
    }
  }, [selectorActive])

  // Reset selector state on unmount
  useEffect(() => {
    return () => {
      deactivateSelector()
    }
  }, [deactivateSelector])

  // --- Loading timeout ---

  // Safety timeout: if NAVIGATION doesn't arrive within 8s of NAVIGATION_START, clear loading.
  // Prevents permanent spinner from hash navigations, network errors, external links, etc.
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
      loadingTimeoutRef.current = null
    }
  }, [])

  // --- PostMessage listener ---

  // NOTE: Loading state is managed entirely via postMessage from the injected nav script:
  // - NAVIGATION_START sets isLoading=true (SPA navigation began)
  // - NAVIGATION sets isLoading=false (page loaded and script executed)
  // The iframe 'load' event is unreliable for cross-origin iframes in React 19.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return

      // Navigation started - show loading with safety timeout
      if (event.data?.type === PREVIEW_MESSAGES.NAVIGATION_START) {
        setIsLoading(true)
        clearLoadingTimeout()
        loadingTimeoutRef.current = setTimeout(() => {
          setIsLoading(false)
        }, 8000)
        return
      }

      // Navigation completed - update path and clear loading
      // This is the definitive "iframe content loaded" signal: the injected script
      // executed sendPath(), which means the page is rendered and running JS.
      if (event.data?.type === PREVIEW_MESSAGES.NAVIGATION && typeof event.data.path === "string") {
        clearLoadingTimeout()
        const newPath = event.data.path || "/"
        setPath(newPath)
        setIsLoading(false)
        onNavigateRef.current?.(newPath)
        return
      }

      // Element selected via alive-tagger (Cmd+Click in dev mode)
      if (event.data?.type === "alive-element-selected" && event.data.context) {
        const ctx = event.data.context
        setSelectedElement({
          displayName: ctx.displayName,
          fileName: ctx.fileName,
          lineNumber: ctx.lineNumber,
          columnNumber: ctx.columnNumber,
        })
      }
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
      clearLoadingTimeout()
    }
  }, [setSelectedElement, clearLoadingTimeout])

  // --- Actions ---

  const refresh = useCallback(() => {
    if (iframeRef.current) {
      setIsLoading(true)
      iframeRef.current.src = previewUrl
    }
  }, [previewUrl])

  /** Navigate the iframe to a new path */
  const navigateTo = useCallback(
    (newPath: string) => {
      setPath(newPath)
      if (iframeRef.current && workspace) {
        setIsLoading(true)
        iframeRef.current.src = getPreviewUrl(workspace, { path: newPath, token: previewToken ?? undefined })
      }
    },
    [workspace, previewToken],
  )

  return {
    setIframeRef,
    iframeRef,
    path,
    isLoading,
    previewToken,
    previewUrl,
    refresh,
    navigateTo,
  }
}
