import { cn } from "@/lib/cn"

interface SidebarItem {
  id: string
  label: string
  icon: string
}

const NAV_ITEMS: SidebarItem[] = [
  { id: "organizations", label: "Organizations", icon: "🏢" },
  { id: "users", label: "Users", icon: "👤" },
  { id: "domains", label: "Domains", icon: "🌐" },
  { id: "templates", label: "Templates", icon: "📄" },
  { id: "feedback", label: "Feedback", icon: "💬" },
  { id: "settings", label: "Settings", icon: "⚙️" },
]

interface SidebarProps {
  active: string
  onNavigate: (id: string) => void
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="w-56 flex-shrink-0 bg-surface border-r border-border h-screen sticky top-0 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <span className="text-sm font-semibold text-text-primary tracking-tight">Alive Manager</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-100 cursor-pointer",
              active === item.id
                ? "bg-accent-subtle text-accent font-medium"
                : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
            )}
          >
            <span className="text-base leading-none w-5 text-center">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <p className="text-[10px] text-text-tertiary uppercase tracking-widest">Alive v2</p>
      </div>
    </aside>
  )
}
