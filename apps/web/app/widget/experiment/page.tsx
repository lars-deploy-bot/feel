"use client"

import { useState } from "react"

const STYLES = `
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 4px 1px rgba(52, 211, 153, 0.2), 0 0 8px 2px rgba(52, 211, 153, 0.1); }
    50% { box-shadow: 0 0 8px 3px rgba(52, 211, 153, 0.4), 0 0 16px 6px rgba(52, 211, 153, 0.15); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes reveal {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes gradientSlide {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes slideRight {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(3px); }
  }
  @keyframes ripple {
    0% { transform: scale(1); opacity: 0.5; }
    100% { transform: scale(2.5); opacity: 0; }
  }
`

/** Dot with optional ripple. Explicit sizing prevents the ellipse bug. */
function Dot({ ripple: showRipple = false, size = "sm" }: { ripple?: boolean; size?: "sm" | "md" }) {
  const px = size === "md" ? "h-2.5 w-2.5" : "h-2 w-2"
  return (
    <span className={`relative inline-flex ${px} shrink-0`}>
      <span
        className={`inline-flex ${px} rounded-full bg-emerald-400`}
        style={{ animation: "glow 3s ease-in-out infinite" }}
      />
      {showRipple && (
        <span
          className={`absolute inset-0 ${px} rounded-full bg-emerald-400/40`}
          style={{ animation: "ripple 2s ease-out infinite" }}
        />
      )}
    </span>
  )
}

function Badge({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white transition-all duration-300 cursor-pointer ${
        isOpen
          ? "border-emerald-200/60 shadow-[0_0_12px_rgba(52,211,153,0.15)]"
          : "border-zinc-200/50 hover:border-emerald-200/60 hover:shadow-[0_0_12px_rgba(52,211,153,0.15)]"
      }`}
    >
      <Dot />
      <span
        className={`text-[11px] font-medium transition-colors duration-300 ${isOpen ? "text-emerald-700" : "text-zinc-400 group-hover:text-emerald-700"}`}
      >
        alive
      </span>
    </button>
  )
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={`shrink-0 ${className ?? ""}`}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── 1: The Secret ──────────────────────────────────────────────────────────
// Dark. Conspiratorial. You found something. "This site was built by
// talking to it." — that's the hook. Two fast paths: remix or start fresh.

function PopupSecret({ hostname, onClose }: { hostname: string; onClose: () => void }) {
  return (
    <>
      {/* biome-ignore lint: overlay */}
      <div className="fixed inset-0 z-[9997] bg-black/20 sm:bg-transparent" onClick={onClose} />
      {/* Mobile: fixed bottom sheet · Desktop: absolute above badge */}
      <div
        className="fixed bottom-0 left-0 right-0 sm:absolute sm:bottom-full sm:left-auto sm:right-0 sm:mb-2 z-[9998]"
        style={{ animation: "fadeUp 300ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        <div className="sm:w-[280px] sm:ml-auto rounded-t-2xl sm:rounded-2xl bg-zinc-950 border-t border-white/[0.06] sm:border shadow-[0_-8px_40px_rgba(0,0,0,0.3)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="p-5">
            <div style={{ animation: "reveal 300ms ease-out 100ms both" }}>
              <p className="text-[15px] sm:text-[15px] text-white font-medium leading-snug tracking-tight">
                This site was built
                <br />
                by <em className="not-italic text-emerald-400">talking to it.</em>
              </p>
            </div>

            <p
              className="text-[12px] text-zinc-500 mt-3 leading-relaxed"
              style={{ animation: "reveal 300ms ease-out 350ms both" }}
            >
              Describe what you want. Watch it happen live.
            </p>

            <div className="mt-5 space-y-2" style={{ animation: "reveal 300ms ease-out 500ms both" }}>
              <a
                href={`https://app.alive.best/chat?wk=${hostname}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group/cta flex items-center justify-between w-full px-4 py-3 sm:py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 active:bg-emerald-500/20 transition-colors duration-200 no-underline"
              >
                <span className="text-[13px] font-medium text-emerald-400 group-hover/cta:text-emerald-300 transition-colors">
                  Edit this site
                </span>
                <Chevron className="text-emerald-500/50 group-hover/cta:text-emerald-400 transition-all duration-200" />
              </a>
              <a
                href="https://app.alive.best/chat"
                target="_blank"
                rel="noopener noreferrer"
                className="group/b flex items-center justify-between w-full px-4 py-3 sm:py-2.5 rounded-xl hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors duration-200 no-underline"
              >
                <span className="text-[12px] text-zinc-600 group-hover/b:text-zinc-400 transition-colors">
                  Make your own
                </span>
                <Chevron className="text-zinc-700 group-hover/b:text-zinc-500 transition-all duration-200" />
              </a>
            </div>
          </div>
          {/* Safe area padding for phones with home indicator */}
          <div className="h-[env(safe-area-inset-bottom)] sm:hidden" />
        </div>
      </div>
    </>
  )
}

// ─── 2: The Dare ────────────────────────────────────────────────────────────
// Light, warm, direct. Asks you a question. Shows two clear paths with
// icons — remix or blank canvas. For people who don't know what this is
// yet but feel the pull.

