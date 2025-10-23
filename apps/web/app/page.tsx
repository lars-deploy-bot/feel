'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/primitives/Button'

export default function LoginPage() {
	const [authed, setAuthed] = useState(false)
	const [pass, setPass] = useState('')
	const [isTerminal, setIsTerminal] = useState(false)
	const [mounted, setMounted] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const router = useRouter()

	useEffect(() => {
		setMounted(true)
		setIsTerminal(window.location.hostname.startsWith('terminal.'))
	}, [])

	useEffect(() => {
		// If already authenticated, redirect to appropriate page
		if (authed && mounted) {
			if (isTerminal) {
				router.push('/workspace')
			} else {
				router.push('/chat')
			}
		}
	}, [authed, isTerminal, mounted, router])

	async function login(e: React.FormEvent) {
		e.preventDefault()
		setLoading(true)
		setError('')

		try {
			const r = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ passcode: pass }) })
			if (r.ok) {
				setAuthed(true)
			} else {
				setError('Invalid passcode')
			}
		} catch {
			setError('Connection failed')
		} finally {
			setLoading(false)
		}
	}

	return (
		<main className="min-h-screen bg-black flex items-center justify-center">
			<div className="w-80">
				<h1 className="text-6xl font-thin mb-16 text-white">•</h1>

				{mounted && isTerminal && <p className="text-white/60 text-sm mb-12">terminal</p>}

				<form onSubmit={login} className="space-y-8">
					<input
						type="password"
						value={pass}
						onChange={(e) => setPass(e.target.value)}
						placeholder="passcode"
						disabled={loading}
						className="w-full bg-transparent border-0 border-b border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white pb-3 text-lg font-thin"
					/>

					{error && <p className="text-white/60 text-sm">{error}</p>}

					<Button
						type="submit"
						fullWidth
						loading={loading}
						disabled={!pass.trim()}
						className="!bg-white !text-black hover:!bg-white/90 !border-0 !font-thin !text-lg !py-4"
					>
						enter
					</Button>
				</form>
			</div>
		</main>
	)
}
