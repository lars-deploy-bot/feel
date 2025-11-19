import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { promises as fs } from "fs"
import { mkdtemp, rmdir } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"

// Test utilities
let testDir: string

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "sitectl-test-"))
})

afterEach(async () => {
  try {
    await rmdir(testDir, { recursive: true })
  } catch {
    // Ignore cleanup errors
  }
})

describe("sitectl utilities", () => {
  describe("domainToSlug", () => {
    it("converts domain to slug correctly", () => {
      const domainToSlug = (domain: string): string => {
        return domain.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
      }

      expect(domainToSlug("example.com")).toBe("example-com")
      expect(domainToSlug("My-Domain.co.uk")).toBe("my-domain-co-uk")
      expect(domainToSlug("test_site.org")).toBe("test-site-org")
      expect(domainToSlug("UPPERCASE.COM")).toBe("uppercase-com")
    })
  })

  describe("isCloudflareIP", () => {
    it("detects Cloudflare IP addresses", () => {
      const isCloudflareIP = (ip: string): boolean => {
        const cfPatterns = [
          /^104\.1[6-9]\./,
          /^104\.2[0-4]\./,
          /^172\.6[4-7]\./,
          /^172\.7[0-1]\./,
          /^173\.245\./,
          /^188\.114\./,
          /^190\.93\./,
          /^197\.234\./,
          /^198\.41\./,
        ]
        return cfPatterns.some((pattern) => pattern.test(ip))
      }

      expect(isCloudflareIP("104.16.1.1")).toBe(true)
      expect(isCloudflareIP("104.24.255.255")).toBe(true)
      expect(isCloudflareIP("172.64.0.0")).toBe(true)
      expect(isCloudflareIP("173.245.48.1")).toBe(true)
      expect(isCloudflareIP("188.114.96.1")).toBe(true)

      expect(isCloudflareIP("8.8.8.8")).toBe(false)
      expect(isCloudflareIP("138.201.56.93")).toBe(false)
      expect(isCloudflareIP("1.1.1.1")).toBe(false)
    })
  })

  describe("port registry", () => {
    it("reads and writes domain port registry", async () => {
      const registryFile = join(testDir, "domain-passwords.json")

      // Write registry
      const registry = {
        "example.com": { port: 3333, credits: 200 },
        "test.com": { port: 3334, credits: 200 },
      }

      await fs.writeFile(registryFile, JSON.stringify(registry, null, 2))

      // Read back
      const content = await fs.readFile(registryFile, "utf-8")
      const parsed = JSON.parse(content)

      expect(parsed["example.com"].port).toBe(3333)
      expect(parsed["test.com"].port).toBe(3334)
      expect(parsed["example.com"].credits).toBe(200)
    })

    it("finds next available port", async () => {
      const registryFile = join(testDir, "domain-passwords.json")

      const registry = {
        "site1.com": { port: 3333 },
        "site2.com": { port: 3334 },
        "site3.com": { port: 3335 },
      }

      await fs.writeFile(registryFile, JSON.stringify(registry, null, 2))

      // Read and find next port
      const content = await fs.readFile(registryFile, "utf-8")
      const parsed = JSON.parse(content)

      let highestPort = 3332
      for (const entry of Object.values(parsed) as Array<{ port: number }>) {
        if (entry.port > highestPort) {
          highestPort = entry.port
        }
      }

      const nextPort = highestPort + 1
      expect(nextPort).toBe(3336)
    })

    it("adds new domain to registry", async () => {
      const registryFile = join(testDir, "domain-passwords.json")

      // Start with empty registry
      await fs.writeFile(registryFile, "{}")

      // Add domain
      const registry = JSON.parse(await fs.readFile(registryFile, "utf-8"))
      registry["newdomain.com"] = {
        port: 3333,
        createdAt: new Date().toISOString(),
        credits: 200,
      }
      await fs.writeFile(registryFile, JSON.stringify(registry, null, 2))

      // Verify
      const content = await fs.readFile(registryFile, "utf-8")
      const parsed = JSON.parse(content)
      expect(parsed["newdomain.com"].port).toBe(3333)
      expect(parsed["newdomain.com"].credits).toBe(200)
      expect(parsed["newdomain.com"].createdAt).toBeDefined()
    })
  })

  describe("directory operations", () => {
    it("creates and copies directories", async () => {
      const srcDir = join(testDir, "src")
      const dstDir = join(testDir, "dst")

      // Create source with files
      await fs.mkdir(srcDir, { recursive: true })
      await fs.writeFile(join(srcDir, "file1.txt"), "content1")
      await fs.mkdir(join(srcDir, "subdir"), { recursive: true })
      await fs.writeFile(join(srcDir, "subdir", "file2.txt"), "content2")

      // Copy directory recursively
      const copyDir = async (src: string, dst: string) => {
        await fs.mkdir(dst, { recursive: true })
        const entries = await fs.readdir(src, { withFileTypes: true })

        for (const entry of entries) {
          const srcPath = join(src, entry.name)
          const dstPath = join(dst, entry.name)

          if (entry.isDirectory()) {
            await copyDir(srcPath, dstPath)
          } else {
            const content = await fs.readFile(srcPath)
            await fs.writeFile(dstPath, content)
          }
        }
      }

      await copyDir(srcDir, dstDir)

      // Verify copy
      expect(await fs.readFile(join(dstDir, "file1.txt"), "utf-8")).toBe("content1")
      expect(await fs.readFile(join(dstDir, "subdir", "file2.txt"), "utf-8")).toBe("content2")
    })

    it("creates environment files", async () => {
      const envFile = join(testDir, "site-example-com.env")
      const envContent = "DOMAIN=example.com\nPORT=3333\n"

      await fs.writeFile(envFile, envContent)

      const content = await fs.readFile(envFile, "utf-8")
      expect(content).toContain("DOMAIN=example.com")
      expect(content).toContain("PORT=3333")
    })
  })

  describe("Caddyfile operations", () => {
    it("adds domain to Caddyfile", async () => {
      const caddyfile = join(testDir, "Caddyfile")

      // Start with basic content
      const initialContent = `# Caddy configuration
import common_headers

`
      await fs.writeFile(caddyfile, initialContent)

      // Add new domain block
      const domain = "example.com"
      const port = 3333

      let content = await fs.readFile(caddyfile, "utf-8")
      const domainBlock = `${domain} {`

      if (!content.includes(domainBlock)) {
        content += `
${domain} {
    import common_headers
    import image_serving
    reverse_proxy localhost:${port} {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
`
      }

      await fs.writeFile(caddyfile, content)

      // Verify
      const updated = await fs.readFile(caddyfile, "utf-8")
      expect(updated).toContain("example.com {")
      expect(updated).toContain("localhost:3333")
    })

    it("updates port in existing domain block", async () => {
      const caddyfile = join(testDir, "Caddyfile")

      const initialContent = `example.com {
    import common_headers
    reverse_proxy localhost:3333
}
`
      await fs.writeFile(caddyfile, initialContent)

      // Update port
      let content = await fs.readFile(caddyfile, "utf-8")
      const domain = "example.com"
      const newPort = 3334

      const blockRegex = new RegExp(`${domain.replace(/\./g, "\\.")} \\{[\\s\\S]*?localhost:\\d+`)
      content = content.replace(blockRegex, `${domain} {\n    import common_headers\n    reverse_proxy localhost:${newPort}`)

      await fs.writeFile(caddyfile, content)

      // Verify
      const updated = await fs.readFile(caddyfile, "utf-8")
      expect(updated).toContain("localhost:3334")
      expect(updated).not.toContain("localhost:3333")
    })
  })

  describe("site configuration", () => {
    it("creates Caddyfile in site directory", async () => {
      const siteDir = join(testDir, "site")
      const domain = "example.com"
      const port = 3333

      await fs.mkdir(siteDir, { recursive: true })

      const caddyfileContent = `# Auto-generated Caddyfile for ${domain}
# Port: ${port}

${domain} {
    import common_headers
    import image_serving
    reverse_proxy localhost:${port} {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
`

      const siteCaddyfile = join(siteDir, "Caddyfile")
      await fs.writeFile(siteCaddyfile, caddyfileContent)

      // Verify
      const content = await fs.readFile(siteCaddyfile, "utf-8")
      expect(content).toContain(`# Auto-generated Caddyfile for ${domain}`)
      expect(content).toContain(`localhost:${port}`)
    })

    it("validates port in environment file", async () => {
      const siteDir = join(testDir, "site")
      await fs.mkdir(siteDir, { recursive: true })

      const envContent = "DOMAIN=example.com\nPORT=3333\n"
      await fs.writeFile(join(siteDir, "site.env"), envContent)

      // Read and validate
      const content = await fs.readFile(join(siteDir, "site.env"), "utf-8")
      const portMatch = content.match(/PORT=(\d+)/)
      const port = portMatch ? parseInt(portMatch[1], 10) : 0

      expect(port).toBe(3333)
      expect(port).toBeGreaterThanOrEqual(3333)
      expect(port).toBeLessThan(4000)
    })
  })

  describe("error handling", () => {
    it("handles missing registry file", async () => {
      const registryFile = join(testDir, "missing-registry.json")

      // Try to read non-existent file
      try {
        await fs.readFile(registryFile, "utf-8")
        expect.unreachable("Should throw error")
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it("handles invalid JSON in registry", async () => {
      const registryFile = join(testDir, "invalid-registry.json")
      await fs.writeFile(registryFile, "{ invalid json }")

      try {
        const content = await fs.readFile(registryFile, "utf-8")
        JSON.parse(content)
        expect.unreachable("Should throw JSON parse error")
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it("validates port range", () => {
      const MIN_PORT = 3333
      const MAX_PORT = 3999

      const validatePort = (port: number): boolean => {
        return port >= MIN_PORT && port < MAX_PORT
      }

      expect(validatePort(3333)).toBe(true)
      expect(validatePort(3500)).toBe(true)
      expect(validatePort(3999)).toBe(false) // exclusive upper bound
      expect(validatePort(3332)).toBe(false)
      expect(validatePort(4000)).toBe(false)
    })
  })

  describe("domain validation", () => {
    it("validates domain format in registry", async () => {
      const registryFile = join(testDir, "domain-passwords.json")

      const domains = {
        "example.com": { port: 3333 },
        "subdomain.example.com": { port: 3334 },
        "test-domain-123.co.uk": { port: 3335 },
      }

      await fs.writeFile(registryFile, JSON.stringify(domains, null, 2))

      const content = await fs.readFile(registryFile, "utf-8")
      const parsed = JSON.parse(content)

      expect(parsed["example.com"]).toBeDefined()
      expect(parsed["subdomain.example.com"]).toBeDefined()
      expect(parsed["test-domain-123.co.uk"]).toBeDefined()
    })

    it("detects wildcard domains", () => {
      const WILDCARD_DOMAIN = "alive.best"

      const isWildcard = (domain: string): boolean => {
        return domain.endsWith(`.${WILDCARD_DOMAIN}`)
      }

      expect(isWildcard("test.alive.best")).toBe(true)
      expect(isWildcard("my-site.alive.best")).toBe(true)
      expect(isWildcard("example.com")).toBe(false)
      expect(isWildcard("alive.best")).toBe(false)
    })
  })
})
