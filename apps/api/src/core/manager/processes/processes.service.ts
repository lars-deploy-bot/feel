import { spawn } from "node:child_process"

export interface ProcessEntry {
  pid: number
  user: string
  cpu: number
  mem: number
  rss: string
  command: string
}

export async function getProcesses(): Promise<ProcessEntry[]> {
  const raw = await run("ps", ["aux", "--sort=-pcpu", "--no-headers"])
  return parsePs(raw).slice(0, 100) // top 100
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise(resolve => {
    const proc = spawn(cmd, args)
    let stdout = ""
    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString()
    })
    proc.stderr.resume()
    proc.on("close", () => {
      resolve(stdout)
    })
  })
}

function parsePs(raw: string): ProcessEntry[] {
  const entries: ProcessEntry[] = []

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue
    // ps aux columns: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
    const parts = line.trim().split(/\s+/)
    if (parts.length < 11) continue

    const user = parts[0]
    const pid = Number(parts[1])
    const cpu = Number(parts[2])
    const mem = Number(parts[3])
    const rssKb = Number(parts[5])
    const command = parts.slice(10).join(" ")

    // Format RSS
    let rss: string
    if (rssKb >= 1024 * 1024) {
      rss = `${(rssKb / (1024 * 1024)).toFixed(1)}G`
    } else if (rssKb >= 1024) {
      rss = `${(rssKb / 1024).toFixed(0)}M`
    } else {
      rss = `${rssKb}K`
    }

    // Skip kernel threads and idle
    if (cpu === 0 && mem === 0) continue

    entries.push({ pid, user, cpu, mem, rss, command })
  }

  return entries
}
