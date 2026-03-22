import { spawn } from "node:child_process"

export interface DiskOverview {
  filesystem: string
  size: string
  used: string
  available: string
  usePercent: string
  mount: string
}

export interface SiteDiskUsage {
  site: string
  size: string
}

export interface DiskData {
  overview: DiskOverview[]
  sites: SiteDiskUsage[]
}

export async function getDiskData(): Promise<DiskData> {
  const [dfRaw, duRaw] = await Promise.all([
    run(
      "df",
      ["-h", "--output=source,size,used,avail,pcent,target", "-x", "tmpfs", "-x", "devtmpfs", "-x", "overlay"],
      5_000,
    ),
    run(
      "du",
      ["-h", "--max-depth=1", "--exclude=node_modules", "--exclude=.bun", "--exclude=.next", "/srv/webalive/sites/"],
      15_000,
    ),
  ])
  return {
    overview: parseDf(dfRaw),
    sites: parseDu(duRaw),
  }
}

function run(cmd: string, args: string[], timeoutMs = 10_000): Promise<string> {
  return new Promise(resolve => {
    const proc = spawn(cmd, args, { timeout: timeoutMs })
    let stdout = ""
    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString()
    })
    proc.on("close", () => {
      resolve(stdout)
    })
    proc.on("error", () => {
      resolve(stdout)
    })
  })
}

function parseDf(raw: string): DiskOverview[] {
  const lines = raw.split("\n").slice(1)
  const entries: DiskOverview[] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.trim().split(/\s+/)
    if (parts.length < 6) continue
    entries.push({
      filesystem: parts[0],
      size: parts[1],
      used: parts[2],
      available: parts[3],
      usePercent: parts[4],
      mount: parts[5],
    })
  }

  return entries
}

function parseDu(raw: string): SiteDiskUsage[] {
  const entries: SiteDiskUsage[] = []

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue
    const parts = line.trim().split(/\t/)
    if (parts.length < 2) continue
    const size = parts[0]
    const path = parts[1]
    if (path === "/srv/webalive/sites/" || path === "/srv/webalive/sites") continue
    const site = path.replace(/^\/srv\/webalive\/sites\//, "").replace(/\/$/, "")
    if (site) entries.push({ site, size })
  }

  return entries.sort((a, b) => parseSize(b.size) - parseSize(a.size))
}

function parseSize(s: string): number {
  const match = s.match(/^([\d.]+)([KMGT]?)$/i)
  if (!match) return 0
  const num = Number(match[1])
  const unit = (match[2] || "").toUpperCase()
  const multipliers: Record<string, number> = { "": 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 }
  return num * (multipliers[unit] ?? 1)
}
