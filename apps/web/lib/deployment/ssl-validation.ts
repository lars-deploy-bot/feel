interface NodeError extends Error {
  code?: string
}

function isNodeError(error: unknown): error is NodeError {
  return error instanceof Error && "code" in error
}

export interface SSLValidationResult {
  success: boolean
  error?: string
}

export async function validateSSLCertificate(domain: string): Promise<SSLValidationResult> {
  const maxAttempts = 12
  const delayMs = 5000

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[SSL CHECK] Attempt ${attempt}/${maxAttempts} for ${domain}`)

      // Use GET to verify the site actually returns content, not just HEAD
      const response = await fetch(`https://${domain}`, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      })

      // Only consider 200-299 as success (site is serving content)
      // Don't accept 404, 500, etc. - the site should be fully working
      if (response.ok) {
        const contentType = response.headers.get("content-type")
        console.log(`[SSL CHECK] Site ready for ${domain} (status: ${response.status}, content-type: ${contentType})`)
        return { success: true }
      }

      console.log(`[SSL CHECK] Site not ready - status ${response.status} for ${domain}`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log(`[SSL CHECK] Attempt ${attempt} failed: ${errorMessage}`)

      const errorCode = isNodeError(error) ? error.code : undefined
      const isExpectedError =
        (error instanceof Error && error.name === "TimeoutError") ||
        errorCode === "ECONNREFUSED" ||
        errorCode === "ENOTFOUND" ||
        errorMessage.includes("certificate") ||
        errorMessage.includes("SSL") ||
        errorMessage.includes("TLS")

      if (!isExpectedError) {
        console.error(`[SSL CHECK] Unexpected error: ${error}`)
      }
    }

    if (attempt < maxAttempts) {
      console.log(`[SSL CHECK] Waiting ${delayMs / 1000}s before next attempt...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return {
    success: false,
    error: `Site not ready after ${(maxAttempts * delayMs) / 1000} seconds. The site may still be starting up.`,
  }
}
