import { cn } from "@/lib/cn"

const NAV_ITEMS = [
  { id: "organizations", label: "Organizations" },
  { id: "users", label: "Users" },
  { id: "domains", label: "Domains" },
  { id: "deploys", label: "Deploys" },
  { id: "automations", label: "Automations" },
  { id: "templates", label: "Templates" },
  { id: "feedback", label: "Feedback" },
  { id: "sdk-logs", label: "SDK Logs" },
  { id: "settings", label: "Settings" },
]

interface SidebarProps {
  active: string
  onNavigate: (id: string) => void
  onLogout: () => void
}

export function Sidebar({ active, onNavigate, onLogout }: SidebarProps) {
  return (
    <aside className="w-48 flex-shrink-0 flex flex-col py-5 px-4">
      <div className="px-3 mb-8">
        <span className="text-[15px] font-semibold text-nav-active tracking-tight">alive</span>
      </div>

      <nav className="flex-1 space-y-0.5">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={cn(
              "w-full text-left px-3 py-1.5 rounded-md text-[13px] transition-colors duration-100 cursor-pointer",
              active === item.id ? "text-nav-active font-medium" : "text-nav-text hover:text-nav-hover",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-3">
        <button
          type="button"
          onClick={onLogout}
          className="text-[12px] text-nav-text hover:text-nav-hover transition-colors cursor-pointer"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
