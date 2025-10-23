export interface SessionStore {
	get(key: string): Promise<string | null>
	set(key: string, val: string): Promise<void>
	delete(key: string): Promise<void>
}

// Simple in-memory default; replace with Redis/DB in production
const mem = new Map<string, string>()

export const SessionStoreMemory: SessionStore = {
	async get(key) {
		return mem.get(key) ?? null
	},
	async set(key, val) {
		mem.set(key, val)
	},
	async delete(key) {
		mem.delete(key)
	},
}

// Helper to build a stable key (user + workspace + conversation)
export function sessionKey({
	userId,
	workspace,
	conversationId,
}: {
	userId: string
	workspace?: string
	conversationId: string
}) {
	return `${userId}::${workspace ?? 'default'}::${conversationId}`
}

// Concurrency guard to prevent overlapping sessions
const activeConversations = new Set<string>()

export function tryLockConversation(key: string): boolean {
	if (activeConversations.has(key)) {
		return false
	}
	activeConversations.add(key)
	return true
}

export function unlockConversation(key: string): void {
	activeConversations.delete(key)
}