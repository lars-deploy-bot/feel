import { promises as fs } from "fs"
import { createConnection } from "net"
import { DeploymentError } from "../orchestration/errors"

const MIN_PORT = 3333
const MAX_PORT = 3999
const DOMAIN_PASSWORDS_FILE = "/var/lib/claude-bridge/domain-passwords.json"

interface DomainPasswordEntry {
  passwordHash?: string
  port: number
  createdAt?: string
  credits?: number
  email?: string
}

export async function getOrAssignPort(domain: string): Promise<number> {
  try {
    const port = await getPortFromRegistry(domain)
    return port
  } catch {
    // Domain not in registry, get next available
  }

  const port = await getNextAvailablePort()
  try {
    await addToDomainRegistry(domain, port)
  } catch (error) {
    console.warn(`⚠️  Warning: Failed to update registry: ${error}`)
  }

  return port
}

export async function getPortFromRegistry(domain: string): Promise<number> {
  try {
    const data = await fs.readFile(DOMAIN_PASSWORDS_FILE, "utf-8")
    const registry = JSON.parse(data)
    if (registry[domain]?.port) {
      return registry[domain].port
    }
  } catch {
    // File doesn't exist yet
  }
  throw new Error("Domain not in registry")
}

export async function getNextAvailablePort(): Promise<number> {
  let highestPort = MIN_PORT - 1

  try {
    const data = await fs.readFile(DOMAIN_PASSWORDS_FILE, "utf-8")
    const registry = JSON.parse(data)
    for (const entry of Object.values(registry) as DomainPasswordEntry[]) {
      if (entry.port >= MIN_PORT && entry.port < MAX_PORT && entry.port > highestPort) {
        highestPort = entry.port
      }
    }
  } catch {
    // File doesn't exist yet
  }

  let testPort = highestPort + 1
  while (testPort < MAX_PORT) {
    if (!(await isPortListening(testPort))) {
      return testPort
    }
    testPort++
  }

  throw new DeploymentError(`Cannot find available port in range ${MIN_PORT}-${MAX_PORT}`)
}

export async function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "localhost" })
    socket.setTimeout(100)

    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })

    socket.once("error", () => {
      socket.destroy()
      resolve(false)
    })

    socket.once("timeout", () => {
      socket.destroy()
      resolve(false)
    })
  })
}

export async function addToDomainRegistry(domain: string, port: number) {
  let registry: Record<string, DomainPasswordEntry> = {}

  try {
    const data = await fs.readFile(DOMAIN_PASSWORDS_FILE, "utf-8")
    registry = JSON.parse(data)
  } catch {
    // File doesn't exist yet
  }

  registry[domain] = {
    port,
    createdAt: new Date().toISOString(),
    credits: 200,
  }

  await fs.writeFile(DOMAIN_PASSWORDS_FILE, JSON.stringify(registry, null, 2))
}

export { MIN_PORT, MAX_PORT, DOMAIN_PASSWORDS_FILE }
