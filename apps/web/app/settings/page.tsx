import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { SettingsPageClient } from "@/components/settings/SettingsPageClient"

/**
 * Settings Page (Server Component)
 *
 * Wraps the client component in Suspense to handle useSearchParams
 * which requires a Suspense boundary for static generation.
 */
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      }
    >
      <SettingsPageClient />
    </Suspense>
  )
}
