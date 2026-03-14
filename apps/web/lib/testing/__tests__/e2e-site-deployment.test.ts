import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildSubdomain, WILDCARD_DOMAIN } from "@/lib/config"
import {
  extractReusableLiveDeploySlugsFromCaddy,
  isReusableLiveDeployDomain,
  readReusableLiveDeploySlugsFromCaddyFile,
} from "../e2e-site-deployment"

const readFileMock = vi.fn<(filePath: string, encoding: string) => Promise<string>>()

vi.mock("node:fs/promises", () => ({
  readFile: (filePath: string, encoding: string) => readFileMock(filePath, encoding),
}))

describe("e2e-site-deployment", () => {
  beforeEach(() => {
    readFileMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("recognizes reusable live deploy domains", () => {
    expect(isReusableLiveDeployDomain(buildSubdomain("dl1"))).toBe(true)
    expect(isReusableLiveDeployDomain(buildSubdomain("blog"))).toBe(false)
  })

  it("extracts reusable live deploy slugs from generated caddy blocks", () => {
    const caddy = `
app.${WILDCARD_DOMAIN} {
    reverse_proxy localhost:9000
}

dl2.${WILDCARD_DOMAIN} {
    reverse_proxy localhost:3334
}

preview.app.${WILDCARD_DOMAIN} {
    reverse_proxy localhost:9000
}

DL1.${WILDCARD_DOMAIN} {
    reverse_proxy localhost:3333
}
`

    expect(extractReusableLiveDeploySlugsFromCaddy(caddy, WILDCARD_DOMAIN)).toEqual(["dl1", "dl2"])
  })

  it("ignores wildcard and preview hosts", () => {
    const caddy = `
*.${WILDCARD_DOMAIN} {
    reverse_proxy localhost:5055
}

preview--dl4.${WILDCARD_DOMAIN} {
    reverse_proxy localhost:5055
}

${buildSubdomain("dl3")}.extra {
    reverse_proxy localhost:3335
}
`

    expect(extractReusableLiveDeploySlugsFromCaddy(caddy, WILDCARD_DOMAIN)).toEqual([])
  })

  it("returns no routed deploy slugs when the generated caddy file is absent", async () => {
    const missingFileError = new Error("missing generated caddy")
    Object.assign(missingFileError, { code: "ENOENT" })
    readFileMock.mockRejectedValueOnce(missingFileError)

    await expect(readReusableLiveDeploySlugsFromCaddyFile("/tmp/missing", WILDCARD_DOMAIN)).resolves.toEqual([])
  })

  it("rethrows unexpected generated caddy read failures with the file path", async () => {
    const permissionError = new Error("permission denied")
    Object.assign(permissionError, { code: "EACCES" })
    readFileMock.mockRejectedValueOnce(permissionError)

    await expect(
      readReusableLiveDeploySlugsFromCaddyFile("/tmp/generated/Caddyfile.sites", WILDCARD_DOMAIN),
    ).rejects.toThrow("Failed to read generated Caddy routing from /tmp/generated/Caddyfile.sites: permission denied")
  })
})
