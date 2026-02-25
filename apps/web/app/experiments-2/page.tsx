"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// ─── Wrapper ─────────────────────────────────────────────────────────────────

function Card({ number, label, children }: { number: number; label: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-xs font-mono font-bold text-black/20 tabular-nums">
          {String(number).padStart(2, "0")}
        </span>
        <h2 className="text-xs font-medium text-black/30 tracking-wide">{label}</h2>
      </div>
      <div className="border border-black/[0.06] rounded-2xl bg-white overflow-hidden">{children}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// THE BUTTONS — "ways to feel something"
// ═══════════════════════════════════════════════════════════════════════════════

// ─── THE RED BUTTON ─────────────────────────────────────────────────────────
// No label. You know what to do. The primal urge.

function TheRedButton() {
  const [pressed, setPressed] = useState(false)
  return (
    <div
      className={`flex items-center justify-center p-16 transition-colors duration-700 ${pressed ? "bg-[#FF3B30]" : "bg-white"}`}
    >
      <button
        type="button"
        aria-label="Toggle red button"
        onClick={() => setPressed(p => !p)}
        className="size-28 rounded-full cursor-pointer transition-all duration-150 active:scale-90"
        style={{
          background: pressed
            ? "radial-gradient(circle at 40% 35%, #fff 0%, #f5f5f5 100%)"
            : "radial-gradient(circle at 40% 35%, #ff6b63 0%, #cc0000 100%)",
          boxShadow: pressed
            ? "0 2px 8px rgba(0,0,0,0.1), inset 0 -4px 12px rgba(0,0,0,0.08)"
            : "0 6px 20px rgba(204,0,0,0.4), 0 2px 6px rgba(0,0,0,0.15), inset 0 -4px 12px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,150,150,0.4)",
        }}
      />
    </div>
  )
}

// ─── THE HEARTBEAT ──────────────────────────────────────────────────────────
// It's alive. Press it and it beats faster. You gave it life.

function TheHeartbeat() {
  const [bpm, setBpm] = useState(60)
  const [beat, setBeat] = useState(false)

  useEffect(() => {
    const interval = setInterval(
      () => {
        setBeat(b => !b)
      },
      ((60 / bpm) * 1000) / 2,
    )
    return () => clearInterval(interval)
  }, [bpm])

  return (
    <div className="flex flex-col items-center justify-center p-14 gap-6">
      <button
        type="button"
        aria-label="Increase heartbeat speed"
        onClick={() => setBpm(b => (b >= 180 ? 60 : b + 20))}
        className="size-20 rounded-full bg-[#1a1a1a] flex items-center justify-center cursor-pointer transition-transform ease-out"
        style={{
          transform: beat ? "scale(1)" : "scale(0.92)",
          transitionDuration: `${((60 / bpm) * 500) / 2}ms`,
          boxShadow: beat
            ? `0 0 ${Math.min(bpm / 3, 40)}px ${Math.min(bpm / 6, 15)}px rgba(255,59,48,${Math.min(bpm / 300, 0.5)})`
            : "0 0 0 0 transparent",
        }}
      >
        <div
          className="size-3 rounded-full bg-[#FF3B30] transition-all"
          style={{
            transform: beat ? "scale(1.3)" : "scale(1)",
            transitionDuration: `${((60 / bpm) * 500) / 2}ms`,
          }}
        />
      </button>
      <span className="text-[11px] font-mono text-black/20 tabular-nums">{bpm} bpm</span>
    </div>
  )
}

// ─── THE WEIGHT ─────────────────────────────────────────────────────────────
// Dense. Heavy. Gravitational. It sinks when you press it.

function TheWeight() {
  const [sunk, setSunk] = useState(false)
  return (
    <div className="flex items-center justify-center p-16">
      <button
        type="button"
        onClick={() => setSunk(s => !s)}
        className="relative cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          transform: sunk ? "translateY(12px)" : "translateY(0)",
        }}
      >
        <div
          className="w-40 h-16 rounded-2xl flex items-center justify-center transition-all duration-500"
          style={{
            background: "linear-gradient(180deg, #2a2a2a 0%, #0a0a0a 100%)",
            boxShadow: sunk ? "0 1px 2px rgba(0,0,0,0.3)" : "0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          <span className="text-[13px] font-medium text-white/40 tracking-[0.2em] uppercase select-none">heavy</span>
        </div>
        {/* Shadow underneath that compresses */}
        <div
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 transition-all duration-500 rounded-full bg-black/10"
          style={{
            width: sunk ? "90%" : "70%",
            height: sunk ? "6px" : "10px",
            filter: `blur(${sunk ? 4 : 8}px)`,
          }}
        />
      </button>
    </div>
  )
}

// ─── THE BREATH ─────────────────────────────────────────────────────────────
// Inhale. Exhale. Hover and it holds its breath. Organic.

function TheBreath() {
  const [held, setHeld] = useState(false)
  return (
    <div className="flex items-center justify-center p-16">
      <button
        type="button"
        aria-label="Breath interaction"
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        className="size-24 rounded-full cursor-pointer flex items-center justify-center"
        style={{
          background: "radial-gradient(circle at 50% 50%, #e8f4ec 0%, #d1e8d8 100%)",
          animation: held ? "none" : "mschf-breathe 4s ease-in-out infinite",
          transform: held ? "scale(1.08)" : undefined,
          transition: held ? "transform 0.3s ease-out" : undefined,
          boxShadow: held ? "0 0 40px rgba(48,209,88,0.2)" : "0 0 20px rgba(48,209,88,0.08)",
        }}
      >
        <span className="text-[10px] font-medium text-[#30D158]/60 tracking-widest uppercase select-none">
          {held ? "held" : ""}
        </span>
      </button>
    </div>
  )
}

// ─── THE CONFESSION ─────────────────────────────────────────────────────────
// Click and it says something honest. Vulnerability as interface.

function TheConfession() {
  const confessions = [
    "i'm scared",
    "i don't know what i'm doing",
    "nobody's watching",
    "this might not work",
    "i care too much",
    "i'm not ready",
    "it's okay",
    "i'm still here",
    "i feel everything",
    "i'm trying",
  ]
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)

  const advance = () => {
    setFading(true)
    setTimeout(() => {
      setIndex(i => (i + 1) % confessions.length)
      setFading(false)
    }, 300)
  }

  return (
    <div className="flex items-center justify-center p-20">
      <button type="button" onClick={advance} className="cursor-pointer select-none">
        <span
          className={`text-2xl font-light text-black/70 italic transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}
        >
          {confessions[index]}
        </span>
      </button>
    </div>
  )
}

// ─── THE TRUST FALL ─────────────────────────────────────────────────────────
// "delete everything" — hover reveals it's safe. The fear is real for a second.

function TheTrustFall() {
  const [hovering, setHovering] = useState(false)
  const [clicked, setClicked] = useState(false)
  return (
    <div className="flex items-center justify-center p-14">
      <button
        type="button"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => {
          setHovering(false)
          setClicked(false)
        }}
        onClick={() => setClicked(true)}
        className={`px-8 py-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
          clicked
            ? "bg-[#30D158] border-[#30D158] scale-105"
            : hovering
              ? "bg-white border-[#30D158]"
              : "bg-white border-[#FF3B30]"
        }`}
      >
        <span
          className={`text-sm font-medium transition-all duration-300 ${
            clicked ? "text-white" : hovering ? "text-[#30D158]" : "text-[#FF3B30]"
          }`}
        >
          {clicked ? "you're safe." : hovering ? "just kidding" : "delete everything"}
        </span>
      </button>
    </div>
  )
}

// ─── THE DOPAMINE ───────────────────────────────────────────────────────────
// Honest button. Says what it does. Counter goes up. That's it. That's the drug.

function TheDopamine() {
  const [count, setCount] = useState(0)
  const [pop, setPop] = useState(false)
  return (
    <div className="flex flex-col items-center justify-center p-14 gap-4">
      <button
        type="button"
        onClick={() => {
          setCount(c => c + 1)
          setPop(true)
          setTimeout(() => setPop(false), 150)
        }}
        className="px-8 py-4 bg-black text-white rounded-full cursor-pointer transition-transform duration-150"
        style={{ transform: pop ? "scale(0.95)" : "scale(1)" }}
      >
        <span className="text-[13px] font-medium tracking-wide">trigger dopamine hit</span>
      </button>
      <span
        className={`text-[11px] font-mono tabular-nums transition-all duration-150 ${count > 0 ? "text-black/40" : "text-transparent"}`}
      >
        {count}
      </span>
    </div>
  )
}

// ─── THE MAGNET ─────────────────────────────────────────────────────────────
// Follows your cursor. It wants to be near you.

function TheMagnet() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const handleMove = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = (e.clientX - centerX) * 0.15
    const dy = (e.clientY - centerY) * 0.15
    setOffset({ x: dx, y: dy })
  }, [])

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: decorative mouse-tracking container
    <div
      ref={containerRef}
      className="flex items-center justify-center p-20"
      onMouseMove={handleMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
    >
      <button
        type="button"
        aria-label="Magnet button"
        className="size-16 rounded-full bg-black flex items-center justify-center cursor-pointer transition-transform duration-300 ease-out"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        <div className="size-2 rounded-full bg-white" />
      </button>
    </div>
  )
}

// ─── THE PATIENCE ───────────────────────────────────────────────────────────
// Hold it. Don't let go. Good things take time.

function ThePatience() {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const [complete, setComplete] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startHold = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setHolding(true)
    setComplete(false)
    setProgress(0)
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
          setComplete(true)
          setHolding(false)
          return 100
        }
        return p + 2
      })
    }, 50)
  }

  const endHold = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    if (!complete) {
      setProgress(0)
      setHolding(false)
    }
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center p-14 gap-5">
      <button
        type="button"
        onMouseDown={startHold}
        onMouseUp={endHold}
        onMouseLeave={endHold}
        className={`relative size-24 rounded-full cursor-pointer transition-all duration-300 flex items-center justify-center ${
          complete ? "bg-[#30D158]" : "bg-black/[0.04]"
        }`}
      >
        {/* Progress ring */}
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="44" fill="none" stroke="black" strokeOpacity={0.06} strokeWidth={3} />
          <circle
            cx="48"
            cy="48"
            r="44"
            fill="none"
            stroke={complete ? "#30D158" : "#000"}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 44}`}
            strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
            className="transition-all duration-100"
          />
        </svg>
        <span className="text-[10px] font-medium text-black/30 tracking-widest uppercase select-none z-10">
          {complete ? "yes" : holding ? "hold" : "hold me"}
        </span>
      </button>
    </div>
  )
}

