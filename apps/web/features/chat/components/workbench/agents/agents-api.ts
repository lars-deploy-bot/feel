import type { AutomationJob, AutomationRun } from "./agents-types"

const fetchJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, { credentials: "include", ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export const agentsApi = {
  list: async (workspace: string): Promise<AutomationJob[]> => {
    const json = await fetchJson("/api/automations?limit=100")
    const all: AutomationJob[] = json.automations ?? []
    return all.filter(a => a.hostname === workspace)
  },

  get: async (id: string): Promise<AutomationJob> => {
    const json = await fetchJson(`/api/automations/${id}`)
    return json.automation
  },

  update: async (id: string, fields: Record<string, unknown>): Promise<void> => {
    await fetchJson(`/api/automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    })
  },

  setActive: async (id: string, isActive: boolean): Promise<void> => {
    await fetchJson(`/api/automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: isActive }),
    })
  },

  trigger: async (id: string): Promise<void> => {
    await fetchJson(`/api/automations/${id}/trigger`, { method: "POST" })
  },

  delete: async (id: string): Promise<void> => {
    await fetchJson(`/api/automations/${id}`, { method: "DELETE" })
  },

  getRuns: async (id: string): Promise<AutomationRun[]> => {
    const json = await fetchJson(`/api/automations/${id}/runs`)
    return json.runs ?? []
  },
}
