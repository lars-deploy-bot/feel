"use client"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { Button } from "@/components/ui/primitives/Button"
import { WILDCARD_DOMAIN } from "@/lib/config"
import { normalizeDomain } from "@/lib/domain-utils"
import { getErrorHelp, getErrorMessage } from "@/lib/error-codes"
import { isTerminalMode } from "@/types/guards/workspace"

function WorkspacePageContent() {
  const searchParams = useSearchParams()
  const domainParam = searchParams.get("domain")

  const [workspace, setWorkspace] = useState(domainParam || "")
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean
    message: string
    error?: string
  } | null>(null)
  const [isTerminal, setIsTerminal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const terminalMode = isTerminalMode(window.location.hostname)
    setIsTerminal(terminalMode)

    // If not terminal mode, redirect to chat
    if (!terminalMode) {
      router.push("/chat")
    }
  }, [router])

  async function verifyWorkspace() {
    setVerifying(true)
    setVerifyResult(null)

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace }),
      })

      const result = await response.json()

      if (result.verified) {
        setVerified(true)
        setVerifyResult({
          verified: true,
          message: result.message || "Workspace verified successfully!",
        })
      } else {
        setVerified(false)

        // Use centralized error handling
        const userMessage = result.error
          ? getErrorMessage(result.error, { host: workspace })
          : result.message || "Workspace verification failed"

        const helpText = result.error ? getErrorHelp(result.error) : null

        setVerifyResult({
          verified: false,
          message: userMessage,
          error: helpText || result.details,
        })
      }
    } catch (error) {
      setVerified(false)
      setVerifyResult({
        verified: false,
        message: "Failed to verify workspace",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }

    setVerifying(false)
  }

  function continueToChat() {
    // Store workspace in sessionStorage for chat page
    sessionStorage.setItem("workspace", workspace)
    router.push("/chat")
  }

  if (!mounted || !isTerminal) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-80 text-center">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-black/60 text-sm font-thin">{!mounted ? "loading" : "redirecting"}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-96">
        <h1 className="text-6xl font-thin mb-16 text-black">◯</h1>

        <p className="text-black/60 text-sm mb-12 font-thin">workspace setup</p>

        <div className="space-y-8">
          <div>
            <p className="text-black/40 text-xs mb-4 font-thin">domain name</p>
            <div className="flex gap-3">
              <input
                id={`workspace-input-${Math.random().toString(36).substring(2, 15)}`}
                type="text"
                value={workspace}
                onChange={e => {
                  const normalized = normalizeDomain(e.target.value)
                  setWorkspace(normalized)
                  setVerified(false)
                  setVerifyResult(null)
                }}
                placeholder={`myapp.${WILDCARD_DOMAIN}`}
                className="flex-1 bg-transparent border-0 border-b border-black/20 text-black placeholder-black/40 focus:outline-none focus:border-black pb-3 text-sm font-thin font-mono"
              />
              <Button
                onClick={verified ? undefined : verifyWorkspace}
                disabled={verifying || !workspace.trim() || verified}
                loading={verifying}
                variant="ghost"
                className={`!w-auto !px-6 !py-2 !text-xs !font-thin ${
                  verified
                    ? "!text-green-700 !border-green-600 !border-2 hover:!text-black hover:!bg-transparent !cursor-default"
                    : ""
                }`}
              >
                {verifying ? "verifying" : verified ? "verified" : "verify"}
              </Button>
            </div>

            <div className="mt-6 min-h-[80px]">
              {verifyResult?.verified === false && (
                <>
                  <p className="text-sm font-thin text-black/60">failed</p>
                  {verifyResult.error && <p className="text-black/40 text-xs mt-1 font-thin">{verifyResult.error}</p>}
                </>
              )}

              {verifyResult?.verified && (
                <Button onClick={continueToChat} className="!mt-6 !font-thin !text-sm" fullWidth>
                  continue
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function WorkspacePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-80 text-center">
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-black/60 text-sm font-thin">loading</p>
          </div>
        </main>
      }
    >
      <WorkspacePageContent />
    </Suspense>
  )
}
