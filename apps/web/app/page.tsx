"use client"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { Button } from "@/components/ui/primitives/Button"

function LoginPageContent() {
  const searchParams = useSearchParams()
  const domainParam = searchParams.get("domain")

  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState("")
  const [workspace, setWorkspace] = useState(domainParam || "")
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

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

      setAuthed(true)
    } catch {
      setError("Connection failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-80">
        <h1 className="text-6xl font-thin mb-16 text-white">•</h1>

        <form onSubmit={login} className="space-y-8" autoComplete="off">
          <input
            type="text"
            value={workspace}
            onChange={e => setWorkspace(e.target.value)}
            placeholder="domain (e.g. demo.goalive.nl)"
            disabled={loading}
            autoComplete="off"
            autoSave="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            className="w-full bg-transparent border-0 border-b border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white pb-3 text-lg font-thin"
          />

          <input
            type="password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            placeholder="passcode"
            disabled={loading}
            autoComplete="new-password"
            autoSave="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            className="w-full bg-transparent border-0 border-b border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white pb-3 text-lg font-thin"
          />

          {error && <p className="text-white/60 text-sm">{error}</p>}

          <Button
            type="submit"
            fullWidth
            loading={loading}
            disabled={!pass.trim() || !workspace.trim()}
            className="!bg-white !text-black hover:!bg-white/90 !border-0 !font-thin !text-lg !py-4"
          >
            enter
          </Button>
        </form>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-80">
            <h1 className="text-6xl font-thin mb-16 text-white">•</h1>
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
