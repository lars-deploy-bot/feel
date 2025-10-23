import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export function addCorsHeaders(res: NextResponse, origin?: string | null) {
	let allowedOrigin = 'https://terminal.goalive.nl' // fallback

	if (origin) {
		// Try to read allowed domains from file
		try {
			const domainsFile = join(process.cwd(), 'allowed-domains.json')

			if (existsSync(domainsFile)) {
				const allowedDomains = JSON.parse(readFileSync(domainsFile, 'utf8'))

				if (allowedDomains.includes(origin)) {
					allowedOrigin = origin
				}
			} else {
				// Fallback: allow any .goalive.nl domain
				if (origin.endsWith('.goalive.nl')) {
					allowedOrigin = origin
				}
			}
		} catch (error) {
			console.warn('Failed to read allowed domains file:', error)
			// Fallback: allow any .goalive.nl domain
			if (origin.endsWith('.goalive.nl')) {
				allowedOrigin = origin
			}
		}
	}

	res.headers.set('Access-Control-Allow-Origin', allowedOrigin)
	res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
	res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
	res.headers.set('Access-Control-Allow-Credentials', 'true')
	res.headers.set('Access-Control-Max-Age', '86400')
}