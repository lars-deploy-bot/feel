import { spawn } from "node:child_process"

export interface ContainerEntry {
  id: string
  name: string
  image: string
  status: string
  ports: string
  state: string
}

export async function getContainers(): Promise<ContainerEntry[]> {
  const raw = await run("docker", [
    "ps",
    "-a",
    "--format",
    "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.State}}",
  ])
  return parseDocker(raw)
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

function parseDocker(raw: string): ContainerEntry[] {
  const entries: ContainerEntry[] = []

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue
    const parts = line.split("\t")
    if (parts.length < 6) continue

    entries.push({
      id: parts[0],
      name: parts[1],
      image: parts[2],
      status: parts[3],
      ports: parts[4],
      state: parts[5],
    })
  }

  // Running first, then sorted by name
  return entries.sort((a, b) => {
    if (a.state === "running" && b.state !== "running") return -1
    if (a.state !== "running" && b.state === "running") return 1
    return a.name.localeCompare(b.name)
  })
}
