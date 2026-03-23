"use client"

import { Eye, EyeOff } from "lucide-react"
import type { Metadata } from "next"
import { useRouter } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { GlowCard } from "@/components/login/GlowCard"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import {
  identifyUser,
  trackLandingPageView,
  trackLoginFailed,
  trackLoginSubmitted,
  trackLoginSuccess,
  trackSignupStarted,
} from "@/lib/analytics/events"
import { useAuthModalActions } from "@/lib/stores/authModalStore"
import { authStore } from "@/lib/stores/authStore"

export const metadata: Metadata = {
  title: "Sign In - Alive Platform",
  description:
    "Sign in to your Alive account to start building websites with Claude AI assistance. AI-powered development platform for creating and deploying web projects.",
  openGraph: {
    title: "Sign In - Alive Platform",
    description: "Access your Alive workspace to build websites with AI assistance",
    type: "website",
  },
  robots: "index, follow",
}

function LoginPageContent() {
  useEffect(() => {
    trackLandingPageView()
  }, [])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const { open: openAuthModal } = useAuthModalActions()

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    trackLoginSubmitted()

    try {
      const loginResponse = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      })

      const data = await loginResponse.json()

      if (!loginResponse.ok || !data.ok) {
        trackLoginFailed("invalid_credentials")
        setError("Invalid email or password")
        setLoading(false)
        return
      }

      authStore.setAuthenticated()
      trackLoginSuccess()
      identifyUser(data.userId ?? email, { email })
      router.push("/chat")
    } catch (error) {
      console.error("Login error:", error)
      setError("Connection failed")
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#05060f] flex items-center justify-center px-4 relative">
      <header className="sr-only">
        <h1>Alive - AI-Powered Website Development Platform</h1>
        <p>Sign in to your account and start building websites with Claude AI assistance</p>
      </header>

      <nav className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </nav>

      <div className="w-full max-w-sm">
        <GlowCard>
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div
              className="relative w-10 h-10"
              role="img"
              aria-label="Alive platform logo - gradient emerald and teal circle"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-400/20 alive-logo-outer" />
              <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-400/30 alive-logo-inner" />
              <div className="absolute inset-2.5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Sign in to Alive</h2>
          <p className="text-center text-sm text-gray-600 dark:text-white/50 mb-6">
            Access your workspace and build with AI assistance
          </p>

          {/* Sign In Form */}
          <form onSubmit={login} className="space-y-4" noValidate>
            <fieldset>
              <legend className="sr-only">Sign in to your Alive account</legend>

              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-[13px] font-medium text-gray-600 dark:text-white/60 mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    if (error) setError("")
                  }}
                  placeholder="you@example.com"
                  disabled={loading}
                  autoComplete="email"
                  required
                  aria-required="true"
                  aria-describedby={error ? "form-error" : undefined}
                  className="login-input"
                  data-testid="email-input"
                />
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-[13px] font-medium text-gray-600 dark:text-white/60 mb-1.5"
                >
                  Password
                </label>
                <div className="login-input-password-wrapper">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      if (error) setError("")
                    }}
                    placeholder="Enter your password"
                    disabled={loading}
                    autoComplete="current-password"
                    required
                    aria-required="true"
                    aria-describedby={error ? "form-error" : undefined}
                    className="login-input"
                    data-testid="password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-input-password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    aria-controls="password"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </fieldset>

            {/* Error Message */}
            {error && (
              <div id="form-error" className="bg-red-500/10 rounded-lg px-3.5 py-2.5" role="alert" aria-live="polite">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="login-btn-primary"
              data-testid="login-button"
              aria-busy={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Sign Up CTA */}
          <section className="text-center text-sm text-gray-500 dark:text-white/40 mt-6">
            <p>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  trackSignupStarted()
                  openAuthModal({
                    title: "Create your account",
                    description: "Enter your email to get started",
                    onSuccess: () => router.push("/chat"),
                  })
                }}
                className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded px-1"
                data-testid="create-account-button"
              >
                Sign up here
              </button>
            </p>
          </section>
        </GlowCard>
      </div>
    </main>
  )
}

function LoadingFallback() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#05060f] flex items-center justify-center px-4 relative">
      <header className="sr-only">
        <h1>Alive - AI-Powered Website Development Platform</h1>
      </header>

      <nav className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </nav>
      <div className="w-full max-w-sm">
        <GlowCard>
          <div className="text-center">
            <div className="relative w-10 h-10 mx-auto mb-6" role="img" aria-label="Alive platform logo">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-400/20 alive-logo-outer" />
              <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-400/30 alive-logo-inner" />
              <div className="absolute inset-2.5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500" />
            </div>
            <p className="text-gray-600 dark:text-white/70 text-sm font-medium" aria-live="polite">
              Loading your workspace...
            </p>
          </div>
        </GlowCard>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginPageContent />
    </Suspense>
  )
}
