import { Button } from "@/components/ui/Button"

interface HeaderProps {
  onLogout: () => void
}

export function Header({ onLogout }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-6">
      <div />
      <Button variant="ghost" size="sm" onClick={onLogout}>
        Sign out
      </Button>
    </header>
  )
}
