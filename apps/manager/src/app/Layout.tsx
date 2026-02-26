import { Sidebar } from "@/components/layout/Sidebar"
import { useRoute } from "@/lib/useRoute"
import { Router } from "./Router"

interface LayoutProps {
  onLogout: () => void
}

export function Layout({ onLogout }: LayoutProps) {
  const { page, navigate } = useRoute()

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar active={page} onNavigate={navigate} onLogout={onLogout} />
      <main className="flex-1 m-2 ml-0 bg-surface rounded-card overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <Router page={page} />
        </div>
      </main>
    </div>
  )
}
