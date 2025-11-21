/**
 * Domain Transfer Service
 * Handles transferring domains between organizations
 */

export async function transferDomain(domain: string, targetOrgId: string): Promise<{
  success: boolean
  message: string
}> {
  const response = await fetch("/api/manager/domains/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, targetOrgId }),
  })

  const data = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to transfer domain")
  }

  return data
}
