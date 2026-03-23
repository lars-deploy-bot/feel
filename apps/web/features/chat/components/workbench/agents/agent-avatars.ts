/** Deterministic avatar for an agent based on its ID */

/** Chunky game character defaults — job gear as armor */
const AGENT_AVATARS = [
  "/images/agent-avatars/m-analyst.png",
  "/images/agent-avatars/m-developer.png",
  "/images/agent-avatars/m-strategist.png",
  "/images/agent-avatars/m-scientist.png",
  "/images/agent-avatars/m-chef.png",
  "/images/agent-avatars/m-salesman.png",
  "/images/agent-avatars/f-writer.png",
  "/images/agent-avatars/f-designer.png",
  "/images/agent-avatars/f-marketer.png",
  "/images/agent-avatars/f-engineer.png",
  "/images/agent-avatars/f-teacher.png",
  "/images/agent-avatars/f-advisor.png",
  "/images/agent-avatars/f-saleswoman.png",
  "/images/agent-avatars/f-doctor.png",
] as const

export function agentAvatar(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  const abs = Math.abs(hash)
  return AGENT_AVATARS[abs % AGENT_AVATARS.length]
}
