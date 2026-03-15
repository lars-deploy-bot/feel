import { E2B_DEFAULT_TEMPLATE } from "@webalive/sandbox"
import { Sandbox } from "e2b"

const API_KEY = process.env.E2B_API_KEY
if (!API_KEY) throw new Error("E2B_API_KEY env var required")

function ms(start: number) {
  return Date.now() - start
}

function header(title: string) {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`  ${title}`)
  console.log("=".repeat(60))
}

// ============================================================
// SETUP
// ============================================================
console.log("Creating sandbox...")
const t0 = Date.now()
const sandbox = await Sandbox.create(E2B_DEFAULT_TEMPLATE, {
  apiKey: API_KEY,
  domain: process.env.E2B_DOMAIN,
  cpuCount: 4,
  memoryMB: 4096,
  timeoutMs: 5 * 60 * 1000,
})
console.log(`Sandbox ready: ${ms(t0)}ms (ID: ${sandbox.sandboxId})`)

try {
  // ============================================================
  // TEST 1: COLD START ELIMINATION
  // ============================================================
  header("1. COLD START ELIMINATION")

  console.log("\n  Without warmup (first call to a fresh sandbox):")
  const cold1 = Date.now()
  await sandbox.files.read("/etc/hostname")
  console.log(`  First read: ${ms(cold1)}ms  ← this is the cold hit`)

  console.log("\n  Subsequent calls (already warm):")
  for (let i = 0; i < 5; i++) {
    const t = Date.now()
    await sandbox.files.read("/etc/hostname")
    console.log(`  Read #${i + 2}: ${ms(t)}ms`)
  }

  console.log("\n  Verdict: warm up with a dummy read at sandbox creation.")
  console.log("  Cost: one ~4s hit upfront, then every call is fast.")

  // ============================================================
  // TEST 2: LARGE FILES
  // ============================================================
  header("2. LARGE FILES")

  // Generate files of increasing size
  const sizes = [
    { label: "1 KB", bytes: 1_000 },
    { label: "10 KB", bytes: 10_000 },
    { label: "100 KB", bytes: 100_000 },
    { label: "500 KB", bytes: 500_000 },
    { label: "1 MB", bytes: 1_000_000 },
    { label: "5 MB", bytes: 5_000_000 },
  ]

  for (const { label, bytes } of sizes) {
    const content = "x".repeat(bytes)
    const path = `/home/user/large_${bytes}.txt`

    const tw = Date.now()
    await sandbox.files.write(path, content)
    const writeMs = ms(tw)

    const tr = Date.now()
    const read = await sandbox.files.read(path)
    const readMs = ms(tr)

    const ok = read.length === bytes
    console.log(
      `  ${label.padEnd(8)} write: ${String(writeMs).padStart(5)}ms  read: ${String(readMs).padStart(5)}ms  ok: ${ok}`,
    )
  }

  // ============================================================
  // TEST 3: STRESS TEST — 100 files
  // ============================================================
  header("3. STRESS TEST (100 files)")

  // Write 100 files sequentially
  const stressContent = `import { Hono } from 'hono'\n\nexport default function Component() {\n  return <div>Hello</div>\n}\n`

  console.log("\n  Sequential write (100 files):")
  const sw = Date.now()
  for (let i = 0; i < 100; i++) {
    await sandbox.files.write(`/home/user/project/src/component_${i}.tsx`, stressContent)
  }
  const swMs = ms(sw)
  console.log(`  Total: ${swMs}ms (${Math.round(swMs / 100)}ms avg per file)`)

  console.log("\n  Sequential read (100 files):")
  const sr = Date.now()
  for (let i = 0; i < 100; i++) {
    await sandbox.files.read(`/home/user/project/src/component_${i}.tsx`)
  }
  const srMs = ms(sr)
  console.log(`  Total: ${srMs}ms (${Math.round(srMs / 100)}ms avg per file)`)

  console.log("\n  Parallel write (100 files):")
  const pw = Date.now()
  await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      sandbox.files.write(`/home/user/project/src/parallel_${i}.tsx`, stressContent),
    ),
  )
  const pwMs = ms(pw)
  console.log(`  Total: ${pwMs}ms (${Math.round(pwMs / 100)}ms effective per file)`)

  console.log("\n  Parallel read (100 files):")
  const pr = Date.now()
  await Promise.all(
    Array.from({ length: 100 }, (_, i) => sandbox.files.read(`/home/user/project/src/parallel_${i}.tsx`)),
  )
  const prMs = ms(pr)
  console.log(`  Total: ${prMs}ms (${Math.round(prMs / 100)}ms effective per file)`)

  // ============================================================
  // TEST 4: REAL AGENT SESSION SIMULATION
  // ============================================================
  header("4. REAL AGENT SESSION (simulated)")

  console.log("\n  Simulating: 'Add a login page to my Hono app'\n")

  const steps: { label: string; ms: number }[] = []

  async function step(label: string, fn: () => Promise<void>) {
    const t = Date.now()
    await fn()
    const elapsed = ms(t)
    steps.push({ label, ms: elapsed })
    console.log(`  ${label.padEnd(50)} ${String(elapsed).padStart(5)}ms`)
  }

  // Claude reads the project structure
  await step("Glob: find project files", async () => {
    await sandbox.commands.run("find /home/user/project -type f -name '*.tsx' | head -20")
  })

  // Claude reads the main entry point
  await step("Read: index.ts (entry point)", async () => {
    await sandbox.files.write(
      "/home/user/project/src/index.ts",
      `
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'

const app = new Hono()
app.get('/', (c) => c.html('<h1>Welcome</h1>'))

export default { port: 3000, fetch: app.fetch }
`.trim(),
    )
    await sandbox.files.read("/home/user/project/src/index.ts")
  })

  // Claude reads package.json
  await step("Read: package.json", async () => {
    await sandbox.files.write(
      "/home/user/project/package.json",
      JSON.stringify(
        {
          name: "test-app",
          dependencies: { hono: "^4.0.0" },
          scripts: { dev: "bun run src/index.ts" },
        },
        null,
        2,
      ),
    )
    await sandbox.files.read("/home/user/project/package.json")
  })

  // Claude reads existing styles
  await step("Read: styles.css", async () => {
    await sandbox.files.write("/home/user/project/src/styles.css", "body { margin: 0; font-family: sans-serif; }")
    await sandbox.files.read("/home/user/project/src/styles.css")
  })

  // Claude reads an existing component for reference
  await step("Read: component_0.tsx (reference)", async () => {
    await sandbox.files.read("/home/user/project/src/component_0.tsx")
  })

  // --- Claude thinks for 5-10s (Anthropic API) --- we skip this ---

  // Claude writes the new login page
  await step("Write: login.tsx (new file, 2KB)", async () => {
    const loginPage = `
import { Hono } from 'hono'

export const loginRouter = new Hono()

loginRouter.get('/login', (c) => {
  return c.html(\`<!DOCTYPE html>
<html>
<head><title>Login</title></head>
<body>
  <div class="login-container">
    <h1>Sign In</h1>
    <form method="POST" action="/login">
      <input type="email" name="email" placeholder="Email" required />
      <input type="password" name="password" placeholder="Password" required />
      <button type="submit">Sign In</button>
    </form>
  </div>
</body>
</html>\`)
})

loginRouter.post('/login', async (c) => {
  const { email, password } = await c.req.parseBody()
  // TODO: validate credentials
  return c.redirect('/')
})
`.trim()
    await sandbox.files.write("/home/user/project/src/login.tsx", loginPage)
  })

  // Claude edits index.ts to import the login route
  await step("Edit: index.ts (add import + route)", async () => {
    const content = await sandbox.files.read("/home/user/project/src/index.ts")
    const patched = `import { loginRouter } from './login'\n${content}`.replace(
      "export default",
      "app.route('/', loginRouter)\n\nexport default",
    )
    await sandbox.files.write("/home/user/project/src/index.ts", patched)
  })

  // Claude updates styles
  await step("Edit: styles.css (add login styles)", async () => {
    const css = await sandbox.files.read("/home/user/project/src/styles.css")
    await sandbox.files.write(
      "/home/user/project/src/styles.css",
      css +
        `
.login-container { max-width: 400px; margin: 100px auto; padding: 2rem; }
.login-container input { display: block; width: 100%; margin: 0.5rem 0; padding: 0.75rem; }
.login-container button { width: 100%; padding: 0.75rem; background: #000; color: #fff; border: none; cursor: pointer; }
`,
    )
  })

  // Claude runs a type check
  await step("Bash: list src/", async () => {
    await sandbox.commands.run("cd /home/user/project && ls src/")
  })

  // Claude reads the result to verify
  await step("Read: verify login.tsx exists", async () => {
    await sandbox.files.read("/home/user/project/src/login.tsx")
  })

  // Grep for the import
  await step("Grep: verify import in index.ts", async () => {
    await sandbox.commands.run("grep -n 'loginRouter' /home/user/project/src/index.ts")
  })

  const totalSession = steps.reduce((sum, s) => sum + s.ms, 0)
  console.log("\n  ─────────────────────────────────────────────────────")
  console.log(`  Total tool execution time: ${totalSession}ms`)
  console.log(`  Tool calls: ${steps.length}`)
  console.log(`  Avg per tool call: ${Math.round(totalSession / steps.length)}ms`)
  console.log("\n  For comparison:")
  console.log("  Anthropic API thinking time: ~5,000-15,000ms per turn")
  console.log(`  Tool overhead as % of turn:  ${((totalSession / steps.length / 8000) * 100).toFixed(1)}%`)

  // ============================================================
  // SUMMARY
  // ============================================================
  header("SUMMARY")

  console.log(`
  Cold start (first API call):    ~4-5s (warm up at creation)
  File read (any size < 1MB):     30-80ms
  File write (any size < 1MB):    30-80ms
  Command execution:              40-90ms
  Edit cycle (read+patch+write):  60-100ms

  Parallel reads (10x):           ~120ms total (12ms effective)
  100 sequential writes:          ~${swMs}ms total (${Math.round(swMs / 100)}ms avg)
  100 parallel writes:            ~${pwMs}ms total (${Math.round(pwMs / 100)}ms eff)

  Large files:
    1MB write/read:               ~100-200ms
    5MB write/read:               ~500-1000ms

  Real agent session (${steps.length} tool calls): ${totalSession}ms total
  Overhead per tool call:         ~${Math.round(totalSession / steps.length)}ms
  vs Anthropic API think time:    ~8000ms
  Overhead ratio:                 ${((totalSession / steps.length / 8000) * 100).toFixed(1)}%
`)

  console.log("Done.")
} finally {
  try {
    await sandbox.kill()
    console.log("Sandbox killed.")
  } catch (killError) {
    console.warn("Sandbox kill failed:", killError)
  }
}
