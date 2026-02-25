type LogLevel = "info" | "warn" | "error"

interface LogEntry {
  timestamp: string
  level: LogLevel
  msg: string
  [key: string]: unknown
}

function write(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    msg,
    ...data,
  }
  const line = JSON.stringify(entry)
  if (level === "error") {
    process.stderr.write(line + "\n")
  } else {
    process.stdout.write(line + "\n")
  }
}

export const logger = {
  info(msg: string, data?: Record<string, unknown>): void {
    write("info", msg, data)
  },
  warn(msg: string, data?: Record<string, unknown>): void {
    write("warn", msg, data)
  },
  error(msg: string, data?: Record<string, unknown>): void {
    write("error", msg, data)
  },
}
