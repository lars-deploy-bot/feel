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
 *
 * Iframe src is managed imperatively (not via React props) to prevent:
 * - Double page loads from NAVIGATION postMessage feeding back into src (#297)
 * - Token rotation (every 4 min) triggering iframe reloads (#297)
 * - Refresh navigating to stale path (#297)
 */
export function usePreviewEngine({ workspace, skipTokenFetch, onNavigate }: UsePreviewEngineOptions) {
  const { setSelectedElement, selectorActive, deactivateSelector } = useWorkbenchContext()

  const iframeRef = useRef<HTMLIFrameElement>(null)
  // displayPath: what the URL bar shows, updated on every in-page navigation.
  // This is the source of truth for "what page is the iframe currently showing".
  const [displayPath, setDisplayPath] = useState("/")
  const [isLoading, setIsLoading] = useState(true)
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const tokenFetchRef = useRef<AbortController | null>(null)

  // Refs for imperative access without stale closures or re-renders.
  // These are read by setIframeRef, refresh(), and navigateTo() which
  // must always use the latest values without being recreated on every change.
  const previewTokenRef = useRef<string | null>(null)
  const displayPathRef = useRef("/")
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace
  displayPathRef.current = displayPath

  // Ref for onNavigate to avoid re-registering the message listener
  const onNavigateRef = useRef(onNavigate)
  onNavigateRef.current = onNavigate

  // Reset path state and navigate iframe when workspace changes.
  // Without this, the existing iframe DOM node keeps showing the old workspace URL.
  const isFirstMount = useRef(true)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    setDisplayPath("/")
    displayPathRef.current = "/"
    setIsLoading(true)
    if (iframeRef.current && workspace && previewTokenRef.current) {
      iframeRef.current.src = getPreviewUrl(workspace, {
        path: "/",
        token: previewTokenRef.current,
      })
    }
  }, [workspace])

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
        previewTokenRef.current = data.token
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

  // Refresh token every 4 minutes (tokens expire in 5 minutes).
  // Only updates the ref — does NOT trigger iframe reload.
  useEffect(() => {
    if (!workspace || skipTokenFetch) return
    const interval = setInterval(fetchPreviewToken, 4 * 60 * 1000)
    return () => clearInterval(interval)
  }, [workspace, skipTokenFetch, fetchPreviewToken])

  // --- Iframe ref ---

  // Callback ref: sets initial iframe src imperatively on mount.
  // Using refs (not state) avoids stale closures while keeping the callback stable.
  // Fires on mount (new element) and unmount (null) only, since identity is stable.
  const setIframeRef = useCallback((iframe: HTMLIFrameElement | null) => {
    iframeRef.current = iframe
    if (iframe && workspaceRef.current && previewTokenRef.current) {
      iframe.src = getPreviewUrl(workspaceRef.current, {
        path: displayPathRef.current,
        token: previewTokenRef.current,
      })
    }
  }, [])

  // --- Selector sync ---

  const previewOrigin = workspace ? new URL(getPreviewUrl(workspace, { path: "/" })).origin : "*"

  // Sync selector state after iframe loads
  useEffect(() => {
    if (!isLoading && selectorActive && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "alive-tagger-activate" }, previewOrigin)
    }
  }, [isLoading, selectorActive, previewOrigin])

  // Send activation/deactivation message when selectorActive changes
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: selectorActive ? "alive-tagger-activate" : "alive-tagger-deactivate" },
        previewOrigin,
      )
    }
  }, [selectorActive, previewOrigin])

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
    const expectedOrigin = workspace ? new URL(getPreviewUrl(workspace, { path: "/" })).origin : null

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (expectedOrigin && event.origin !== expectedOrigin) return

      // Navigation started - show loading with safety timeout
      if (event.data?.type === PREVIEW_MESSAGES.NAVIGATION_START) {
        setIsLoading(true)
        clearLoadingTimeout()
        loadingTimeoutRef.current = setTimeout(() => {
          setIsLoading(false)
        }, 8000)
        return
      }

      // Navigation completed - update URL bar display and clear loading.
      // This is the definitive "iframe content loaded" signal: the injected script
      // executed sendPath(), which means the page is rendered and running JS.
      // IMPORTANT: Only update displayPath here. Iframe src is NOT reactive —
      // it's set imperatively by setIframeRef/navigateTo/refresh only. (#297)
      if (event.data?.type === PREVIEW_MESSAGES.NAVIGATION && typeof event.data.path === "string") {
        clearLoadingTimeout()
        const newPath = event.data.path || "/"
        setDisplayPath(newPath)
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
  }, [workspace, setSelectedElement, clearLoadingTimeout])

  // --- Actions ---

  /** Reload the current page (displayPath) with a fresh token */
  const refresh = useCallback(() => {
    if (iframeRef.current && workspaceRef.current) {
      setIsLoading(true)
      iframeRef.current.src = getPreviewUrl(workspaceRef.current, {
        path: displayPathRef.current,
        token: previewTokenRef.current ?? undefined,
      })
    }
  }, [])

  /** Navigate the iframe to a new path (explicit user action: Enter key, programmatic) */
  const navigateTo = useCallback((newPath: string) => {
    setDisplayPath(newPath)
    if (iframeRef.current && workspaceRef.current) {
      setIsLoading(true)
      iframeRef.current.src = getPreviewUrl(workspaceRef.current, {
        path: newPath,
        token: previewTokenRef.current ?? undefined,
      })
    }
  }, [])

  return {
    setIframeRef,
    iframeRef,
    path: displayPath,
    isLoading,
    previewToken,
    refresh,
    navigateTo,
  }
}
