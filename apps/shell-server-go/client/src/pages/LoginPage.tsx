import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

export function LoginPage() {
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const errorType = searchParams.get("error")
  const wait = searchParams.get("wait")
  const remaining = searchParams.get("remaining")

  let errorMessage = ""
  if (errorType === "rate_limit") {
    errorMessage = `Too many failed attempts. Please wait ${wait || "15"} minutes.`
  } else if (errorType === "invalid") {
    errorMessage = remaining ? `Invalid password (${remaining} attempts remaining)` : "Invalid password"
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    const form = new FormData()
    form.append("password", password)

    const res = await fetch("/login", {
      method: "POST",
      body: form,
      redirect: "manual",
    })

    // Check for redirect (success or error)
    if (res.type === "opaqueredirect" || res.status === 303) {
      // Re-check auth by fetching config
      const configRes = await fetch("/api/config")
      if (configRes.ok) {
        navigate("/dashboard")
      } else {
        // Redirect was to error page
        window.location.href = res.headers.get("Location") || "/?error=invalid"
      }
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="m-0 p-5 box-border font-sans bg-shell-bg min-h-screen flex items-center justify-center">
      <div className="bg-shell-surface p-10 md:p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-white text-2xl md:text-xl font-semibold text-center mb-6">Shell Access</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoFocus
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="p-3.5 border border-shell-border bg-shell-bg text-white rounded text-base focus:outline-none focus:border-shell-accent"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="p-3.5 bg-shell-accent hover:bg-shell-accent-hover active:bg-emerald-700 disabled:opacity-50 text-white border-none rounded text-base font-semibold cursor-pointer touch-manipulation transition-colors"
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
          {errorMessage && <p className="text-red-500 text-sm text-center mt-2">{errorMessage}</p>}
        </form>
      </div>
    </div>
  )
}
