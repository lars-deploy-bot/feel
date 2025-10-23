import { cookies } from 'next/headers'

export interface SessionUser {
	id: string
}

export async function getSessionUser(): Promise<SessionUser | null> {
	const jar = await cookies()
	const sessionCookie = jar.get('session')

	if (!sessionCookie) {
		return null
	}

	// For now, use a simple approach - extract user ID from session cookie
	// In production, you'd validate the session token and get actual user data
	const sessionValue = sessionCookie.value

	// Simple implementation: use session value as user ID for now
	// You can enhance this to decode JWT or lookup in database
	return {
		id: sessionValue || 'anonymous',
	}
}

export async function requireSessionUser(): Promise<SessionUser> {
	const user = await getSessionUser()
	if (!user) {
		throw new Error('Authentication required')
	}
	return user
}
