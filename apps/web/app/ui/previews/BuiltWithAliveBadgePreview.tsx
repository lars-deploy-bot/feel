"use client"

import { useState } from "react"
import { useDomainConfig } from "@/lib/providers/DomainConfigProvider"

/**
 * Preview for the "Built with Alive" badge widget.
 *
 * Designs the badge as a React component first, then the final
 * version gets ported to vanilla JS in apps/widget-server/main.go.
 *
 * Current design: "The Secret" — dark popup, conspiratorial copy.
 */

const STYLES = `
  @keyframes aliveGlow {
    0%, 100% { box-shadow: 0 0 4px 1px rgba(52, 211, 153, 0.2), 0 0 8px 2px rgba(52, 211, 153, 0.1); }
    50% { box-shadow: 0 0 8px 3px rgba(52, 211, 153, 0.4), 0 0 16px 6px rgba(52, 211, 153, 0.15); }
  }
  @keyframes aliveUp {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes aliveReveal {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
`

function AliveBadge({ hostname, appDomain }: { hostname?: string; appDomain: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const displayHostname = hostname ?? `example.${appDomain}`

  return (
    <div className="relative inline-flex flex-col items-end">
      <style>{STYLES}</style>
      {isOpen && (
        <>
          {/* biome-ignore lint: overlay click handler */}
          <div className="fixed inset-0 z-[9997] bg-black/20 sm:bg-transparent" onClick={() => setIsOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 sm:absolute sm:bottom-full sm:left-auto sm:right-0 sm:mb-2 z-[9998]"
            style={{ animation: "aliveUp 300ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
          >
            <div className="sm:w-[280px] sm:ml-auto rounded-t-2xl sm:rounded-2xl bg-zinc-950 border-t border-white/[0.06] sm:border shadow-[0_-8px_40px_rgba(0,0,0,0.3)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
              <div className="p-5">
                <div style={{ animation: "aliveReveal 300ms ease-out 100ms both" }}>
                  <p className="text-[15px] text-white font-medium leading-snug tracking-tight">
                    This site was built
                    <br />
                    by <em className="not-italic text-emerald-400">talking to it.</em>
                  </p>
                </div>
                <p
                  className="text-[12px] text-zinc-500 mt-3 leading-relaxed"
                  style={{ animation: "aliveReveal 300ms ease-out 350ms both" }}
                >
                  Describe what you want. Watch it happen live.
                </p>
                <div className="mt-5 space-y-2" style={{ animation: "aliveReveal 300ms ease-out 500ms both" }}>
                  <a
                    href={`https://app.${appDomain}/chat?wk=${displayHostname}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/cta flex items-center justify-between w-full px-4 py-3 sm:py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 active:bg-emerald-500/20 transition-colors duration-200 no-underline"
                  >
                    <span className="text-[13px] font-medium text-emerald-400 group-hover/cta:text-emerald-300 transition-colors">
                      Edit this site
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="text-emerald-500/50 group-hover/cta:text-emerald-400 transition-all duration-200 shrink-0"
                    >
                      <path
                        d="M6 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                  <a
                    href={`https://app.${appDomain}/chat`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/b flex items-center justify-between w-full px-4 py-3 sm:py-2.5 rounded-xl hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors duration-200 no-underline"
                  >
                    <span className="text-[12px] text-zinc-600 group-hover/b:text-zinc-400 transition-colors">
                      Make your own
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="text-zinc-700 group-hover/b:text-zinc-500 transition-all duration-200 shrink-0"
                    >
                      <path
                        d="M6 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                </div>
              </div>
              <div className="h-[env(safe-area-inset-bottom)] sm:hidden" />
            </div>
          </div>
        </>
      )}

      {/* Badge trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white transition-all duration-300 cursor-pointer ${
          isOpen
            ? "border-emerald-200/60 shadow-[0_0_12px_rgba(52,211,153,0.15)]"
            : "border-zinc-200/50 hover:border-emerald-200/60 hover:shadow-[0_0_12px_rgba(52,211,153,0.15)]"
        }`}
      >
        <span
          className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shrink-0"
          style={{ animation: "aliveGlow 3s ease-in-out infinite" }}
        />
        <span
          className={`text-[11px] font-medium transition-colors duration-300 ${isOpen ? "text-emerald-700" : "text-zinc-400 group-hover:text-emerald-700"}`}
        >
          alive
        </span>
      </button>
    </div>
  )
}

// --- Preview ---

export function BuiltWithAliveBadgePreview() {
  const { main } = useDomainConfig()
  return (
    <div className="space-y-12">
      {/* Light background */}
      <section>
        <h3 className="text-sm font-medium text-black/60 dark:text-white/60 mb-4">Light Background</h3>
        <div className="relative bg-zinc-50 rounded-2xl border border-zinc-200 p-8 min-h-[280px] flex flex-col">
          <div className="flex-1 space-y-3 max-w-sm">
            <div className="h-5 w-48 bg-zinc-200 rounded" />
            <div className="h-3 w-72 bg-zinc-100 rounded" />
            <div className="h-3 w-64 bg-zinc-100 rounded" />
            <div className="h-3 w-56 bg-zinc-100 rounded" />
            <div className="h-24 w-full bg-zinc-100 rounded-lg mt-4" />
          </div>
          <div className="flex justify-end mt-6">
            <AliveBadge hostname={`loodgieter.${main}`} appDomain={main} />
          </div>
        </div>
      </section>

      {/* Dark background */}
      <section>
        <h3 className="text-sm font-medium text-black/60 dark:text-white/60 mb-4">Dark Background</h3>
        <div className="relative bg-zinc-950 rounded-2xl border border-zinc-800 p-8 min-h-[280px] flex flex-col">
          <div className="flex-1 space-y-3 max-w-sm">
            <div className="h-5 w-48 bg-zinc-800 rounded" />
            <div className="h-3 w-72 bg-zinc-900 rounded" />
            <div className="h-3 w-64 bg-zinc-900 rounded" />
            <div className="h-3 w-56 bg-zinc-900 rounded" />
            <div className="h-24 w-full bg-zinc-900 rounded-lg mt-4" />
          </div>
          <div className="flex justify-end mt-6">
            <AliveBadge hostname={`loodgieter.${main}`} appDomain={main} />
          </div>
        </div>
      </section>
    </div>
  )
}
