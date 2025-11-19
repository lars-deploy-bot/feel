import { promises as fs } from "fs"
import { resolve } from "path"

const CADDYFILE_PATH = "/root/webalive/claude-bridge/Caddyfile"

export function generateCaddyfileBlock(domain: string, port: number): string {
  return `# Auto-generated Caddyfile for ${domain}
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
}

export async function updateCaddyfile(domain: string, port: number) {
  let content = await fs.readFile(CADDYFILE_PATH, "utf-8")
  const domainBlock = `${domain} {`

  if (content.includes(domainBlock)) {
    const blockRegex = new RegExp(`${domain.replace(/\./g, "\\.")} \\{[\\s\\S]*?localhost:(\\d+)`)
    content = content.replace(blockRegex, `${domain} {\n    import common_headers\n    reverse_proxy localhost:${port}`)
  } else {
    content += `\n${generateCaddyfileBlock(domain, port)}`
  }

  await fs.writeFile(CADDYFILE_PATH, content)
}

export async function createSiteCaddyfile(sitePath: string, domain: string, port: number) {
  const siteCaddyfile = resolve(sitePath, "Caddyfile")
  await fs.writeFile(siteCaddyfile, generateCaddyfileBlock(domain, port))
}

export { CADDYFILE_PATH }
