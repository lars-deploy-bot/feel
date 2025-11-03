import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface DeployFormState {
  domain: string
  password: string
  setDomain: (domain: string) => void
  setPassword: (password: string) => void
  reset: () => void
}

export interface DeploymentState {
  isDeploying: boolean
  deploymentProgress: number
  deploymentStatus: "idle" | "validating" | "deploying" | "validating-ssl" | "success" | "error"
  deploymentError: string | null
  deploymentDomain: string | null
  deploymentErrors: string[] | null
  setIsDeploying: (isDeploying: boolean) => void
  setDeploymentProgress: (progress: number) => void
  setDeploymentStatus: (status: DeploymentState["deploymentStatus"]) => void
  setDeploymentError: (error: string | null) => void
  setDeploymentDomain: (domain: string | null) => void
  setDeploymentErrors: (errors: string[] | null) => void
  reset: () => void
}

export interface DeploymentHistory {
  id: string
  domain: string
  timestamp: number
  success: boolean
  error?: string
}

export interface DeploymentHistoryStore {
  history: DeploymentHistory[]
  addToHistory: (entry: DeploymentHistory) => void
  clearHistory: () => void
}

// Form state store with localStorage persistence
export const useDeployFormStore = create<DeployFormState>()(
  persist(
    set => ({
      domain: "",
      password: "",
      setDomain: domain => set({ domain }),
      setPassword: password => set({ password }),
      reset: () => set({ domain: "", password: "" }),
    }),
    {
      name: "deploy-form-storage",
      version: 1,
      // Only persist domain (not password for security)
      partialize: state => ({
        domain: state.domain,
      }),
    },
  ),
)

// Deployment status store (in-memory only, resets on page refresh)
export const useDeploymentStatusStore = create<DeploymentState>(set => ({
  isDeploying: false,
  deploymentProgress: 0,
  deploymentStatus: "idle",
  deploymentError: null,
  deploymentDomain: null,
  deploymentErrors: null,
  setIsDeploying: isDeploying => set({ isDeploying }),
  setDeploymentProgress: progress => set({ deploymentProgress: progress }),
  setDeploymentStatus: status => set({ deploymentStatus: status }),
  setDeploymentError: error => set({ deploymentError: error }),
  setDeploymentDomain: domain => set({ deploymentDomain: domain }),
  setDeploymentErrors: errors => set({ deploymentErrors: errors }),
  reset: () =>
    set({
      isDeploying: false,
      deploymentProgress: 0,
      deploymentStatus: "idle",
      deploymentError: null,
      deploymentDomain: null,
      deploymentErrors: null,
    }),
}))

// Deployment history store with localStorage persistence
export const useDeploymentHistoryStore = create<DeploymentHistoryStore>()(
  persist(
    set => ({
      history: [],
      addToHistory: entry =>
        set(state => ({
          history: [entry, ...state.history].slice(0, 50), // Keep last 50 deployments
        })),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "deployment-history-storage",
      version: 1,
    },
  ),
)
