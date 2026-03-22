import { useMemo, useState } from "react"
import { EmptyState } from "@/components/data/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { useDisk } from "./hooks/useDisk"

export function DiskPage() {
  const { overview, sites, loading, error, refresh } = useDisk()
  const [search, setSearch] = useState("")

  const filteredSites = useMemo(() => {
    if (!search.trim()) return sites
    const q = search.toLowerCase()
    return sites.filter(s => s.site.toLowerCase().includes(q))
  }, [sites, search])

  if (loading && overview.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load disk data"
        description={error}
        action={<Button onClick={refresh}>Retry</Button>}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Disk"
        description={`${sites.length} sites`}
        action={
          <Button onClick={refresh} size="sm" loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="flex flex-col gap-6" style={{ height: "calc(100vh - 220px)" }}>
        {/* Filesystem overview */}
        <div>
          <h2 className="text-[12px] text-text-tertiary uppercase tracking-wider font-medium mb-2">Filesystems</h2>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-text-tertiary text-[11px] uppercase tracking-wider">
                <th className="pb-2 pr-4 font-medium">Mount</th>
                <th className="pb-2 pr-4 font-medium w-20">Size</th>
                <th className="pb-2 pr-4 font-medium w-20">Used</th>
                <th className="pb-2 pr-4 font-medium w-20">Avail</th>
                <th className="pb-2 font-medium w-16">Use%</th>
              </tr>
            </thead>
            <tbody>
              {overview.map(d => (
                <tr key={d.mount} className="border-t border-border">
                  <td className="py-1.5 pr-4 font-mono text-text-primary text-[12px]">{d.mount}</td>
                  <td className="py-1.5 pr-4 text-text-secondary tabular-nums">{d.size}</td>
                  <td className="py-1.5 pr-4 text-text-secondary tabular-nums">{d.used}</td>
                  <td className="py-1.5 pr-4 text-text-secondary tabular-nums">{d.available}</td>
                  <td className="py-1.5 text-text-secondary tabular-nums">{d.usePercent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per-site usage */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-[12px] text-text-tertiary uppercase tracking-wider font-medium">Sites by size</h2>
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
                placeholder="Search sites..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-text-tertiary text-[11px] uppercase tracking-wider">
                  <th className="pb-2 pr-4 font-medium">Site</th>
                  <th className="pb-2 font-medium w-24">Size</th>
                </tr>
              </thead>
              <tbody>
                {filteredSites.map(s => (
                  <tr key={s.site} className="border-t border-border hover:bg-surface-secondary/50 transition-colors">
                    <td className="py-1.5 pr-4 text-text-primary text-[12px]">{s.site}</td>
                    <td className="py-1.5 font-mono text-text-secondary tabular-nums text-[12px]">{s.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
