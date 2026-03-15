import { spawnSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

const scriptPath = join(process.cwd(), "scripts", "99-teardown.sh")

function writeExecutable(filePath: string, content: string): void {
  writeFileSync(filePath, content)
  chmodSync(filePath, 0o755)
}

function writeJson(filePath: string, value: Record<string, unknown>): void {
  writeFileSync(filePath, JSON.stringify(value))
}

function createFakeCommands(tempDir: string): { binDir: string; stateDir: string } {
  const binDir = join(tempDir, "bin")
  const stateDir = join(tempDir, "state")
  mkdirSync(binDir, { recursive: true })
  mkdirSync(stateDir, { recursive: true })

  writeExecutable(
    join(binDir, "systemctl"),
    `#!/bin/bash
set -e
cmd="$1"
if [[ "$cmd" == "list-unit-files" ]]; then
  exit 0
fi
if [[ "$cmd" == "reload" ]]; then
  exit 0
fi
if [[ "$cmd" == "stop" || "$cmd" == "disable" || "$cmd" == "daemon-reload" ]]; then
  exit 0
fi
exit 0
`,
  )

  writeExecutable(
    join(binDir, "bun"),
    `#!/bin/bash
echo "$*" >> "$TEST_STATE_DIR/bun-invocations"
exit 0
`,
  )

  writeExecutable(
    join(binDir, "caddy"),
    `#!/bin/bash
exit 0
`,
  )

  writeExecutable(
    join(binDir, "id"),
    `#!/bin/bash
if [[ "$1" == "-u" && "$2" == "$TEST_SITE_USER" ]]; then
  exit 0
fi
exit 1
`,
  )

  writeExecutable(
    join(binDir, "pgrep"),
    `#!/bin/bash
state_dir="$TEST_STATE_DIR"
if [[ "$1" == "-a" && "$2" == "-u" && "$3" == "$TEST_SITE_USER" ]]; then
  if [[ -f "$state_dir/processes-running" ]]; then
    echo "1234 fake-process"
    exit 0
  fi
  exit 1
fi
if [[ "$1" == "-u" && "$2" == "$TEST_SITE_USER" ]]; then
  if [[ -f "$state_dir/processes-running" ]]; then
    echo "1234"
    exit 0
  fi
  exit 1
fi
exit 1
`,
  )

  writeExecutable(
    join(binDir, "pkill"),
    `#!/bin/bash
state_dir="$TEST_STATE_DIR"
mode_file="$state_dir/kill-mode"
mode="term-succeeds"
if [[ -f "$mode_file" ]]; then
  mode="$(cat "$mode_file")"
fi
if [[ "$mode" == "stubborn" ]]; then
  exit 0
fi
rm -f "$state_dir/processes-running"
exit 0
`,
  )

  writeExecutable(
    join(binDir, "userdel"),
    `#!/bin/bash
state_dir="$TEST_STATE_DIR"
if [[ -f "$state_dir/processes-running" ]]; then
  echo "userdel: user $TEST_SITE_USER is currently used by process 1234" >&2
  exit 1
fi
touch "$state_dir/user-removed"
exit 0
`,
  )

  return { binDir, stateDir }
}

function runTeardown(options: { killMode: "term-succeeds" | "stubborn" }) {
  const tempDir = mkdtempSync(join(tmpdir(), "alive-teardown-test-"))
  const { binDir, stateDir } = createFakeCommands(tempDir)
  const streamRoot = join(tempDir, "stream-root")
  const configPath = join(tempDir, "server-config.json")
  const sitesRoot = join(tempDir, "sites")
  const targetDir = join(sitesRoot, "testsite.test.example")
  const symlinkPath = join(sitesRoot, "testsite-test-example")
  const envFilePath = join(tempDir, "testsite-test-example.env")

  mkdirSync(join(streamRoot, "packages", "site-controller"), { recursive: true })
  mkdirSync(targetDir, { recursive: true })
  mkdirSync(sitesRoot, { recursive: true })
  writeFileSync(join(targetDir, "index.html"), "ok")
  symlinkSync(targetDir, symlinkPath)
  writeFileSync(envFilePath, "PORT=3334")
  writeJson(configPath, {
    serverId: "srv_test_server_123456",
    serverIp: "127.0.0.1",
    serverIpv6: "::1",
    automationPrimary: false,
    paths: {
      aliveRoot: streamRoot,
      sitesRoot,
      templatesRoot: "/tmp/templates",
      imagesStorage: "/tmp/storage",
    },
    domains: {
      main: "alive.test",
      wildcard: "alive.test",
      cookieDomain: ".alive.test",
      previewBase: "alive.test",
      frameAncestors: ["https://app.alive.test"],
    },
    urls: {
      prod: "https://app.alive.test",
      staging: "https://staging.alive.test",
      dev: "https://dev.alive.test",
    },
    shell: {
      domains: ["go.alive.test"],
      listen: ":8443",
      upstream: "localhost:3888",
    },
    sentry: {
      dsn: "https://abc123@sentry.example.com/2",
      url: "https://sentry.example.com",
      projectId: "2",
    },
    contactEmail: "ops@example.com",
    previewProxy: {
      port: 5055,
    },
    generated: {
      dir: "/tmp/generated",
      caddySites: "/tmp/generated/Caddyfile.sites",
      caddyShell: "/tmp/generated/Caddyfile.shell",
      nginxMap: "/tmp/generated/nginx.sni.map",
    },
  })
  writeFileSync(join(stateDir, "kill-mode"), options.killMode)
  writeFileSync(join(stateDir, "processes-running"), "1")

  const result = spawnSync("bash", [scriptPath], {
    cwd: streamRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      STREAM_ROOT: streamRoot,
      SERVER_CONFIG_PATH: configPath,
      SITE_DOMAIN: "testsite.test.example",
      SITE_SLUG: "testsite-test-example",
      SERVICE_NAME: "site@testsite-test-example.service",
      REMOVE_USER: "true",
      REMOVE_FILES: "true",
      ENV_FILE_PATH: envFilePath,
      SITES_ROOT: sitesRoot,
      TEST_SITE_USER: "site-testsite-test-example",
      TEST_STATE_DIR: stateDir,
    },
    timeout: 30_000,
  })

  return { tempDir, stateDir, targetDir, envFilePath, symlinkPath, result }
}

describe("99-teardown.sh", () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("kills lingering user processes before removing the user and files", () => {
    const run = runTeardown({ killMode: "term-succeeds" })
    tempDirs.push(run.tempDir)
    const bunInvocations = readFileSync(join(run.stateDir, "bun-invocations"), "utf8")

    expect(run.result.status).toBe(0)
    expect(run.result.stderr).toContain("Stopping lingering processes for user: site-testsite-test-example")
    expect(run.result.stderr).toContain("User removed")
    expect(run.result.stderr).toContain("Files removed")
    expect(run.result.stderr).not.toContain("Failed to remove user")
    expect(run.result.stderr).toContain("Teardown complete: testsite.test.example")
    expect(bunInvocations).toContain("run --cwd packages/site-controller routing:generate")
    expect(bunInvocations).toContain(`${join(run.tempDir, "stream-root", "scripts", "sync-generated-caddy.ts")}`)
  })

  it("fails loudly and never reports success when user removal cannot complete", () => {
    const run = runTeardown({ killMode: "stubborn" })
    tempDirs.push(run.tempDir)

    expect(run.result.status).not.toBe(0)
    expect(run.result.stderr).toContain("Failed to stop processes for site-testsite-test-example")
    expect(run.result.stderr).not.toContain("User removed")
  })
})
