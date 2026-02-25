import { Toaster } from "react-hot-toast"
import { Spinner } from "@/components/ui/Spinner"
import { LoginPage } from "@/features/auth/LoginPage"
import { useAuth } from "@/features/auth/useAuth"
import { Layout } from "./Layout"

export function App() {
  const { authenticated, loading, login, logout } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: "10px",
            fontSize: "13px",
            padding: "10px 16px",
          },
        }}
      />
      {authenticated ? <Layout onLogout={logout} /> : <LoginPage onLogin={login} />}
    </>
  )
}
