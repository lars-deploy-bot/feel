"use client"
import { useRouter } from "next/navigation"
import { Suspense, useState } from "react"
import { Button } from "@/components/ui/primitives/Button"
import { Input } from "@/components/ui/primitives/Input"

function LoginPageContent() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const router = useRouter()

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const loginResponse = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      })

      const data = await loginResponse.json()

      if (!loginResponse.ok || !data.ok) {
        setError("Invalid email or password")
        setLoading(false)
        return
      }

      // Redirect to chat
      router.push("/chat")
    } catch {
      setError("Connection failed")
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-normal mb-3 text-black">Welcome back</h1>
          <p className="text-black/50 text-base font-normal">Sign in to continue</p>
        </div>

        <form onSubmit={login} className="space-y-6" autoComplete="off">
          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              if (error) setError("")
            }}
            onBlur={() => setEmailTouched(true)}
            placeholder="you@example.com"
            disabled={loading}
            autoComplete="email"
            state={emailTouched && !email.trim() ? "error" : "default"}
            errorMessage={emailTouched && !email.trim() ? "Please enter your email" : undefined}
            data-testid="email-input"
          />

          <Input
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={e => {
              setPassword(e.target.value)
              if (error) setError("")
            }}
            onBlur={() => setPasswordTouched(true)}
            placeholder="Enter your password"
            disabled={loading}
            autoComplete="current-password"
            state={passwordTouched && !password.trim() ? "error" : "default"}
            errorMessage={passwordTouched && !password.trim() ? "Please enter your password" : undefined}
            data-testid="password-input"
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
            disabled={!email.trim() || !password.trim()}
            className="!bg-black !text-white hover:!bg-black/90 !border-0 !font-medium !text-base !py-3 !rounded-lg !transition-all"
            data-testid="login-button"
          >
            {loading ? "Signing in..." : "Continue"}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-black/50 text-sm font-normal">
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
            <p className="text-black/50 text-sm font-normal">Loading...</p>
          </div>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
