'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const router = useRouter()

  // Check if we're on terminal hostname
  const isTerminal = typeof window !== 'undefined' && window.location.hostname.startsWith('terminal.')

  useEffect(() => {
    // If already authenticated, redirect to appropriate page
    if (authed) {
      if (isTerminal) {
        router.push('/workspace')
      } else {
        router.push('/chat')
      }
    }
  }, [authed, isTerminal, router])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    const r = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ passcode: pass }) })
    if (r.ok) setAuthed(true)
    else alert('Login failed')
  }

  return (
    <main className="max-w-2xl mx-auto my-10 p-4">
      <h1 className="text-3xl font-bold mb-6">
        Login{isTerminal && ' - Terminal Mode'}
      </h1>

      {isTerminal && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-blue-800 mb-2">Terminal Mode</h2>
          <p className="text-blue-700 text-sm">
            You'll be able to specify a custom workspace directory after login.
          </p>
        </div>
      )}

      <form onSubmit={login} className="space-y-4">
        <input
          type="password"
          value={pass}
          onChange={e => setPass(e.target.value)}
          placeholder="Passcode"
          className="w-full px-4 py-2 border border-gray-300 rounded"
        />
        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Enter
        </button>
        <p className="text-sm text-gray-600 mt-4">If BRIDGE_PASSCODE is unset, any passcode works.</p>
      </form>
    </main>
  )
}
