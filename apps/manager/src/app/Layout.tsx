import { useState } from "react"
import { ContentArea } from "@/components/layout/ContentArea"
import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { Router } from "./Router"

interface LayoutProps {
  onLogout: () => void
}

export function Layout({ onLogout }: LayoutProps) {
  const [activePage, setActivePage] = useState("organizations")

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar active={activePage} onNavigate={setActivePage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onLogout={onLogout} />
        <ContentArea>
          <Router page={activePage} />
        </ContentArea>
      </div>
    </div>
  )
}
