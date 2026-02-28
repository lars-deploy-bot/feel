"use client"

import { styles } from "../sidebar-styles"

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className={`px-4 py-8 text-center text-sm ${styles.textMuted}`}>{children}</div>
}
