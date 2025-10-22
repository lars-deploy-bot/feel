'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function WorkspacePage() {
	const [workspace, setWorkspace] = useState('webalive/sites/demo.goalive.nl')
	const [verifying, setVerifying] = useState(false)
	const [verifyResult, setVerifyResult] = useState<{ verified: boolean; message: string; error?: string } | null>(null)
	const router = useRouter()

	// Check if we're on terminal hostname
	const isTerminal = typeof window !== 'undefined' && window.location.hostname.startsWith('terminal.')

	useEffect(() => {
		// If not terminal mode, redirect to chat
		if (typeof window !== 'undefined' && !isTerminal) {
			router.push('/chat')
		}
	}, [isTerminal, router])

	async function verifyWorkspace() {
		setVerifying(true)
		setVerifyResult(null)

		try {
			const response = await fetch('/api/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ workspace }),
			})

			const result = await response.json()

			if (result.verified) {
				setVerifyResult({
					verified: true,
					message: result.message || 'Workspace verified successfully!',
				})
			} else {
				setVerifyResult({
					verified: false,
					message: result.message || 'Workspace verification failed',
					error: result.error,
				})
			}
		} catch (error) {
			setVerifyResult({
				verified: false,
				message: 'Failed to verify workspace',
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}

		setVerifying(false)
	}

	function continueToChat() {
		// Store workspace in sessionStorage for chat page
		sessionStorage.setItem('workspace', workspace)
		router.push('/chat')
	}

	if (!isTerminal) {
		return (
			<div className="max-w-2xl mx-auto my-20 p-4 text-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
				<p className="mt-4 text-gray-600">Redirecting...</p>
			</div>
		)
	}

	return (
		<main className="max-w-2xl mx-auto my-10 p-4">
			<h1 className="text-3xl font-bold mb-6">Workspace Setup - Terminal Mode</h1>

			<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
				<h2 className="font-semibold text-blue-800 mb-2">Terminal Mode Active</h2>
				<p className="text-blue-700 text-sm">
					You're using terminal mode which allows you to specify a custom workspace directory. Please verify your
					workspace before proceeding to chat.
				</p>
			</div>

			<div className="space-y-6">
				<div>
					<label htmlFor="workspace" className="block text-sm font-medium text-gray-700 mb-2">
						Workspace Directory (must start with webalive/sites/)
					</label>
					<div className="flex gap-2">
						<input
							id="workspace"
							type="text"
							value={workspace}
							onChange={(e) => {
								setWorkspace(e.target.value)
								setVerifyResult(null) // Clear verification when workspace changes
							}}
							placeholder="webalive/sites/demo.goalive.nl"
							className="flex-1 px-4 py-2 border border-gray-300 rounded font-mono"
							required
						/>
						<button
							type="button"
							onClick={verifyWorkspace}
							disabled={verifying || !workspace.trim()}
							className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
						>
							{verifying ? 'Verifying...' : 'Verify'}
						</button>
					</div>

					{verifyResult && (
						<div
							className={`mt-3 p-4 rounded text-sm ${
								verifyResult.verified
									? 'bg-green-50 text-green-800 border border-green-200'
									: 'bg-red-50 text-red-800 border border-red-200'
							}`}
						>
							<div className="flex items-center gap-2 mb-2">
								<span>{verifyResult.verified ? '✅' : '❌'}</span>
								<span className="font-medium">{verifyResult.message}</span>
							</div>
							{verifyResult.error && <div className="text-xs opacity-75">Error: {verifyResult.error}</div>}

							{verifyResult.verified && (
								<div className="mt-4 pt-3 border-t border-green-300">
									<button
										onClick={continueToChat}
										className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
									>
										Continue to Chat →
									</button>
								</div>
							)}
						</div>
					)}
				</div>

				<div className="text-sm text-gray-600 space-y-2">
					<p>
						<strong>What happens next?</strong>
					</p>
					<ul className="list-disc list-inside space-y-1 ml-4">
						<li>Verification checks if the directory exists and is accessible</li>
						<li>Once verified, you'll proceed to the chat interface</li>
						<li>Claude will work within your specified workspace directory</li>
						<li>All file operations will be restricted to this workspace</li>
					</ul>
				</div>
			</div>
		</main>
	)
}
