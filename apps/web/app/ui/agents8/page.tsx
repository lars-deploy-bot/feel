"use client"

/**
 * 2031.
 *
 * The system runs. You steer.
 * Three panels: your world, the briefing, the next action.
 */

import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock,
  Code2,
  FileText,
  Gavel,
  Link2,
  Scale,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import { useState } from "react"

// ─── Types ──────────────────────────────────────────────────────────────────

type Person = {
  name: string
  initials: string
  color: string
}

type Source = {
  label: string
  url: string
  snippet: string
}

type BriefingSection = {
  heading: string
  body: string
  sources?: Source[]
}

type Briefing = {
  title: string
  summary: string
  sections: BriefingSection[]
  recommendation?: string
}

type Category = "legal" | "tech" | "customers" | "sales"

type SuggestedAction = {
  id: string
  type: "email" | "link" | "call"
  label: string
  favicon: string
  service: string
  prefill?: {
    to?: string
    subject?: string
    body?: string
  }
}

type Customer = {
  id: string
  name: string
  initials: string
  color: string
  category: Category
  issue: string
  waiting_since: string
  context?: string
  action_label: string
  action_href: string
  briefing?: Briefing
  actions?: SuggestedAction[]
}

type Approval = {
  name: string
  avatar: string
  status: "pending" | "approved" | "rejected"
}

type Tension = {
  id: string
  title: string
  description: string
  category: Category
  people?: Person[]
  approvals?: Approval[]
  sideA: { label: string; description: string }
  sideB: { label: string; description: string }
  impact: string
  deadline?: string
  resolved?: "a" | "b"
  briefing?: Briefing
  actions?: SuggestedAction[]
}

type Bet = {
  id: string
  title: string
  thesis: string
  category: Category
  evidence_for: string
  evidence_against: string
  cost: string
  reversible: boolean
  status: "proposed" | "approved" | "rejected" | "running"
  result?: string
  briefing?: Briefing
}

// ─── Data ───────────────────────────────────────────────────────────────────

const BUSINESS_NAME = "FreezeFood"

const CUSTOMERS: Customer[] = []

