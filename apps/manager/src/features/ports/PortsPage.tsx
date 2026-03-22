import { useMemo, useState } from "react"
import { EmptyState } from "@/components/data/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { usePorts } from "./hooks/usePorts"

export function PortsPage() {
  const { ports, loading, error, refresh } = usePorts()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search.trim()) return ports
    const q = search.toLowerCase()
    return ports.filter(
      p => String(p.port).includes(q) || p.process.toLowerCase().includes(q) || String(p.pid).includes(q),
    )
  }, [ports, search])

  if (loading && ports.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState title="Failed to load ports" description={error} action={<Button onClick={refresh}>Retry</Button>} />
    )
  }

  return (
    <>
      <PageHeader
        title="Ports"
        description={`${ports.length} listening`}
        action={
          <Button onClick={refresh} size="sm" loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 220px)" }}>
        {/* Search */}
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
            placeholder="Search port, process, or PID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {search.trim() && filtered.length !== ports.length && (
          <p className="text-[12px] text-text-tertiary px-1">
            {filtered.length} of {ports.length}
          </p>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-text-tertiary text-[11px] uppercase tracking-wider">
                <th className="pb-2 pr-6 font-medium w-24">Port</th>
                <th className="pb-2 pr-6 font-medium">Process</th>
                <th className="pb-2 font-medium w-24">PID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-[12px] text-text-tertiary">
                    {search ? "No matches" : "No listening ports"}
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr
                    key={`${p.port}-${p.pid}`}
                    className="border-t border-border hover:bg-surface-secondary/50 transition-colors"
                  >
                    <td className="py-2 pr-6 font-mono text-text-primary font-medium tabular-nums">{p.port}</td>
                    <td className="py-2 pr-6 text-text-secondary">{p.process}</td>
                    <td className="py-2 font-mono text-text-tertiary tabular-nums">{p.pid}</td>
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
