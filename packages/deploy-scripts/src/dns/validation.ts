import { execSync } from "child_process"
import { DeploymentError } from "../orchestration/errors"

const WILDCARD_DOMAIN = "alive.best"
const SERVER_IP = "138.201.56.93"

export async function validateDNS(domain: string) {
  const dnsResolve = async (host: string, type: string = "A"): Promise<string[]> => {
    try {
      const result = execSync(`dig +short ${host} ${type} 2>/dev/null || echo ""`)
        .toString()
        .trim()
      return result ? result.split("\n") : []
    } catch {
      return []
    }
  }

  const ips = await dnsResolve(domain, "A")
  if (ips.length === 0) {
    throw new DeploymentError(
      `DNS Error: No A record found for ${domain}\n   You must create an A record pointing to ${SERVER_IP}`,
    )
  }

  const domainIP = ips[0]
  if (domainIP !== SERVER_IP) {
    if (isCloudflareIP(domainIP)) {
      throw new DeploymentError(
        `DNS Error: ${domain} points to ${domainIP} (Cloudflare proxy)\n   Disable the orange cloud in Cloudflare DNS settings`,
      )
    }
    throw new DeploymentError(
      `DNS Error: ${domain} points to ${domainIP}, but must point to ${SERVER_IP}`,
    )
  }

  // Check AAAA records
  const aaaaRecords = await dnsResolve(domain, "AAAA")
  if (aaaaRecords.length > 0) {
    console.warn(`⚠️  WARNING: AAAA records detected for ${domain}`)
  }
}

export function isCloudflareIP(ip: string): boolean {
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

export function shouldSkipDNSValidation(domain: string): boolean {
  return domain.endsWith(`.${WILDCARD_DOMAIN}`)
}

export { WILDCARD_DOMAIN, SERVER_IP }
