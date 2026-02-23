export interface AutomationScheduleInput {
  scheduleType: "once" | "daily" | "weekly" | "monthly" | "custom"
  scheduleTime: string
  scheduleDate?: string
  cronExpression?: string
  timezone: string
}

type SchedulePayload =
  | {
      trigger_type: "one-time"
      run_at: string
    }
  | {
      trigger_type: "cron"
      cron_schedule: string
      cron_timezone: string
    }

function parseScheduleDate(scheduleDate: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(scheduleDate)
  if (!match) {
    throw new Error(`Invalid schedule date: "${scheduleDate}"`)
  }

  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`Invalid schedule date: "${scheduleDate}"`)
  }

  return { year, month, day }
}

function parseScheduleTime(scheduleTime: string): { hour: number; minute: number } {
  const [hourRaw, minuteRaw] = scheduleTime.split(":")
  const hour = Number.parseInt(hourRaw ?? "", 10)
  const minute = Number.parseInt(minuteRaw ?? "", 10)

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`Invalid schedule time hour: "${scheduleTime}"`)
  }

  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`Invalid schedule time minute: "${scheduleTime}"`)
  }

  return { hour, minute }
}

function toCronTimePrefix(scheduleTime: string): string {
  const { hour, minute } = parseScheduleTime(scheduleTime)
  return `${minute} ${hour}`
}

function createTimezoneFormatter(timezone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
  } catch {
    throw new Error(`Invalid timezone: "${timezone}"`)
  }
}

function getTimezoneDateParts(timestamp: number, formatter: Intl.DateTimeFormat) {
  const partMap = new Map<string, number>()
  for (const part of formatter.formatToParts(new Date(timestamp))) {
    if (part.type === "literal") continue
    partMap.set(part.type, Number.parseInt(part.value, 10))
  }

  const year = partMap.get("year")
  const month = partMap.get("month")
  const day = partMap.get("day")
  const hour = partMap.get("hour")
  const minute = partMap.get("minute")
  const second = partMap.get("second")

  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    throw new Error("Failed to parse timezone date parts")
  }

  return { year, month, day, hour, minute, second }
}

export function toZonedDateTimeIso(scheduleDate: string, scheduleTime: string, timezone: string): string {
  const { year, month, day } = parseScheduleDate(scheduleDate)
  const { hour, minute } = parseScheduleTime(scheduleTime)
  const formatter = createTimezoneFormatter(timezone)
  const localTimestamp = Date.UTC(year, month - 1, day, hour, minute, 0, 0)

  let utcTimestamp = localTimestamp
  for (let i = 0; i < 3; i += 1) {
    const zonedParts = getTimezoneDateParts(utcTimestamp, formatter)
    const zonedAsUtc = Date.UTC(
      zonedParts.year,
      zonedParts.month - 1,
      zonedParts.day,
      zonedParts.hour,
      zonedParts.minute,
      zonedParts.second,
      0,
    )
    const offsetMs = zonedAsUtc - utcTimestamp
    const nextTimestamp = localTimestamp - offsetMs

    if (nextTimestamp === utcTimestamp) {
      break
    }

    utcTimestamp = nextTimestamp
  }

  const resolvedParts = getTimezoneDateParts(utcTimestamp, formatter)
  if (
    resolvedParts.year !== year ||
    resolvedParts.month !== month ||
    resolvedParts.day !== day ||
    resolvedParts.hour !== hour ||
    resolvedParts.minute !== minute
  ) {
    throw new Error(`Invalid local date/time "${scheduleDate}T${scheduleTime}" for timezone "${timezone}"`)
  }

  return new Date(utcTimestamp).toISOString()
}

export function scheduleResultToApiPayload(result: AutomationScheduleInput, now = new Date()): SchedulePayload {
  const timePrefix = toCronTimePrefix(result.scheduleTime)

  switch (result.scheduleType) {
    case "once": {
      if (!result.scheduleDate) {
        throw new Error("Missing scheduleDate for one-time automation")
      }

      return {
        trigger_type: "one-time",
        run_at: toZonedDateTimeIso(result.scheduleDate, result.scheduleTime, result.timezone),
      }
    }

    case "daily":
      return {
        trigger_type: "cron",
        cron_schedule: `${timePrefix} * * *`,
        cron_timezone: result.timezone,
      }

    case "weekly":
      return {
        trigger_type: "cron",
        cron_schedule: `${timePrefix} * * ${now.getDay()}`,
        cron_timezone: result.timezone,
      }

    case "monthly":
      return {
        trigger_type: "cron",
        cron_schedule: `${timePrefix} ${now.getDate()} * *`,
        cron_timezone: result.timezone,
      }

    case "custom": {
      const cronExpression = result.cronExpression?.trim()
      if (!cronExpression) {
        throw new Error("Missing cron expression for custom schedule")
      }

      return {
        trigger_type: "cron",
        cron_schedule: cronExpression,
        cron_timezone: result.timezone,
      }
    }
  }
}
