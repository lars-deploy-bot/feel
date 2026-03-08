export async function checkSlugAvailability(slug: string): Promise<{ available: boolean | null; error?: string }> {
  try {
    const res = await fetch(`/api/sites/check-availability?slug=${encodeURIComponent(slug.toLowerCase())}`)
    const data = await res.json()

    if (!res.ok) {
      const errorMessage = data?.details?.error || data?.message || "Failed to check availability"
      console.error("[checkSlugAvailability] API returned non-OK status:", res.status, errorMessage)
      return { available: null, error: errorMessage }
    }

    return { available: data.available }
  } catch (error) {
    console.error("[checkSlugAvailability] Request failed:", error)
    return { available: null, error: "Network error" }
  }
}
