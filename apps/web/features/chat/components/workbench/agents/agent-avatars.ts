/** Deterministic avatar for an agent based on its ID */

const AGENT_AVATARS_MALE = [
  "/images/agent-avatars/m-analyst.png",
  "/images/agent-avatars/m-developer.png",
  "/images/agent-avatars/m-strategist.png",
  "/images/agent-avatars/m-scientist.png",
  "/images/agent-avatars/m-chef.png",
  "/images/agent-avatars/m-photographer.png",
  "/images/agent-avatars/m-salesman.png",
  "/images/agent-avatars/m-pilot.png",
  "/images/agent-avatars/m-architect.png",
] as const

const AGENT_AVATARS_FEMALE = [
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
  // Even hash = male, odd = female
  const pool = abs % 2 === 0 ? AGENT_AVATARS_MALE : AGENT_AVATARS_FEMALE
  return pool[abs % pool.length]
}
