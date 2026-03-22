import { useMemo, useState } from "react"
import { EmptyState } from "@/components/data/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { cn } from "@/lib/cn"
import { useServices } from "./hooks/useServices"

type Filter = "all" | "running" | "failed" | "dead"

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "running", label: "Running" },
  { id: "failed", label: "Failed" },
  { id: "dead", label: "Dead" },
]

export function ServicesPage() {
  const { services, loading, error, refresh } = useServices()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("running")

  const filtered = useMemo(() => {
    let items = services
    if (filter !== "all") {
      items = items.filter(s => s.sub === filter || (filter === "failed" && s.state === "failed"))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    }
    return items
  }, [services, filter, search])

  const counts = useMemo(
    () => ({
      running: services.filter(s => s.sub === "running").length,
      failed: services.filter(s => s.state === "failed").length,
      dead: services.filter(s => s.sub === "dead").length,
    }),
    [services],
  )

  if (loading && services.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load services"
        description={error}
        action={<Button onClick={refresh}>Retry</Button>}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Services"
        description={`${services.length} total`}
        action={
          <Button onClick={refresh} size="sm" loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 220px)" }}>
        <div className="flex items-center gap-4">
          <div className="relative max-w-xs flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <circle cx="5.5" cy="5.5" r="4.25" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 9L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <Input
              placeholder="Search services..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1">
            {FILTERS.map(f => {
              const count = f.id === "all" ? services.length : counts[f.id]
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] rounded-md transition-colors duration-100 cursor-pointer",
                    filter === f.id
                      ? "bg-surface-secondary text-text-primary font-medium"
                      : "text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  {f.label}
                  <span className="ml-1 tabular-nums">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-text-tertiary text-[11px] uppercase tracking-wider">
                <th className="pb-2 pr-4 font-medium w-8" />
                <th className="pb-2 pr-4 font-medium">Service</th>
                <th className="pb-2 pr-4 font-medium w-20">State</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[12px] text-text-tertiary">
                    {search || filter !== "all" ? "No matches" : "No services"}
                  </td>
                </tr>
              ) : (
                filtered.map(s => (
                  <tr key={s.name} className="border-t border-border hover:bg-surface-secondary/50 transition-colors">
                    <td className="py-1.5 pr-2">
                      <span
                        className={cn(
                          "inline-block w-2 h-2 rounded-full",
                          s.state === "failed"
                            ? "bg-red-500"
                            : s.sub === "running"
                              ? "bg-green-500"
                              : s.sub === "exited"
                                ? "bg-yellow-500"
                                : "bg-neutral-500",
                        )}
                      />
                    </td>
                    <td className="py-1.5 pr-4 font-mono text-text-primary text-[12px]">{s.name}</td>
                    <td className="py-1.5 pr-4 text-text-tertiary text-[12px]">{s.sub}</td>
                    <td className="py-1.5 text-text-tertiary text-[12px] truncate max-w-xs">{s.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