// ─── THE ECHO ───────────────────────────────────────────────────────────────
// Click and ripples expand forever. Your action echoes.

function TheEcho() {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const containerRef = useRef<HTMLButtonElement>(null)
  const nextId = useRef(0)

  const handleClick = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const id = nextId.current++
    setRipples(prev => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }])
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id))
    }, 2000)
  }

  return (
    <button
      type="button"
      ref={containerRef}
      aria-label="Create ripple"
      className="relative h-48 w-full cursor-pointer overflow-hidden text-left"
      onClick={handleClick}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-medium text-black/15 tracking-[0.3em] uppercase select-none">
          click anywhere
        </span>
      </div>
      {ripples.map(r => (
        <div
          key={r.id}
          className="absolute pointer-events-none"
          style={{
            left: r.x,
            top: r.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="size-4 rounded-full border border-black/30"
            style={{
              animation: "mschf-echo 2s ease-out forwards",
            }}
          />
        </div>
      ))}
    </button>
  )
}

// ─── Animations ──────────────────────────────────────────────────────────────

function MschfStyles() {
  return (
    <style>{`
      @keyframes mschf-breathe {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.06); }
      }
      @keyframes mschf-echo {
        0% { width: 16px; height: 16px; opacity: 0.6; border-width: 2px; }
        100% { width: 400px; height: 400px; opacity: 0; border-width: 1px; }
      }
    `}</style>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

const experiments: { component: () => React.ReactNode; label: string }[] = [
  { component: TheRedButton, label: "you know what to do" },
  { component: TheHeartbeat, label: "it's alive. click to raise bpm" },
  { component: TheWeight, label: "dense. sinks when pressed" },
  { component: TheBreath, label: "inhale. exhale. hover to hold" },
  { component: TheConfession, label: "click for honesty" },
  { component: TheTrustFall, label: "the fear is real for a second" },
  { component: TheDopamine, label: "says what it does" },
  { component: TheMagnet, label: "it wants to be near you" },
  { component: ThePatience, label: "good things take time" },
  { component: TheEcho, label: "your action ripples outward" },
]

export default function ExperimentsPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center gap-10 px-6 py-16">
      <MschfStyles />

      <div className="w-full max-w-3xl">
        <h1 className="text-sm font-medium text-black/60 mb-0.5">Buttons</h1>
        <p className="text-[11px] text-black/25">{experiments.length} ways to feel something</p>
      </div>

      {experiments.map((exp, i) => {
        const Component = exp.component
        return (
          <Card key={`v-${i}`} number={i + 1} label={exp.label}>
            <Component />
          </Card>
        )
      })}

      <div className="h-20" />
    </div>
  )
}
