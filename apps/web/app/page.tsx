"use client"
import { Clock, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { Button } from "@/components/ui/primitives/Button"
import { Input } from "@/components/ui/primitives/Input"
import { WILDCARD_DOMAIN } from "@/lib/config"
import { useRecentSitesStore } from "@/lib/stores/recentSitesStore"

function LoginPageContent() {
  const searchParams = useSearchParams()
  const domainParam = searchParams.get("domain")

  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState("")
  const [workspace, setWorkspace] = useState(domainParam || "")
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [workspaceTouched, setWorkspaceTouched] = useState(false)
  const [passTouched, setPassTouched] = useState(false)
  const router = useRouter()

  // Recent sites from Zustand store
  const { sites: recentSites, addSite, removeSite } = useRecentSitesStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // If already authenticated, redirect to chat
    if (authed && mounted) {
      // Always store workspace for domain-based access
      sessionStorage.setItem("workspace", workspace)
      router.push("/chat")
    }
  }, [authed, mounted, router, workspace])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // First validate the login credentials
      const loginResponse = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: pass, workspace: workspace }),
      })

      if (!loginResponse.ok) {
        setError("Invalid passcode")
        return
      }

      // Then verify the workspace exists
      const verifyResponse = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: workspace }),
      })

      const verifyResult = await verifyResponse.json()

      if (!verifyResult.verified) {
        setError(`Domain "${workspace}" not found or inaccessible`)
        return
      }

      // Save to recent sites
      addSite(workspace)

      setAuthed(true)
    } catch {
      setError("Connection failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light mb-3 text-black">Welcome back</h1>
          <p className="text-black/50 text-base font-light">Sign in to continue</p>
        </div>

        {/* Recent Sites */}
        {mounted && recentSites.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-black/40" />
              <p className="text-sm font-medium text-black/70">Recent sites</p>
            </div>
            <div className="space-y-2">
              {recentSites.map(site => (
                <div
                  key={site.domain}
                  className="w-full group relative flex items-center justify-between px-4 py-3 rounded-lg border border-black/10 hover:border-black/30 hover:bg-black/5 transition-all"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspace(site.domain)
                      setWorkspaceTouched(false)
                    }}
                    className="absolute inset-0 text-left"
                  >
                    <span className="sr-only">Select {site.domain}</span>
                  </button>
                  <span className="text-sm font-medium text-black relative z-10 pointer-events-none">
                    {site.domain}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSite(site.domain)}
                    className="relative z-10 opacity-0 group-hover:opacity-100 p-1 hover:bg-black/10 rounded transition-opacity"
                    aria-label={`Remove ${site.domain}`}
                  >
                    <X className="h-3 w-3 text-black/50" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={login} className="space-y-6" autoComplete="off">
          <Input
            id="workspace"
            label="Your site"
            type="text"
            value={workspace}
            onChange={e => {
              setWorkspace(e.target.value)
              if (error) setError("")
            }}
            onBlur={() => setWorkspaceTouched(true)}
            placeholder={`myapp.${WILDCARD_DOMAIN}`}
            disabled={loading}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            state={workspaceTouched && !workspace.trim() ? "error" : "default"}
            errorMessage={workspaceTouched && !workspace.trim() ? "Please enter your site domain" : undefined}
          />

          <Input
            id="passcode"
            label="Password"
            type="password"
            value={pass}
            onChange={e => {
              setPass(e.target.value)
              if (error) setError("")
            }}
            onBlur={() => setPassTouched(true)}
            placeholder="Enter your password"
            disabled={loading}
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            state={passTouched && !pass.trim() ? "error" : "default"}
            errorMessage={passTouched && !pass.trim() ? "Please enter your password" : undefined}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            loading={loading}
            disabled={!pass.trim() || !workspace.trim()}
            className="!bg-black !text-white hover:!bg-black/90 !border-0 !font-medium !text-base !py-3 !rounded-lg !transition-all"
          >
            {loading ? "Signing in..." : "Continue"}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-black/50 text-sm font-light">
            Don't have a site yet?{" "}
            <a href="/deploy" className="text-black font-medium hover:underline">
              Deploy one now
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="w-full max-w-md text-center">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-black/50 text-sm font-light">Loading...</p>
          </div>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