function PopupDare({ hostname, onClose }: { hostname: string; onClose: () => void }) {
  const name = hostname.split(".")[0]
  return (
    <>
      {/* biome-ignore lint: overlay */}
      <div className="fixed inset-0 z-[9997]" onClick={onClose} />
      <div
        className="absolute bottom-full right-0 mb-2 z-[9998]"
        style={{ width: 270, animation: "fadeUp 250ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        <div className="rounded-2xl bg-white shadow-[0_16px_48px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Living line */}
          <div className="h-[2px] overflow-hidden">
            <div
              className="h-full"
              style={{
                background: "linear-gradient(90deg, transparent, #34d399, #6ee7b7, #34d399, transparent)",
                backgroundSize: "200% 100%",
                animation: "gradientSlide 3s linear infinite",
              }}
            />
          </div>

          <div className="p-5">
            <div style={{ animation: "reveal 300ms ease-out 100ms both" }}>
              <p className="text-[18px] font-semibold text-zinc-900 tracking-tight leading-tight">
                What would <em className="not-italic text-emerald-600">you</em> change?
              </p>
              <p className="text-[12px] text-zinc-400 mt-2">This site is alive — just describe it.</p>
            </div>

            <div className="mt-5 space-y-1" style={{ animation: "reveal 250ms ease-out 400ms both" }}>
              <a
                href={`https://app.alive.best/chat?wk=${hostname}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group/a flex items-center gap-3 px-3 py-2.5 -mx-1 rounded-xl hover:bg-emerald-50/60 transition-all duration-200 no-underline"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 group-hover/a:bg-emerald-100 transition-colors shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-emerald-600">
                    <path
                      d="M13.5 6.5L17.5 10.5M4 20L8.08 19.03C8.45 18.95 8.78 18.77 9.05 18.5L19.5 8C20.33 7.17 20.33 5.83 19.5 5L19 4.5C18.17 3.67 16.83 3.67 16 4.5L5.5 15C5.23 15.27 5.04 15.6 4.97 15.97L4 20Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <span className="text-[13px] font-medium text-zinc-800 group-hover/a:text-emerald-700 transition-colors block">
                    Edit {name}
                  </span>
                  <span className="text-[11px] text-zinc-400">Change anything you see</span>
                </div>
              </a>

              <a
                href="https://app.alive.best/chat"
                target="_blank"
                rel="noopener noreferrer"
                className="group/b flex items-center gap-3 px-3 py-2.5 -mx-1 rounded-xl hover:bg-zinc-50 transition-all duration-200 no-underline"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-50 group-hover/b:bg-zinc-100 transition-colors shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-zinc-500">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <span className="text-[13px] text-zinc-600 group-hover/b:text-zinc-800 transition-colors block">
                    Start fresh
                  </span>
                  <span className="text-[11px] text-zinc-400">Your idea, live in minutes</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── 3: The Glimpse ─────────────────────────────────────────────────────────
// Ultra-minimal. One sentence, one button, one whisper. For the person
// who's already intrigued — you don't need to convince them, you just
// need to show them the door.

function PopupGlimpse({ hostname, onClose }: { hostname: string; onClose: () => void }) {
  return (
    <>
      {/* biome-ignore lint: overlay */}
      <div className="fixed inset-0 z-[9997]" onClick={onClose} />
      <div
        className="absolute bottom-full right-0 mb-2 z-[9998]"
        style={{ width: 230, animation: "fadeUp 200ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        <div className="rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3" style={{ animation: "reveal 250ms ease-out 100ms both" }}>
              <span className="mt-1">
                <Dot />
              </span>
              <p className="text-[13px] text-zinc-700 leading-snug">
                This site was described, not coded. <span className="text-emerald-600 font-medium">It's alive.</span>
              </p>
            </div>

            <div className="mt-4 flex items-center gap-3" style={{ animation: "reveal 250ms ease-out 350ms both" }}>
              <a
                href={`https://app.alive.best/chat?wk=${hostname}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group/a flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors no-underline"
              >
                <span className="text-[12px] font-medium text-white">Edit this site</span>
                <Chevron className="text-zinc-500 group-hover/a:text-emerald-400 group-hover/a:translate-x-0.5 transition-all duration-200 w-3 h-3" />
              </a>
              <a
                href="https://app.alive.best/chat"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors no-underline shrink-0"
              >
                or make one
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── 4: The Portal ──────────────────────────────────────────────────────────
// Dark/light split. The dark zone is the "what" — this site is alive,
// built by conversation. The gradient membrane. Then the light zone is
// the "do" — two clear actions, fast to scan. For someone who wants to
// understand AND act, quickly.

function PopupPortal({ hostname, onClose }: { hostname: string; onClose: () => void }) {
  const name = hostname.split(".")[0]
  return (
    <>
      {/* biome-ignore lint: overlay */}
      <div className="fixed inset-0 z-[9997]" onClick={onClose} />
      <div
        className="absolute bottom-full right-0 mb-2 z-[9998]"
        style={{ width: 270, animation: "fadeUp 300ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        <div className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
          {/* Dark zone — the hook */}
          <div className="bg-zinc-950 px-5 pt-5 pb-4">
            <div className="flex items-center gap-2.5" style={{ animation: "reveal 250ms ease-out 100ms both" }}>
              <Dot ripple />
              <span className="text-[11px] font-mono text-zinc-500">{hostname}</span>
            </div>
            <p
              className="text-[15px] text-white font-medium leading-snug tracking-tight mt-3"
              style={{ animation: "reveal 300ms ease-out 250ms both" }}
            >
              Built by describing it.
              <br />
              <span className="text-emerald-400">Change it the same way.</span>
            </p>
          </div>

          {/* Gradient membrane */}
          <div
            className="h-[2px]"
            style={{
              background: "linear-gradient(90deg, transparent, #34d399, #6ee7b7, #34d399, transparent)",
              backgroundSize: "200% 100%",
              animation: "gradientSlide 3s linear infinite",
            }}
          />

          {/* Light zone — the actions */}
          <div className="bg-white">
            <a
              href={`https://app.alive.best/chat?wk=${hostname}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group/a flex items-center justify-between px-5 py-3 hover:bg-emerald-50/40 transition-colors duration-200 no-underline"
              style={{ animation: "reveal 250ms ease-out 450ms both" }}
            >
              <div>
                <span className="text-[13px] font-medium text-zinc-900 group-hover/a:text-emerald-700 transition-colors block">
                  Edit {name}
                </span>
                <span className="text-[11px] text-zinc-400">Jump in and change anything</span>
              </div>
              <Chevron className="text-zinc-300 group-hover/a:text-emerald-500 group-hover/a:translate-x-0.5 transition-all duration-200" />
            </a>
            <div className="h-[1px] mx-5 bg-zinc-100" />
            <a
              href="https://app.alive.best/chat"
              target="_blank"
              rel="noopener noreferrer"
              className="group/b flex items-center justify-between px-5 py-3 hover:bg-zinc-50 transition-colors duration-200 no-underline"
              style={{ animation: "reveal 250ms ease-out 600ms both" }}
            >
              <div>
                <span className="text-[13px] text-zinc-500 group-hover/b:text-zinc-700 transition-colors block">
                  Make your own
                </span>
                <span className="text-[11px] text-zinc-400">Describe it, it's live in minutes</span>
              </div>
              <Chevron className="text-zinc-200 group-hover/b:text-zinc-400 group-hover/b:translate-x-0.5 transition-all duration-200" />
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

function Variant({
  hostname,
  PopupComponent,
}: {
  hostname: string
  PopupComponent: React.ComponentType<{ hostname: string; onClose: () => void }>
}) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="relative inline-flex flex-col items-end">
      <style>{STYLES}</style>
      {isOpen && <PopupComponent hostname={hostname} onClose={() => setIsOpen(false)} />}
      <Badge isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
    </div>
  )
}

const VARIANTS = [
  {
    id: "secret",
    name: "The Secret",
    description: 'Dark. "This site was built by talking to it." Two fast paths: edit or make your own.',
    Popup: PopupSecret,
  },
  {
    id: "dare",
    name: "The Dare",
    description: '"What would you change?" Icon-based paths. Warm, clear, non-technical.',
    Popup: PopupDare,
  },
  {
    id: "glimpse",
    name: "The Glimpse",
    description: "One sentence, one button, one whisper. Says almost nothing because it doesn't need to.",
    Popup: PopupGlimpse,
  },
  {
    id: "portal",
    name: "The Portal",
    description: 'Dark/light split, gradient membrane. "Built by describing it. Change it the same way."',
    Popup: PopupPortal,
  },
]

export default function WidgetExperimentPage() {
  return (
    <div className="min-h-screen bg-zinc-100" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{STYLES}</style>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">it's alive</h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            Two people click this: the site owner and the curious visitor. Both need a fast decision.
          </p>
        </div>

        <div className="space-y-8">
          {VARIANTS.map(({ id, name, description, Popup }, i) => (
            <section key={id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-zinc-100">
                <div className="flex items-baseline gap-3">
                  <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-[14px] font-semibold text-zinc-900">{name}</h2>
                </div>
                <p className="text-[12px] text-zinc-500 mt-1 ml-8">{description}</p>
              </div>
              <div className="relative bg-white min-h-[320px] flex flex-col">
                <div className="flex-1 p-8">
                  <div className="max-w-md space-y-3">
                    <div className="h-6 w-56 bg-zinc-100 rounded" />
                    <div className="h-3 w-80 bg-zinc-50 rounded" />
                    <div className="h-3 w-72 bg-zinc-50 rounded" />
                    <div className="h-3 w-64 bg-zinc-50 rounded" />
                    <div className="h-32 w-full bg-zinc-50 rounded-lg mt-6" />
                    <div className="h-3 w-48 bg-zinc-50 rounded mt-4" />
                    <div className="h-3 w-56 bg-zinc-50 rounded" />
                  </div>
                </div>
                <div className="flex justify-end p-4">
                  <Variant hostname="loodgieter.alive.best" PopupComponent={Popup} />
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