const TENSIONS: Tension[] = [
  {
    id: "t1",
    title: "Packaging claim risk: 'no preservatives'",
    category: "legal",
    description:
      "A retail buyer flagged FreezeFood's front label as potentially misleading. Legal says 'no preservatives' may need to be narrowed to 'no artificial preservatives'. Deadline for updated copy is Wednesday to keep the listing slot.",
    people: [
      {
        name: "Sanne (food lawyer)",
        initials: "SL",
        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      },
      {
        name: "Milan (founder)",
        initials: "M",
        color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      },
    ],
    approvals: [{ name: "Milan", avatar: "https://i.imgur.com/jXIF73J.jpeg", status: "pending" }],
    sideA: {
      label: "Update wording now",
      description:
        "Change to 'no artificial preservatives' and keep the retailer launch on track. Lower legal risk, small brand hit.",
    },
    sideB: {
      label: "Defend current wording",
      description:
        "Keep strong marketing claim and push back legally. Risk: delayed launch and possible compliance escalation.",
    },
    impact: "Retail launch timing + compliance exposure",
    deadline: "Wednesday",
    briefing: {
      title: "Label wording risk — decision brief",
      summary:
        "FreezeFood's product promise is healthy, high-quality frozen sauce + protein modules (550g portions) while customers cook fresh pasta/rice themselves. The label claim needs precision to avoid regulatory and retailer risk.",
      sections: [
        {
          heading: "Regulatory angle",
          body: "Absolute claims are higher risk in food labeling. 'No preservatives' can be interpreted broadly; legal advises narrowing to 'no artificial preservatives' unless every formulation pathway is fully controlled and documented.",
          sources: [
            {
              label: "EU Food Information (Reg. 1169/2011)",
              url: "https://eur-lex.europa.eu/eli/reg/2011/1169/oj",
              snippet: "Food information shall not be misleading, particularly about characteristics and composition.",
            },
          ],
        },
        {
          heading: "Commercial tradeoff",
          body: "Keeping current wording helps ad performance in the short term. But if the retailer pauses onboarding, the partnership pipeline slips by at least one month. For a solo founder, that delay compounds quickly.",
          sources: [
            {
              label: "FreezeFood internal launch plan",
              url: "https://docs.example.com/freezefood/retail-launch",
              snippet: "Retail pilot margin beats D2C margin by ~22% when weekly volume is stable.",
            },
          ],
        },
        {
          heading: "Brand positioning",
          body: "FreezeFood's differentiation remains strong without risky language: 550g meal portions, chef-grade sauces, high-protein modules, and a better eating experience by cooking pasta/rice fresh at home.",
        },
        {
          heading: "Recommended guardrail",
          body: "Set an approval gate for all nutrition/ingredient claims before packaging print. One legal review checklist avoids repeated last-minute rewrites.",
        },
      ],
      recommendation:
        "Update to 'no artificial preservatives' now, keep the retail timeline, and lock a compliance checklist into the packaging workflow.",
    },
    actions: [
      {
        id: "a1",
        type: "email",
        label: "Ask founder to approve packaging update",
        favicon: "https://www.google.com/gmail/about/static-2.0/images/logo-gmail.png",
        service: "Gmail",
        prefill: {
          to: "milan@freezefood.nl",
          subject: "Packaging claim update needed before Wednesday",
          body: `Hey Milan,

Quick heads-up: legal recommends we change the front-pack claim from "no preservatives" to "no artificial preservatives" before Wednesday.

Why now:
- Keeps the retailer onboarding slot on track
- Reduces compliance risk from absolute labeling language
- Doesn't change our core story: 550g healthy meals, frozen sauce + protein, fresh pasta/rice cooked at home

Can I approve this wording update today so design can send final files?

Thanks,`,
        },
      },
    ],
  },
  {
    id: "t2",
    title: "Partnership focus: gyms or office lunch pilots",
    category: "sales",
    description:
      "As a solo founder, Milan can't run every channel at once. The next 6 weeks should prioritize either gym partnerships (fitness audience, protein-first messaging) or office lunch pilots (higher basket size, slower sales cycle).",
    people: [
      {
        name: "Milan",
        initials: "M",
        color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
      },
    ],
    approvals: [
      { name: "Milan", avatar: "https://i.imgur.com/MeofAWj.jpeg", status: "pending" },
      { name: "Lisa (advisor)", avatar: "https://i.imgur.com/zdou4t5.jpeg", status: "approved" },
    ],
    sideA: {
      label: "Prioritize gyms first",
      description:
        "Fast partnerships, clear 'healthy + protein' narrative, strong fit with 550g portioned meals. Lower deal size, faster cycle.",
    },
    sideB: {
      label: "Prioritize office pilots",
      description: "Higher order values and recurring weekday demand. Harder onboarding and longer procurement cycle.",
    },
    impact: "Defines the first repeatable growth motion",
    briefing: {
      title: "Partnership channel analysis",
      summary:
        "FreezeFood wins when meals feel premium but stay affordable through the split-cook model (fresh carbs at home, frozen sauce/protein supplied). Partnerships should amplify that advantage, not dilute it.",
      sections: [
        {
          heading: "Gym partnerships",
          body: "Gyms offer a concentrated, high-protein audience and short decision paths (owner/manager). Expected rollout: 5-10 locations in one month with co-branded freezer points and QR reorder cards.",
          sources: [
            {
              label: "FreezeFood pilot outreach notes",
              url: "https://docs.example.com/freezefood/gym-pilot",
              snippet: "3 gym managers already positive on trial freezer placement.",
            },
          ],
        },
        {
          heading: "Office lunch pilots",
          body: "Office pilots can deliver larger recurring orders, especially when teams want healthier lunch options. However, procurement and HR approvals increase lead time and founder workload.",
          sources: [
            {
              label: "FreezeFood B2B intro funnel",
              url: "https://docs.example.com/freezefood/office-pilots",
              snippet: "Current pipeline has 2 warm office intros but no signed pilot yet.",
            },
          ],
        },
        {
          heading: "Resource constraint",
          body: "Solo-founder execution is the bottleneck. Best plan is one primary motion + one lightweight secondary test to avoid operational overload.",
        },
      ],
      recommendation:
        "Primary: gyms for speed and predictable rollout. Secondary: one office pilot conversation per week to learn enterprise objections without derailing execution.",
    },
    actions: [
      {
        id: "a4",
        type: "email",
        label: "Send partnership focus plan",
        favicon: "https://www.google.com/gmail/about/static-2.0/images/logo-gmail.png",
        service: "Gmail",
        prefill: {
          to: "lisa@freezefood.nl",
          subject: "FreezeFood partnership focus for next 6 weeks",
          body: `Hey Lisa,

Proposal for the next 6 weeks:

1. Primary focus: gym partnerships
   - Faster cycle and better fit for our protein-first meals
   - Goal: 5 active gym locations with repeat weekly orders

2. Secondary learning loop: offices
   - 1 office pilot intro per week
   - Capture procurement blockers and pricing objections

This keeps execution realistic for a solo founder while still building B2B learning.

If you're aligned, I'll lock this as our operating plan this week.

Thanks,`,
        },
      },
    ],
  },
]

