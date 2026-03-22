import { useMemo, useState } from "react"
import { EmptyState } from "@/components/data/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { cn } from "@/lib/cn"
import { useDocker } from "./hooks/useDocker"

export function DockerPage() {
  const { containers, loading, error, refresh } = useDocker()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search.trim()) return containers
    const q = search.toLowerCase()
    return containers.filter(
      c => c.name.toLowerCase().includes(q) || c.image.toLowerCase().includes(q) || c.ports.toLowerCase().includes(q),
    )
  }, [containers, search])

  const running = containers.filter(c => c.state === "running").length

  if (loading && containers.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load containers"
        description={error}
        action={<Button onClick={refresh}>Retry</Button>}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Docker"
        description={`${running} running, ${containers.length} total`}
        action={
          <Button onClick={refresh} size="sm" loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 220px)" }}>
        <div className="relative max-w-xs">
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
            placeholder="Search name, image, or ports..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-text-tertiary text-[11px] uppercase tracking-wider">
                <th className="pb-2 pr-2 font-medium w-8" />
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Image</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Ports</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[12px] text-text-tertiary">
                    {search ? "No matches" : "No containers"}
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="border-t border-border hover:bg-surface-secondary/50 transition-colors">
                    <td className="py-1.5 pr-2">
                      <span
                        className={cn(
                          "inline-block w-2 h-2 rounded-full",
                          c.state === "running" ? "bg-green-500" : "bg-neutral-500",
                        )}
                      />
                    </td>
                    <td className="py-1.5 pr-4 font-mono text-text-primary text-[12px]">{c.name}</td>
                    <td className="py-1.5 pr-4 text-text-secondary text-[12px] truncate max-w-[200px]">{c.image}</td>
                    <td className="py-1.5 pr-4 text-text-tertiary text-[12px]">{c.status}</td>
                    <td className="py-1.5 text-text-tertiary text-[11px] font-mono truncate max-w-xs">{c.ports}</td>
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
