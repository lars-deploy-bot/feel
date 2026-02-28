import { ClipboardList, CreditCard, Flag, Globe, Key, Link, Monitor, Settings, Shield, Zap } from "lucide-react"

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const SETTINGS_TABS = [
  "general",
  "sessions",
  "billing",
  "skills",
  "organization",
  "websites",
  "automations",
  "integrations",
  "keys",
  "flags",
  "admin",
] as const

export type SettingsTab = (typeof SETTINGS_TABS)[number]

export interface TabDefinition {
  id: SettingsTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  superadminOnly?: boolean
  /** Rendered at sidebar bottom as org card instead of in the nav list */
  pinned?: boolean
  /** Grouped under collapsible "Advanced" section in sidebar */
  advanced?: boolean
}

export const allTabs: TabDefinition[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "websites", label: "Websites", icon: Globe },
  { id: "skills", label: "Skills", icon: ClipboardList },
  { id: "automations", label: "Agents", icon: Zap },
  { id: "billing", label: "Billing", icon: CreditCard, advanced: true },
  { id: "sessions", label: "Sessions", icon: Monitor, advanced: true },
  { id: "integrations", label: "Integrations", icon: Link, advanced: true },
  { id: "keys", label: "API Keys", icon: Key, advanced: true },
  { id: "organization", label: "Organization", icon: Settings, pinned: true },
  { id: "flags", label: "Flags", icon: Flag, superadminOnly: true },
  { id: "admin", label: "Admin", icon: Shield, superadminOnly: true },
]

export function isSettingsTab(value: string): value is SettingsTab {
  return SETTINGS_TABS.some(tab => tab === value)
}
