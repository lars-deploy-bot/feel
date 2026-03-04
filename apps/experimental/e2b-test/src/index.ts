import { Sandbox } from "e2b"
import { E2B_DEFAULT_TEMPLATE } from "@webalive/sandbox"

const sandbox = await Sandbox.create(E2B_DEFAULT_TEMPLATE, {
  apiKey: process.env.E2B_API_KEY,
  domain: "e2b.sonno.tech",
})

console.log(`Sandbox ID: ${sandbox.sandboxId}`)

// Run a command
const result = await sandbox.commands.run("echo 'Hello from E2B!'")
console.log(`stdout: ${result.stdout.trim()}`)
console.log(`exitCode: ${result.exitCode}`)

// Write + read a file
await sandbox.files.write("/home/user/test.txt", "E2B works from alive!")
const content = await sandbox.files.read("/home/user/test.txt")
console.log(`File content: ${content}`)

// System info
const info = await sandbox.commands.run("uname -a")
console.log(`System: ${info.stdout.trim()}`)

await sandbox.kill()
console.log("Done — sandbox killed.")
