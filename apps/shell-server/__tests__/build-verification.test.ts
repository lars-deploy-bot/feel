import { describe, test, expect } from "bun:test"
import { readFileSync, existsSync, readdirSync } from "fs"
import { join } from "path"

const DIST_DIR = join(__dirname, "..", "dist")
const TEMPLATES_DIR = join(DIST_DIR, "templates")

describe("Shell Server Build Verification", () => {
  test("should build with production environment inlined", () => {
    const distIndexPath = join(DIST_DIR, "index.js")
    expect(existsSync(distIndexPath)).toBe(true)

    const distContent = readFileSync(distIndexPath, "utf-8")

    // Check that production is hardcoded (not development)
    expect(distContent).toContain('"production"')

    // Should not have development as the default env
    const envMatch = distContent.match(/var env\s*=\s*"(\w+)"/)
    if (envMatch) {
      expect(envMatch[1]).toBe("production")
    }
  })

  test("templates should not be nested", () => {
    // Templates should be directly in dist/templates/, not dist/templates/templates/
    expect(existsSync(TEMPLATES_DIR)).toBe(true)

    const templatesContent = readdirSync(TEMPLATES_DIR)

    // Should contain HTML files
    expect(templatesContent).toContain("shell.html")
    expect(templatesContent).toContain("login.html")
    expect(templatesContent).toContain("dashboard.html")
    expect(templatesContent).toContain("upload.html")

    // Should NOT contain a nested templates directory
    expect(templatesContent).not.toContain("templates")
  })

  test("shell terminal JS should be bundled in client directory", () => {
    // Terminal JS is now bundled as shell-term.js instead of inline in shell.html
    const shellTermPath = join(DIST_DIR, "client", "shell-term.js")
    expect(existsSync(shellTermPath)).toBe(true)

    const content = readFileSync(shellTermPath, "utf-8")

    // Check that the bundled JS contains terminal functionality
    expect(content).toContain("WebSocket")
    expect(content).toContain("xterm")
  })

  test("config.json should have production environment", () => {
    const configPath = join(__dirname, "..", "config.json")
    expect(existsSync(configPath)).toBe(true)

    const config = JSON.parse(readFileSync(configPath, "utf-8"))

    expect(config.production).toBeDefined()
    expect(config.production.port).toBe(3888)
    expect(config.production.allowWorkspaceSelection).toBe(true)
  })

  test("build script should clean templates before copy", () => {
    const packageJsonPath = join(__dirname, "..", "package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))

    const buildScript = packageJson.scripts.build
    const buildServerScript = packageJson.scripts["build:server"]

    // Should remove old templates directory before copying
    expect(buildScript).toContain("rm -rf dist/templates")

    // Should define NODE_ENV at build time (in build:server subscript)
    expect(buildServerScript).toContain("--define process.env.NODE_ENV")
    expect(buildServerScript).toContain('"production"')

    // Main build script should call build:server
    expect(buildScript).toContain("build:server")
  })

  test("systemd service file should use MemoryMax not MemoryLimit", () => {
    const servicePath = "/etc/systemd/system/shell-server.service"

    if (existsSync(servicePath)) {
      const serviceContent = readFileSync(servicePath, "utf-8")

      // Should use MemoryMax (not deprecated MemoryLimit)
      expect(serviceContent).toContain("MemoryMax=")
      expect(serviceContent).not.toContain("MemoryLimit=")
    }
  })

  test("dist should contain required files", () => {
    expect(existsSync(join(DIST_DIR, "index.js"))).toBe(true)
    expect(existsSync(join(DIST_DIR, "pty-cwxgh7n9.node"))).toBe(true)
    expect(existsSync(TEMPLATES_DIR)).toBe(true)
  })
})
