import path from "node:path"
import { fileURLToPath } from "node:url"
import { Template } from "e2b"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dockerfilePath = path.resolve(__dirname, "../../templates/e2b/alive-e2e-minimal/e2b.Dockerfile")

const template = Template().fromDockerfile(dockerfilePath)

async function main() {
  console.log("Building alive-e2e-minimal template from:", dockerfilePath)

  await Template.build(template, {
    alias: "alive-e2e-minimal",
    cpuCount: Number(process.env.E2B_TEMPLATE_CPU_COUNT || "1"),
    memoryMB: Number(process.env.E2B_TEMPLATE_MEMORY_MB || "512"),
    skipCache: process.env.E2B_TEMPLATE_SKIP_CACHE !== "0",
    onBuildLogs: (it) => console.log(it.toString()),
  })

  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
