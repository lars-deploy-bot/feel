import { useMemo, useState } from "react"
import { EmptyState } from "@/components/data/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { useProcesses } from "./hooks/useProcesses"

export function ProcessesPage() {
  const { processes, loading, error, refresh } = useProcesses()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search.trim()) return processes
    const q = search.toLowerCase()
    return processes.filter(
      p => p.command.toLowerCase().includes(q) || p.user.toLowerCase().includes(q) || String(p.pid).includes(q),
    )
  }, [processes, search])

  if (loading && processes.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load processes"
        description={error}
        action={<Button onClick={refresh}>Retry</Button>}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Processes"
        description={`Top ${processes.length} by CPU`}
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
            placeholder="Search command, user, or PID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-text-tertiary text-[11px] uppercase tracking-wider">
                <th className="pb-2 pr-4 font-medium w-20">PID</th>
                <th className="pb-2 pr-4 font-medium w-24">User</th>
                <th className="pb-2 pr-4 font-medium w-16">CPU%</th>
                <th className="pb-2 pr-4 font-medium w-16">MEM%</th>
                <th className="pb-2 pr-4 font-medium w-16">RSS</th>
                <th className="pb-2 font-medium">Command</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[12px] text-text-tertiary">
                    {search ? "No matches" : "No processes"}
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.pid} className="border-t border-border hover:bg-surface-secondary/50 transition-colors">
                    <td className="py-1.5 pr-4 font-mono text-text-primary tabular-nums text-[12px]">{p.pid}</td>
                    <td className="py-1.5 pr-4 text-text-secondary text-[12px]">{p.user}</td>
                    <td className="py-1.5 pr-4 font-mono tabular-nums text-[12px] text-text-secondary">
                      {p.cpu.toFixed(1)}
                    </td>
                    <td className="py-1.5 pr-4 font-mono tabular-nums text-[12px] text-text-secondary">
                      {p.mem.toFixed(1)}
                    </td>
                    <td className="py-1.5 pr-4 font-mono tabular-nums text-[12px] text-text-tertiary">{p.rss}</td>
                    <td className="py-1.5 text-text-tertiary text-[12px] truncate max-w-md font-mono">{p.command}</td>
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
