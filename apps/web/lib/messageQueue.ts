/**
 * Message queue system to replace crude conversation locking
 * Allows multiple messages to be queued and processed sequentially
 */

interface QueuedMessage {
  id: string
  message: string
  conversationId: string
  workspace?: string
  userId: string
  claudeOptions: any
  requestId: string
  resolve: (value: any) => void
  reject: (error: any) => void
}

// Global queue: Map<conversationKey, Array<QueuedMessage>>
const messageQueues = new Map<string, QueuedMessage[]>()
const processingQueues = new Set<string>()

/**
 * Generate conversation key for queuing
 */
export function getConversationKey(userId: string, workspace: string | undefined, conversationId: string): string {
  return `${userId}::${workspace ?? 'default'}::${conversationId}`
}

/**
 * Add message to queue and process if queue is not busy
 */
export async function queueMessage(
  userId: string,
  workspace: string | undefined,
  conversationId: string,
  message: string,
  claudeOptions: any,
  requestId: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    const convKey = getConversationKey(userId, workspace, conversationId)

    const queuedMessage: QueuedMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      conversationId,
      workspace,
      userId,
      claudeOptions,
      requestId,
      resolve,
      reject
    }

    // Add to queue
    if (!messageQueues.has(convKey)) {
      messageQueues.set(convKey, [])
    }
    messageQueues.get(convKey)!.push(queuedMessage)

    console.log(`[Queue ${requestId}] Added to queue. Position: ${messageQueues.get(convKey)!.length}`)

    // Start processing if not already processing
    if (!processingQueues.has(convKey)) {
      processQueue(convKey)
    }
  })
}

/**
 * Process messages in queue sequentially
 */
async function processQueue(convKey: string) {
  if (processingQueues.has(convKey)) {
    return // Already processing
  }

  processingQueues.add(convKey)
  console.log(`[Queue] Starting processing for: ${convKey}`)

  try {
    const queue = messageQueues.get(convKey)
    if (!queue) return

    while (queue.length > 0) {
      const queuedMessage = queue.shift()!
      console.log(`[Queue ${queuedMessage.requestId}] Processing message (${queue.length} remaining)`)

      try {
        // Import the actual Claude stream creation here to avoid circular deps
        const { createClaudeStream } = await import('@/app/features/claude/streamHandler')

        // Process the message
        const result = await processMessage(queuedMessage, createClaudeStream)
        queuedMessage.resolve(result)
      } catch (error) {
        console.error(`[Queue ${queuedMessage.requestId}] Processing failed:`, error)
        queuedMessage.reject(error)
      }
    }
  } finally {
    processingQueues.delete(convKey)
    console.log(`[Queue] Finished processing for: ${convKey}`)

    // Clean up empty queue
    const queue = messageQueues.get(convKey)
    if (queue && queue.length === 0) {
      messageQueues.delete(convKey)
    }
  }
}

/**
 * Process individual message (extracted from route handler)
 */
async function processMessage(queuedMessage: QueuedMessage, createClaudeStream: any): Promise<any> {
  const { createSSEResponse } = await import('@/app/features/claude/streamHandler')
  const { SessionStoreMemory } = await import('@/lib/sessionStore')

  // Get existing session for resumption
  const existingSessionId = await SessionStoreMemory.get(
    getConversationKey(queuedMessage.userId, queuedMessage.workspace, queuedMessage.conversationId)
  )

  const claudeOptionsWithResume = {
    ...queuedMessage.claudeOptions,
    ...(existingSessionId ? { resume: existingSessionId } : {}),
  }

  console.log(`[Queue ${queuedMessage.requestId}] Creating stream with session: ${existingSessionId ? 'resumed' : 'new'}`)

  // Create the stream (no conversation object needed since queuing handles concurrency)
  const { stream } = createClaudeStream({
    message: queuedMessage.message,
    claudeOptions: claudeOptionsWithResume,
    requestId: queuedMessage.requestId,
    host: 'queued', // Placeholder
    cwd: claudeOptionsWithResume.cwd,
    user: { id: queuedMessage.userId },
    conversation: {
      key: getConversationKey(queuedMessage.userId, queuedMessage.workspace, queuedMessage.conversationId),
      store: SessionStoreMemory
    },
    onClose: () => {}, // No longer needed with queuing
  })

  return createSSEResponse(stream)
}

/**
 * Get current queue status for debugging
 */
export function getQueueStatus() {
  const status: Record<string, { queueLength: number; processing: boolean }> = {}

  for (const [key, queue] of messageQueues.entries()) {
    status[key] = {
      queueLength: queue.length,
      processing: processingQueues.has(key)
    }
  }

  return status
}