"use client"

import { motion } from "framer-motion"
import { ArrowLeft, Github, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import {
  buildGithubSlugAttempt,
  deriveGithubImportSlug,
  isSupportedGithubRepoInput,
} from "@/features/deployment/lib/github-import-client"
import { trackGithubImportFailed, trackGithubImportOpened, trackGithubImportStarted } from "@/lib/analytics/events"
import { ErrorCodes } from "@/lib/error-codes"
import { useAuthModalActions } from "@/lib/stores/authModalStore"

const MAX_IMPORT_ATTEMPTS = 3

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

interface ImportRepoResponse {
  ok?: boolean
  domain?: string
  message?: string
  error?: string
  chatUrl?: string
}

async function parseImportResponse(response: Response): Promise<ImportRepoResponse> {
  try {
    const json: unknown = await response.json()
    if (!json || typeof json !== "object") return {}
    const data = json as Record<string, unknown>
    return {
      ok: typeof data.ok === "boolean" ? data.ok : undefined,
      domain: typeof data.domain === "string" ? data.domain : undefined,
      message: typeof data.message === "string" ? data.message : undefined,
      error: typeof data.error === "string" ? data.error : undefined,
      chatUrl: typeof data.chatUrl === "string" ? data.chatUrl : undefined,
    }
  } catch {
    return {}
  }
}

export default function DeployGithubPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading, refetch: refetchAuth } = useAuth()
  const { open: openAuthModal } = useAuthModalActions()

  const [repoUrl, setRepoUrl] = useState("https://github.com/")
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    trackGithubImportOpened()
  }, [])

  const trimmedRepoUrl = repoUrl.trim()
  const isValidRepoInput = isSupportedGithubRepoInput(trimmedRepoUrl)
  const slugPreview = useMemo(() => deriveGithubImportSlug(trimmedRepoUrl), [trimmedRepoUrl])

  // Don't show validation error for the default pre-fill
  const showValidationHint = trimmedRepoUrl !== "" && trimmedRepoUrl !== "https://github.com/" && !isValidRepoInput
  const submitDisabled = !trimmedRepoUrl || !isValidRepoInput || isImporting || authLoading

  const performImport = async () => {
    if (!trimmedRepoUrl || !isValidRepoInput) return

    setError(null)
    setIsImporting(true)
    trackGithubImportStarted(slugPreview)

    const baseSlug = slugPreview

    try {
      for (let attempt = 1; attempt <= MAX_IMPORT_ATTEMPTS; attempt += 1) {
        const slug = buildGithubSlugAttempt(baseSlug, attempt)
        const response = await fetch("/api/import-repo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            slug,
            repoUrl: trimmedRepoUrl,
          }),
        })

        const data = await parseImportResponse(response)

        if (response.ok && data.ok && data.domain) {
          router.push(data.chatUrl || `/chat?wk=${encodeURIComponent(data.domain)}`)
          return
        }

        if (data.error === ErrorCodes.SLUG_TAKEN && attempt < MAX_IMPORT_ATTEMPTS) {
          continue
        }

        const errMsg = data.message || "Failed to import repository. Please try again."
        trackGithubImportFailed(data.error || "unknown_error")
        setError(errMsg)
        return
      }

      trackGithubImportFailed("slug_allocation_failed")
      setError("Could not allocate a unique workspace name. Please retry.")
    } catch {
      trackGithubImportFailed("network_error")
      setError("Network error while importing. Please check your connection and try again.")
    } finally {
      setIsImporting(false)
    }
  }

  // Auto-import after auth completes if form is ready
  const [pendingImport, setPendingImport] = useState(false)
  useEffect(() => {
    if (pendingImport && isAuthenticated && !authLoading && !isImporting) {
      setPendingImport(false)
      performImport()
    }
  }, [pendingImport, isAuthenticated, authLoading, isImporting])

  const handleSubmitWithAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!trimmedRepoUrl || trimmedRepoUrl === "https://github.com/") {
      setError("Paste a GitHub repository URL to import.")
      return
    }

    if (!isValidRepoInput) {
      setError('Enter a GitHub URL like "https://github.com/owner/repo" or shorthand "owner/repo".')
      return
    }

    if (authLoading) {
      return
    }

    if (!isAuthenticated) {
      setPendingImport(true)
      openAuthModal({
        title: "Sign in to import",
        description: "Create an account or sign in to import from GitHub",
        onSuccess: () => refetchAuth(),
        onClose: () => setPendingImport(false),
      })
      return
    }

    await performImport()
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 py-16 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center">
        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="w-full max-w-md mx-auto">
          <motion.div variants={itemVariants} className="mb-8">
            <button
              type="button"
              onClick={() => router.push("/deploy")}
              disabled={isImporting}
              className="text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 text-xs font-medium inline-flex items-center gap-1 transition-colors uppercase tracking-wide disabled:opacity-50"
            >
              <ArrowLeft size={12} />
              Back to options
            </button>
          </motion.div>

          <motion.div variants={itemVariants} className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-black/5 dark:bg-white/5 mb-4">
              <Github size={24} className="text-black/70 dark:text-white/70" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white mb-2">Import from GitHub</h1>
            <p className="text-black/50 dark:text-white/50">Paste a repo URL and we'll set up a workspace from it.</p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-black/10 dark:border-white/10 shadow-sm overflow-hidden"
          >
            <form onSubmit={handleSubmitWithAuth} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="github-repo-url" className="text-sm font-medium text-black/80 dark:text-white/80">
                  Repository URL
                </label>
                <input
                  id="github-repo-url"
                  type="text"
                  value={repoUrl}
                  onChange={event => setRepoUrl(event.target.value)}
                  placeholder="https://github.com/owner/repo"
                  disabled={isImporting}
                  className="w-full h-11 px-3 rounded-lg border border-black/15 dark:border-white/15 bg-transparent text-sm text-black dark:text-white placeholder:text-black/35 dark:placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-black/15 dark:focus:ring-white/20 disabled:opacity-60"
                />
                {showValidationHint && (
                  <p className="text-xs text-red-600 dark:text-red-400">Enter a GitHub URL or owner/repo shorthand.</p>
                )}
                {trimmedRepoUrl && isValidRepoInput && (
                  <p className="text-xs text-black/50 dark:text-white/50">
                    Workspace: <span className="font-mono">{slugPreview}</span>
                  </p>
                )}
              </div>

              <p className="text-xs text-black/40 dark:text-white/40">
                The default branch will be detected automatically. Private repos require a connected GitHub account
                (Settings &gt; Integrations).
              </p>

              {error && (
                <div className="rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 px-3 py-2">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitDisabled}
                  className="w-full h-12 rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Importing...
                    </>
                  ) : isAuthenticated ? (
                    "Import and Launch"
                  ) : (
                    "Continue"
                  )}
                </button>
              </div>

              {isAuthenticated && user?.email && (
                <p className="text-xs text-center text-black/40 dark:text-white/40">Signed in as {user.email}</p>
              )}
            </form>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