const BETS: Bet[] = [
  {
    id: "b2",
    title: "Track meal experience funnel end-to-end",
    category: "tech",
    thesis:
      "If we instrument order → cook fresh carb → add frozen sauce/protein → review, we'll find where first-week experience breaks and improve retention.",
    evidence_for:
      "We know orders, but not whether customers actually follow the split-cook model at home. No event data links prep behavior to repeat purchases.",
    evidence_against:
      "Instrumentation adds overhead for a small team, and data is useless without a weekly review cadence.",
    cost: "~3 days to instrument core events + weekly 30-minute review.",
    reversible: true,
    status: "proposed",
    briefing: {
      title: "Meal experience funnel tracking",
      summary:
        "FreezeFood's promise depends on execution at home: customers cook pasta/rice fresh and combine with frozen sauce + protein. We need visibility into where that experience fails.",
      sections: [
        {
          heading: "Current state",
          body: "Only checkout and repeat orders are tracked. We cannot see if first-time buyers understood prep instructions, portion expectations (550g), or product quality perception.",
        },
        {
          heading: "Proposed events",
          body: "Track 5 events: first_order_placed, prep_guide_opened, carb_cooked_confirmed, meal_completed, week2_reorder. This maps the exact first-week journey.",
        },
        {
          heading: "What it would unlock",
          body: "We'll know whether churn is driven by pricing, prep confusion, or taste mismatch, then adjust instructions, packaging, or partnership channel targeting.",
        },
      ],
      recommendation:
        "Approve this sprint and review results weekly. For a solo founder, clear event-driven prioritization is mandatory.",
    },
  },
]

const FILTERS: { id: Category | "all"; label: string; icon: typeof Gavel }[] = [
  { id: "all", label: "All", icon: Users },
  { id: "legal", label: "Legal", icon: Gavel },
  { id: "tech", label: "Tech", icon: Code2 },
  { id: "customers", label: "Customers", icon: Users },
  { id: "sales", label: "Sales", icon: TrendingUp },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(d: string): string {
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days === 1) return "yesterday"
  return `${days}d ago`
}

function buildGmailUrl(prefill: { to?: string; subject?: string; body?: string }): string {
  const params = new URLSearchParams()
  params.set("view", "cm")
  if (prefill.to) params.set("to", prefill.to)
  if (prefill.subject) params.set("su", prefill.subject)
  if (prefill.body) params.set("body", prefill.body)
  return `https://mail.google.com/mail/?${params.toString()}`
}

// ─── Actions Panel (right) ─────────────────────────────────────────────────

