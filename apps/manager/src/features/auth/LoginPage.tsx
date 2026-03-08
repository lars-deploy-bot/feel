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
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-full max-w-sm">
        <div className="bg-surface rounded-card p-8">
          <div className="mb-8">
            <h1 className="text-[15px] font-semibold text-text-primary tracking-tight">alive</h1>
          </div>

          <p className="text-[13px] text-text-tertiary mb-6">Enter your passcode to continue</p>

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
            <Button type="submit" variant="primary" className="w-full mt-4" disabled={!passcode} loading={loading}>
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
