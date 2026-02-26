import { Toaster } from "react-hot-toast"
import { Spinner } from "@/components/ui/Spinner"
import { LoginPage } from "@/features/auth/LoginPage"
import { useAuth } from "@/features/auth/useAuth"
import { Layout } from "./Layout"

export function App() {
  const { authenticated, loading, login, logout } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Spinner size="lg" className="text-nav-text" />
      </div>
    )
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: "8px",
            fontSize: "13px",
            padding: "10px 16px",
            fontFamily: "Inter, sans-serif",
          },
        }}
      />
      {authenticated ? <Layout onLogout={logout} /> : <LoginPage onLogin={login} />}
    </>
  )
}