function EmailCompose({ action }: { action: SuggestedAction }) {
  const [to, setTo] = useState(action.prefill?.to ?? "")
  const [subject, setSubject] = useState(action.prefill?.subject ?? "")
  const [body, setBody] = useState(action.prefill?.body ?? "")

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header with favicon */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <img
          src={action.favicon}
          alt={action.service}
          className="w-4 h-4 rounded-sm"
          onError={e => {
            e.currentTarget.style.display = "none"
          }}
        />
        <span className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">{action.service}</span>
        <div className="flex-1" />
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
          <Sparkles size={9} />
          Pre-filled by agent
        </span>
      </div>

      {/* Fields */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {/* To */}
        <div className="flex items-center px-4 py-2.5">
          <span className="text-[12px] text-zinc-400 dark:text-zinc-500 w-12 shrink-0">To</span>
          <input
            type="text"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="flex-1 text-[13px] text-zinc-900 dark:text-white bg-transparent outline-none"
          />
        </div>

        {/* Subject */}
        <div className="flex items-center px-4 py-2.5">
          <span className="text-[12px] text-zinc-400 dark:text-zinc-500 w-12 shrink-0">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="flex-1 text-[13px] text-zinc-900 dark:text-white bg-transparent outline-none"
          />
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={12}
            className="w-full text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed bg-transparent outline-none resize-none"
          />
        </div>
      </div>

      {/* Send button */}
      <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center gap-2">
        <a
          href={buildGmailUrl({ to, subject, body })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium transition-colors"
        >
          <Send size={13} />
          Open in {action.service}
        </a>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Opens compose window</span>
      </div>
    </div>
  )
}

function DecisionCards({ tension, onResolve }: { tension: Tension; onResolve: (id: string, side: "a" | "b") => void }) {
  if (tension.resolved) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
        <Check size={14} className="text-emerald-500 shrink-0" />
        <span className="text-[13px] text-zinc-700 dark:text-zinc-300">
          Decided:{" "}
          <span className="font-medium">{tension.resolved === "a" ? tension.sideA.label : tension.sideB.label}</span>
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={() => onResolve(tension.id, "a")}
        className="w-full text-left p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-white transition-all group hover:shadow-sm"
      >
        <div className="text-[14px] font-medium text-zinc-900 dark:text-white group-hover:underline">
          {tension.sideA.label}
        </div>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
          {tension.sideA.description}
        </p>
      </button>
      <button
        type="button"
        onClick={() => onResolve(tension.id, "b")}
        className="w-full text-left p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-white transition-all group hover:shadow-sm"
      >
        <div className="text-[14px] font-medium text-zinc-900 dark:text-white group-hover:underline">
          {tension.sideB.label}
        </div>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
          {tension.sideB.description}
        </p>
      </button>
    </div>
  )
}

