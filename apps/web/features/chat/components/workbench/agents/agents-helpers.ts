import type { AutomationJob, EnrichedJob } from "./agents-types"

export function relTime(d: string | null): string {
  if (!d) return "—"
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return "now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function futTime(d: string | null): string {
  if (!d) return "—"
  const ms = new Date(d).getTime() - Date.now()
  if (ms < 0) return "overdue"
  const m = Math.floor(ms / 60000)
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `in ${h}h`
  return `in ${Math.floor(h / 24)}d`
}

export function dur(ms: number | null): string {
  if (ms === null) return "—"
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(0)}s`
  return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`
}

export function trigLabel(a: AutomationJob): string {
  if (a.trigger_type === "email") return "On email"
  if (a.trigger_type === "webhook") return "On webhook"
  if (a.trigger_type === "one-time") return "One-time"
  if (!a.cron_schedule) return "—"
  const parts = a.cron_schedule.split(" ")
  if (parts.length < 5) return a.cron_schedule
  const [min, hr, , , wd] = parts
  const time = `${hr.padStart(2, "0")}:${min.padStart(2, "0")}`
  if (wd === "1-5") return `Weekdays ${time}`
  if (wd === "1") return `Mon ${time}`
  if (wd === "*") return `Daily ${time}`
  return a.cron_schedule
}

export function healthScore(a: EnrichedJob): number {
  if (!a.is_active) return 100
  if (a.last_run_status === "failure") return 0
  if (a.status === "running") return 10
  return 50 + a.success_rate * 0.5
}
