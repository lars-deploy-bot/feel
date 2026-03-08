/** Convert a cron expression to a human-readable string */
export function formatCron(cron: string | null, timezone?: string | null): string {
  if (!cron) return "-"

  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return cron

  const [minute, hour, , , dayOfWeek] = parts
  const tz = timezone ? ` (${timezone.replace(/^.*\//, "")})` : ""

  // Every minute
  if (minute === "*" && hour === "*") return `Every minute${tz}`

  // Every N minutes
  const everyNMin = minute.match(/^\*\/(\d+)$/)
  if (everyNMin && hour === "*") {
    const n = Number(everyNMin[1])
    return `Every ${n} min${tz}`
  }

  // Every N hours
  const everyNHour = hour.match(/^\*\/(\d+)$/)
  if (everyNHour) {
    const n = Number(everyNHour[1])
    const m = /^\d+$/.test(minute) ? `:${minute.padStart(2, "0")}` : ""
    return `Every ${n}h${m}${tz}`
  }

  // Odd/even hours like 1-23/2
  const rangeHour = hour.match(/^(\d+)-(\d+)\/(\d+)$/)
  if (rangeHour) {
    const step = Number(rangeHour[3])
    const m = /^\d+$/.test(minute) ? `:${minute.padStart(2, "0")}` : ""
    return `Every ${step}h${m}${tz}`
  }

  // Specific minute, every hour
  if (/^\d+$/.test(minute) && hour === "*") {
    return `Hourly at :${minute.padStart(2, "0")}${tz}`
  }

  // Specific time
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    const h = hour.padStart(2, "0")
    const m = minute.padStart(2, "0")
    const time = `${h}:${m}`

    if (dayOfWeek !== "*") {
      const days = dayOfWeek.split(",").map(d => {
        const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        return names[Number(d)] ?? d
      })
      return `${days.join(", ")} at ${time}${tz}`
    }

    return `Daily at ${time}${tz}`
  }

  return cron
}
