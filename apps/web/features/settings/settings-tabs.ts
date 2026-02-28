import {
  Building2,
  ClipboardList,
  CreditCard,
  Flag,
  FolderOpen,
  Key,
  Link,
  Monitor,
  Settings,
  Shield,
  Zap,
} from "lucide-react"

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
  /** Grouped under collapsible "Advanced" section in sidebar */
  advanced?: boolean
}

export const allTabs: TabDefinition[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "websites", label: "Projects", icon: FolderOpen },
  { id: "skills", label: "Skills", icon: ClipboardList },
  { id: "automations", label: "Agents", icon: Zap },
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "billing", label: "Billing", icon: CreditCard, advanced: true },
  { id: "sessions", label: "Sessions", icon: Monitor, advanced: true },
  { id: "integrations", label: "Integrations", icon: Link, advanced: true },
  { id: "keys", label: "API Keys", icon: Key, advanced: true },
  { id: "flags", label: "Flags", icon: Flag, superadminOnly: true },
  { id: "admin", label: "Admin", icon: Shield, superadminOnly: true },
]

export function isSettingsTab(value: string): value is SettingsTab {
  return SETTINGS_TABS.some(tab => tab === value)
}
