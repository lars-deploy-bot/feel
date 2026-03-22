import { spawn } from "node:child_process"

export interface PortEntry {
  port: number
  process: string
  pid: number
}

export async function getListeningPorts(): Promise<PortEntry[]> {
  const raw = await run("ss", ["-tlnp"])
  return parseSS(raw)
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args)
    let stdout = ""
    let stderr = ""
    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString()
    })
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString()
    })
    proc.on("close", code => {
      if (code !== 0) {
        reject(new Error(`${cmd} exited with ${code}: ${stderr}`))
      } else {
        resolve(stdout)
      }
    })
  })
}

function parseSS(raw: string): PortEntry[] {
  const lines = raw.split("\n").slice(1) // skip header
  const entries: PortEntry[] = []

  for (const line of lines) {
    if (!line.trim()) continue

    const parts = line.split(/\s+/)
    // ss -tlnp columns: State Recv-Q Send-Q Local Address:Port Peer Address:Port Process
    if (parts.length < 6) continue

    const localAddr = parts[3]
    const processInfo = parts.slice(5).join(" ")

    // Extract port from address like *:3000 or 127.0.0.1:5080 or [::]:22
    const portMatch = localAddr.match(/:(\d+)$/)
    if (!portMatch) continue
    const port = Number(portMatch[1])

    // Extract pid and process name from users:(("node",pid=1234,fd=3))
    const pidMatch = processInfo.match(/\("([^"]+)",pid=(\d+)/)
    const pid = pidMatch ? Number(pidMatch[2]) : 0
    const process = pidMatch ? pidMatch[1] : "unknown"

    entries.push({ port, process, pid })
  }

  // Deduplicate by port (ss shows both IPv4 and IPv6)
  const seen = new Map<number, PortEntry>()
  for (const entry of entries) {
    if (!seen.has(entry.port)) {
      seen.set(entry.port, entry)
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.port - b.port)
}
