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
  const maxAttempts = 6
  const delayMs = 10000

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[SSL CHECK] Attempt ${attempt}/${maxAttempts} for ${domain}`)

      const response = await fetch(`https://${domain}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok || response.status === 404) {
        console.log(`[SSL CHECK] Valid SSL certificate for ${domain} (status: ${response.status})`)
        return { success: true }
      }

      console.log(`[SSL CHECK] Unexpected status ${response.status} for ${domain}`)
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
    error: `SSL certificate not ready after ${(maxAttempts * delayMs) / 1000} seconds. Certificate provisioning may still be in progress.`,
  }
}
