import { spawn } from "node:child_process"

export interface ServiceEntry {
  name: string
  state: string
  sub: string
  description: string
}

export async function getServices(): Promise<ServiceEntry[]> {
  const raw = await run("systemctl", ["list-units", "--type=service", "--all", "--no-pager", "--no-legend", "--plain"])
  return parseSystemctl(raw)
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
      // systemctl exits non-zero when there are failed units
      resolve(stdout)
    })
  })
}

function parseSystemctl(raw: string): ServiceEntry[] {
  const entries: ServiceEntry[] = []

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue
    // Format: UNIT LOAD ACTIVE SUB DESCRIPTION...
    const parts = line.trim().split(/\s+/)
    if (parts.length < 5) continue

    const name = parts[0].replace(/\.service$/, "")
    const state = parts[2] // active/inactive/failed
    const sub = parts[3] // running/dead/exited/failed
    const description = parts.slice(4).join(" ")

    entries.push({ name, state, sub, description })
  }

  return entries.sort((a, b) => {
    // Failed first, then active/running, then rest
    const rank = (e: ServiceEntry) => {
      if (e.state === "failed") return 0
      if (e.sub === "running") return 1
      return 2
    }
    const diff = rank(a) - rank(b)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })
}
