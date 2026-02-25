import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

interface LoginPageProps {
  onLogin: (passcode: string) => Promise<void>
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [passcode, setPasscode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await onLogin(passcode)
    } catch {
      setError("Invalid passcode")
      setPasscode("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
      <div className="w-full max-w-sm">
        <div className="bg-surface rounded-card border border-border p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
              <span className="text-white text-lg font-bold">A</span>
            </div>
          </div>

          <h1 className="text-center text-lg font-semibold text-text-primary mb-1">Alive Manager</h1>
          <p className="text-center text-sm text-text-tertiary mb-6">Enter your passcode to continue</p>

          <form onSubmit={handleSubmit} autoComplete="off">
            <Input
              id="passcode"
              type="password"
              placeholder="Passcode"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              error={error}
              autoFocus
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
            />
            <Button variant="primary" className="w-full mt-4" disabled={!passcode} loading={loading}>
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