function ActionsPanel({
  actions,
  tension,
  onResolve,
}: {
  actions: SuggestedAction[] | null
  tension: Tension | null
  onResolve: (id: string, side: "a" | "b") => void
}) {
  const hasDecision = tension !== null
  const hasActions = actions !== null && actions.length > 0

  if (!hasDecision && !hasActions) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center">
            <Zap size={24} className="text-zinc-300 dark:text-zinc-600" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 flex items-center justify-center">
            <Send size={11} className="text-blue-400" />
          </div>
        </div>
        <p className="text-[14px] font-medium text-zinc-400 dark:text-zinc-500 text-center">Suggested actions</p>
        <p className="text-[12px] text-zinc-300 dark:text-zinc-600 text-center mt-2">
          Select something to see what
          <br />
          the agent recommends doing next
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 space-y-6">
        {/* Decision */}
        {hasDecision && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Scale size={13} className="text-amber-500" />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                Make your call
              </span>
            </div>
            <DecisionCards tension={tension} onResolve={onResolve} />
          </div>
        )}

        {/* Approvals */}
        {tension?.approvals && tension.approvals.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users size={13} className="text-zinc-400" />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                Waiting for approval
              </span>
            </div>
            <div className="space-y-2">
              {tension.approvals.map(a => (
                <div
                  key={a.name}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    a.status === "approved"
                      ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/10"
                      : a.status === "rejected"
                        ? "border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/10"
                        : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <img src={a.avatar} alt={a.name} className="w-8 h-8 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-zinc-900 dark:text-white">{a.name}</span>
                  </div>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      a.status === "approved"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : a.status === "rejected"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {a.status === "approved" ? "Approved" : a.status === "rejected" ? "Rejected" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        {hasDecision && hasActions && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
            <span className="text-[10px] font-medium text-zinc-300 dark:text-zinc-600 uppercase tracking-wider">
              Then
            </span>
            <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
          </div>
        )}

        {/* Actions */}
        {hasActions && (
          <div className="space-y-4">
            {!hasDecision && (
              <div className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                Suggested actions
              </div>
            )}

            {actions.map(action => (
              <div key={action.id}>
                <div className="flex items-center gap-2 mb-3">
                  <img
                    src={action.favicon}
                    alt={action.service}
                    className="w-4 h-4 rounded-sm"
                    onError={e => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                  <span className="text-[13px] font-medium text-zinc-900 dark:text-white">{action.label}</span>
                </div>

                {action.type === "email" && action.prefill && <EmailCompose action={action} />}

                {action.type === "link" && (
                  <button
                    type="button"
                    className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                  >
                    <img
                      src={action.favicon}
                      alt={action.service}
                      className="w-5 h-5 rounded"
                      onError={e => {
                        e.currentTarget.style.display = "none"
                      }}
                    />
                    <span className="text-[13px] font-medium text-zinc-900 dark:text-white">{action.label}</span>
                    <ArrowUpRight size={12} className="text-zinc-400 ml-auto" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Briefing Panel (middle) ───────────────────────────────────────────────

function BriefingPanel({ briefing, onClose }: { briefing: Briefing | null; onClose: () => void }) {
  if (!briefing) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center">
            <FileText size={24} className="text-zinc-300 dark:text-zinc-600" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 flex items-center justify-center">
            <Sparkles size={11} className="text-amber-400" />
          </div>
        </div>
        <p className="text-[14px] font-medium text-zinc-400 dark:text-zinc-500 text-center">
          Click on anything to see the
          <br />
          agent-prepared briefing
        </p>
        <p className="text-[12px] text-zinc-300 dark:text-zinc-600 text-center mt-2">
          Risk analyses, source verification,
          <br />
          and recommendations — already done
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5">
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[16px] font-semibold text-zinc-900 dark:text-white leading-snug">{briefing.title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="mt-0.5 text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors shrink-0"
            >
              <span className="text-[11px]">ESC</span>
            </button>
          </div>
          <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed mt-3">{briefing.summary}</p>
        </div>

        {/* Sections */}
        <div className="space-y-5">
          {briefing.sections.map(section => (
            <div key={section.heading}>
              <h3 className="text-[12px] font-semibold text-zinc-900 dark:text-white uppercase tracking-wide mb-2">
                {section.heading}
              </h3>
              <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
                {section.body}
              </p>
              {section.sources && section.sources.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {section.sources.map(source => (
                    <a
                      key={source.label}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-lg border border-zinc-100 dark:border-zinc-800 p-2.5 hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Link2 size={10} className="text-blue-400" />
                        <span className="text-[11px] font-medium text-blue-500 dark:text-blue-400 group-hover:underline">
                          {source.label}
                        </span>
                        <ArrowUpRight size={9} className="text-blue-300 dark:text-blue-600" />
                      </div>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed line-clamp-2">
                        {source.snippet}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recommendation */}
        {briefing.recommendation && (
          <div className="mt-6 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100/50 dark:from-zinc-900 dark:to-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/40 p-4">
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
              Recommendation
            </div>
            <p className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed">{briefing.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Left Panel Components ──────────────────────────────────────────────────

function CustomerCard({
  customer,
  isSelected,
  onSelect,
}: {
  customer: Customer
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors ${
        isSelected
          ? "border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-900"
          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
      }`}
    >
      <div
        className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-semibold ${customer.color}`}
      >
        {customer.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-zinc-900 dark:text-white">{customer.name}</span>
          <span className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            <Clock size={10} />
            {timeAgo(customer.waiting_since)}
          </span>
        </div>
        <p className="text-[13px] text-zinc-600 dark:text-zinc-400 mt-0.5">{customer.issue}</p>
        {customer.context && (
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-1 italic">{customer.context}</p>
        )}
      </div>
    </button>
  )
}

function TensionCard({
  tension,
  isSelected,
  onSelect,
}: {
  tension: Tension
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl p-4 border transition-colors ${
        isSelected
          ? "border-zinc-900 dark:border-white bg-amber-50/80 dark:bg-amber-950/20"
          : "border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 hover:border-amber-300 dark:hover:border-amber-800/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <Scale size={15} className="text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-zinc-900 dark:text-white">{tension.title}</span>
            {tension.people && tension.people.length > 0 && (
              <div className="flex -space-x-1.5">
                {tension.people.map(p => (
                  <div
                    key={p.initials}
                    title={p.name}
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold ring-2 ring-amber-50 dark:ring-amber-950/10 ${p.color}`}
                  >
                    {p.initials}
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">{tension.description}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              At stake: {tension.impact}
            </span>
            {tension.deadline && (
              <span className="text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">
                Due {tension.deadline}
              </span>
            )}
            {tension.approvals && tension.approvals.length > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                {tension.approvals.map(a => (
                  <div key={a.name} className="relative" title={`${a.name} — ${a.status}`}>
                    <img
                      src={a.avatar}
                      alt={a.name}
                      className={`w-6 h-6 rounded-full object-cover ring-2 ${
                        a.status === "approved"
                          ? "ring-emerald-400 dark:ring-emerald-500"
                          : a.status === "rejected"
                            ? "ring-red-400 dark:ring-red-500"
                            : "ring-amber-300 dark:ring-amber-600"
                      }`}
                    />
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                        a.status === "approved"
                          ? "bg-emerald-500"
                          : a.status === "rejected"
                            ? "bg-red-500"
                            : "bg-amber-400"
                      }`}
                    >
                      {a.status === "approved" ? (
                        <Check size={8} className="text-white" />
                      ) : a.status === "rejected" ? (
                        <span className="text-[7px] text-white font-bold">✕</span>
                      ) : (
                        <Clock size={7} className="text-white" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {tension.resolved ? (
          <div className="mt-0.5 shrink-0">
            <Check size={14} className="text-emerald-500" />
          </div>
        ) : (
          <ChevronRight size={14} className="mt-0.5 text-zinc-400 shrink-0" />
        )}
      </div>
    </button>
  )
}

function BetCard({ bet, isSelected, onSelect }: { bet: Bet; isSelected: boolean; onSelect: () => void }) {
  const statusColor = {
    proposed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    rejected: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    running: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl p-4 border transition-colors ${
        isSelected
          ? "border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-900"
          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start gap-3">
        <Sparkles size={15} className="text-violet-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-medium text-zinc-900 dark:text-white">{bet.title}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColor[bet.status]}`}>
              {bet.status}
            </span>
            {bet.reversible && <span className="text-[10px] text-zinc-400 dark:text-zinc-500">reversible</span>}
          </div>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">{bet.thesis}</p>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5">Cost: {bet.cost}</div>
          {bet.result && (
            <div className="text-[12px] text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 rounded-lg p-2 mt-2">
              {bet.result}
            </div>
          )}
        </div>
        <ChevronRight size={14} className="mt-0.5 text-zinc-400 shrink-0" />
      </div>
    </button>
  )
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
        {children}
      </span>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

function FilterBar({
  active,
  onChange,
  counts,
}: {
  active: Category | "all"
  onChange: (f: Category | "all") => void
  counts: Record<Category | "all", number>
}) {
  return (
    <div className="flex items-center gap-1">
      {FILTERS.map(f => {
        const Icon = f.icon
        const isActive = active === f.id
        const count = counts[f.id]
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors ${
              isActive
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Icon size={13} />
            {f.label}
            {count > 0 && (
              <span
                className={`text-[10px] ml-0.5 tabular-nums ${
                  isActive ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function Agents8Page() {
  const [tensions, setTensions] = useState(TENSIONS)
  const [activeBriefing, setActiveBriefing] = useState<Briefing | null>(null)
  const [activeActions, setActiveActions] = useState<SuggestedAction[] | null>(null)
  const [activeTension, setActiveTension] = useState<Tension | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Category | "all">("all")

  function selectItem(
    id: string,
    briefing: Briefing | undefined,
    actions: SuggestedAction[] | undefined,
    tension?: Tension,
  ) {
    if (activeId === id) {
      setActiveBriefing(null)
      setActiveActions(null)
      setActiveTension(null)
      setActiveId(null)
    } else {
      setActiveBriefing(briefing ?? null)
      setActiveActions(actions?.length ? actions : null)
      setActiveTension(tension ?? null)
      setActiveId(id)
    }
  }

  function handleResolve(id: string, side: "a" | "b") {
    setTensions(prev => {
      const updated = prev.map(t => (t.id === id ? { ...t, resolved: side } : t))
      // Keep the active tension in sync
      const resolved = updated.find(t => t.id === id)
      if (resolved) setActiveTension(resolved)
      return updated
    })
  }

  // Filtered data
  const match = (cat: Category) => filter === "all" || cat === filter
  const filteredCustomers = CUSTOMERS.filter(c => match(c.category))
  const unresolved = tensions.filter(t => !t.resolved && match(t.category))
  const resolved = tensions.filter(t => t.resolved && match(t.category))
  const filteredBets = BETS.filter(b => match(b.category))

  // Counts per category
  const allItems = [...CUSTOMERS.map(c => c.category), ...TENSIONS.map(t => t.category), ...BETS.map(b => b.category)]
  const counts = {
    all: allItems.length,
    legal: allItems.filter(c => c === "legal").length,
    tech: allItems.filter(c => c === "tech").length,
    customers: allItems.filter(c => c === "customers").length,
    sales: allItems.filter(c => c === "sales").length,
  }

  return (
    <div className="h-screen bg-white dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[17px] font-bold text-zinc-900 dark:text-white">{BUSINESS_NAME}</h1>
            <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              The system runs. You decide what it should be.
            </p>
          </div>
          <FilterBar active={filter} onChange={setFilter} counts={counts} />
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left — feed */}
        <div className="flex-[4] min-w-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800">
          <div className="px-5 py-6 space-y-8">
            {/* Needs you — customers + tensions merged */}
            {(filteredCustomers.length > 0 || unresolved.length > 0) && (
              <section>
                <SectionLabel count={filteredCustomers.length + unresolved.length}>Needs you</SectionLabel>
                <div className="space-y-3">
                  {unresolved
                    .filter(t => t.deadline)
                    .map(t => (
                      <TensionCard
                        key={t.id}
                        tension={t}
                        isSelected={activeId === t.id}
                        onSelect={() => selectItem(t.id, t.briefing, t.actions, t)}
                      />
                    ))}
                  {filteredCustomers.map(c => (
                    <CustomerCard
                      key={c.id}
                      customer={c}
                      isSelected={activeId === c.id}
                      onSelect={() => selectItem(c.id, c.briefing, c.actions)}
                    />
                  ))}
                  {unresolved
                    .filter(t => !t.deadline)
                    .map(t => (
                      <TensionCard
                        key={t.id}
                        tension={t}
                        isSelected={activeId === t.id}
                        onSelect={() => selectItem(t.id, t.briefing, t.actions, t)}
                      />
                    ))}
                </div>
              </section>
            )}

            {/* Bets */}
            {filteredBets.length > 0 && (
              <section>
                <SectionLabel>Bets</SectionLabel>
                <div className="space-y-3">
                  {filteredBets.map(b => (
                    <BetCard
                      key={b.id}
                      bet={b}
                      isSelected={activeId === b.id}
                      onSelect={() => selectItem(b.id, b.briefing, undefined)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Decided */}
            {resolved.length > 0 && (
              <section>
                <SectionLabel>Decided</SectionLabel>
                <div className="space-y-3">
                  {resolved.map(t => (
                    <TensionCard
                      key={t.id}
                      tension={t}
                      isSelected={activeId === t.id}
                      onSelect={() => selectItem(t.id, t.briefing, t.actions, t)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {filteredCustomers.length === 0 &&
              unresolved.length === 0 &&
              filteredBets.length === 0 &&
              resolved.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-[14px] text-zinc-400 dark:text-zinc-500">Nothing here right now</p>
                </div>
              )}
          </div>
        </div>

        {/* Middle — briefing */}
        <div className="flex-[5] min-w-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
          <BriefingPanel
            briefing={activeBriefing}
            onClose={() => {
              setActiveBriefing(null)
              setActiveActions(null)
              setActiveTension(null)
              setActiveId(null)
            }}
          />
        </div>

        {/* Right — actions */}
        <div className="flex-[3] min-w-0 overflow-y-auto">
          <ActionsPanel actions={activeActions} tension={activeTension} onResolve={handleResolve} />
        </div>
      </div>
    </div>
  )
}
