import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockExecFile = vi.fn((..._args: unknown[]) => {})
const mockExistsSync = vi.fn((..._args: unknown[]) => false)
const mockMkdir = vi.fn(async (..._args: unknown[]) => {})
const mockRm = vi.fn(async (..._args: unknown[]) => {})
const mockWriteFile = vi.fn(async (..._args: unknown[]) => {})
const originalGetuid = process.getuid
const originalGetgid = process.getgid

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}))

vi.mock("node:fs", () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}))

vi.mock("node:fs/promises", () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  rm: (...args: unknown[]) => mockRm(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock("@webalive/shared", () => ({
  PATHS: {
    SITES_ROOT: "/srv/webalive/sites",
  },
  TEST_CONFIG: {
    EMAIL_DOMAIN: "alive.local",
  },
}))

vi.mock("@/features/manager/lib/domain-utils", () => ({
  domainToSlug: (workspace: string) => workspace.replaceAll(".", "-"),
}))

const { ensureWorkspaceFilesystem, ensureSystemUser } = await import("../workspace-filesystem")

type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string")
}

function isExecCallback(value: unknown): value is ExecCallback {
  return typeof value === "function"
}

function queueExecResponses(
  responses: Record<string, Array<{ error?: Error; stdout?: string; stderr?: string }>>,
): void {
  mockExecFile.mockImplementation((...callArgs: unknown[]) => {
    const [file, args, callback] = callArgs
    if (typeof file !== "string" || !isStringArray(args) || !isExecCallback(callback)) {
      throw new Error("Unexpected execFile mock arguments")
    }

    const key = `${file} ${args.join(" ")}`
    const queue = responses[key]

    if (!queue || queue.length === 0) {
      callback(new Error(`Unexpected execFile call: ${key}`), "", "")
      return
    }

    const next = queue.shift()
    if (!next) {
      callback(new Error(`Missing execFile response: ${key}`), "", "")
      return
    }

    callback(next.error ?? null, next.stdout ?? "", next.stderr ?? "")
  })
}

describe("bootstrap tenant workspace filesystem", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.getuid = () => 0
    process.getgid = () => 0
  })

  afterEach(() => {
    process.getuid = originalGetuid
    process.getgid = originalGetgid
  })

  it("creates system users through the host namespace in Docker", async () => {
    mockExistsSync.mockImplementation((...callArgs: unknown[]) => {
      const [target] = callArgs
      return target === "/.dockerenv"
    })
    queueExecResponses({
      "nsenter --target 1 --mount -- cat /etc/passwd": [{ stdout: "host-passwd\n" }, { stdout: "host-passwd-2\n" }],
      "nsenter --target 1 --mount -- cat /etc/group": [{ stdout: "host-group\n" }, { stdout: "host-group-2\n" }],
      "nsenter --target 1 --mount -- cat /etc/shadow": [{ stdout: "host-shadow\n" }, { stdout: "host-shadow-2\n" }],
      "nsenter --target 1 --mount -- cat /etc/gshadow": [{ stdout: "host-gshadow\n" }, { stdout: "host-gshadow-2\n" }],
      "nsenter --target 1 --mount -- id -u site-e2e-w0-alive-local": [
        { error: new Error("missing user") },
        { stdout: "1001\n" },
      ],
      "nsenter --target 1 --mount -- id -g site-e2e-w0-alive-local": [{ stdout: "1002\n" }],
      "nsenter --target 1 --mount -- useradd --system --user-group --no-create-home --shell /usr/sbin/nologin site-e2e-w0-alive-local":
        [{ stdout: "" }],
    })

    const ids = await ensureSystemUser("site-e2e-w0-alive-local")

    expect(ids).toEqual({ uid: 1001, gid: 1002 })
    expect(mockExecFile).toHaveBeenCalledWith(
      "nsenter",
      [
        "--target",
        "1",
        "--mount",
        "--",
        "useradd",
        "--system",
        "--user-group",
        "--no-create-home",
        "--shell",
        "/usr/sbin/nologin",
        "site-e2e-w0-alive-local",
      ],
      expect.any(Function),
    )
    expect(mockWriteFile).toHaveBeenCalledWith("/etc/passwd", "host-passwd\n", "utf8")
    expect(mockWriteFile).toHaveBeenCalledWith("/etc/passwd", "host-passwd-2\n", "utf8")
    expect(mockWriteFile).toHaveBeenCalledWith("/etc/group", "host-group\n", "utf8")
    expect(mockWriteFile).toHaveBeenCalledWith("/etc/group", "host-group-2\n", "utf8")
  })

  it("provisions a root-owned test workspace by chowning to the host-created uid/gid", async () => {
    mockExistsSync.mockImplementation((...callArgs: unknown[]) => {
      const [target] = callArgs
      return target === "/.dockerenv"
    })
    queueExecResponses({
      "nsenter --target 1 --mount -- cat /etc/passwd": [{ stdout: "host-passwd\n" }, { stdout: "host-passwd-2\n" }],
      "nsenter --target 1 --mount -- cat /etc/group": [{ stdout: "host-group\n" }, { stdout: "host-group-2\n" }],
      "nsenter --target 1 --mount -- cat /etc/shadow": [{ stdout: "host-shadow\n" }, { stdout: "host-shadow-2\n" }],
      "nsenter --target 1 --mount -- cat /etc/gshadow": [{ stdout: "host-gshadow\n" }, { stdout: "host-gshadow-2\n" }],
      "nsenter --target 1 --mount -- id -u site-e2e-w0-alive-local": [
        { error: new Error("missing user") },
        { stdout: "1001\n" },
      ],
      "nsenter --target 1 --mount -- id -g site-e2e-w0-alive-local": [{ stdout: "1001\n" }],
      "nsenter --target 1 --mount -- useradd --system --user-group --no-create-home --shell /usr/sbin/nologin site-e2e-w0-alive-local":
        [{ stdout: "" }],
      "nsenter --target 1 --mount -- chown -R 1001:1001 /srv/webalive/sites/e2e-w0.alive.local": [{ stdout: "" }],
    })

    await ensureWorkspaceFilesystem("e2e-w0.alive.local")

    expect(mockRm).toHaveBeenCalledWith("/srv/webalive/sites/e2e-w0.alive.local/user", {
      force: true,
      recursive: true,
    })
    expect(mockMkdir).toHaveBeenCalledWith("/srv/webalive/sites/e2e-w0.alive.local/user", {
      mode: 488,
      recursive: true,
    })
    expect(mockWriteFile).toHaveBeenCalledWith(
      "/srv/webalive/sites/e2e-w0.alive.local/user/README.md",
      "# E2E Workspace\n\nThis workspace is provisioned for live staging E2E tests.\n",
      "utf8",
    )
    expect(mockExecFile).toHaveBeenCalledWith(
      "nsenter",
      ["--target", "1", "--mount", "--", "chown", "-R", "1001:1001", "/srv/webalive/sites/e2e-w0.alive.local"],
      expect.any(Function),
    )
  })
})
