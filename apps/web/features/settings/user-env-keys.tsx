/**
 * User Environment Keys Settings Component
 *
 * Allows users to manage custom environment keys stored in the lockbox.
 * Keys can be scoped to a workspace and/or multiple environments.
 * These keys are available to MCP servers for custom API integrations.
 */

"use client"

import { AlertCircle, Check, Eye, EyeOff, Globe, Key, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { ApiError, delly, getty, postty, putty } from "@/lib/api/api-client"
import { type Res, validateRequest } from "@/lib/api/schemas"

type EnvKey = Res<"user-env-keys">["keys"][number]

const ENVIRONMENTS = ["prod", "staging", "local"] as const
type Environment = (typeof ENVIRONMENTS)[number]

const ENV_LABELS: Record<Environment, string> = {
  prod: "Production",
  staging: "Staging",
  local: "Local",
}

const ENV_COLORS: Record<Environment, string> = {
  prod: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  staging: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  local: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
}

function isEnvironment(value: string): value is Environment {
  return (ENVIRONMENTS as readonly string[]).includes(value)
}

function getEnvLabel(env: string): string {
  return isEnvironment(env) ? ENV_LABELS[env] : env
}

function getEnvColor(env: string): string {
  return isEnvironment(env) ? ENV_COLORS[env] : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
}

interface UseUserEnvKeysResult {
  keys: EnvKey[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

function useUserEnvKeys(): UseUserEnvKeysResult {
  const [keys, setKeys] = useState<EnvKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchKeys = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getty("user-env-keys")
      setKeys(data.keys)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load environment keys")
      console.error("[UserEnvKeys] Fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  return { keys, loading, error, refetch: fetchKeys }
}

// ---------------------------------------------------------------------------
// Environment multi-select
// ---------------------------------------------------------------------------

function EnvironmentCheckboxes({
  selected,
  onChange,
  disabled,
}: {
  selected: string[]
  onChange: (envs: string[]) => void
  disabled?: boolean
}) {
  const toggle = (env: string) => {
    if (selected.includes(env)) {
      onChange(selected.filter(e => e !== env))
    } else {
      onChange([...selected, env])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ENVIRONMENTS.map(env => {
        const active = selected.includes(env)
        return (
          <button
            key={env}
            type="button"
            disabled={disabled}
            onClick={() => toggle(env)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
              active
                ? `${ENV_COLORS[env]} border-current`
                : "bg-black/[0.03] dark:bg-white/[0.05] text-black/40 dark:text-white/40 border-transparent hover:text-black/60 dark:hover:text-white/60"
            } disabled:opacity-50`}
          >
            {ENV_LABELS[env]}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add key form
// ---------------------------------------------------------------------------

interface AddKeyFormProps {
  onAdd: (keyName: string, keyValue: string, workspace: string, environments: string[]) => Promise<void>
  disabled?: boolean
}

function AddKeyForm({ onAdd, disabled }: AddKeyFormProps) {
  const [keyName, setKeyName] = useState("")
  const [keyValue, setKeyValue] = useState("")
  const [workspace, setWorkspace] = useState("")
  const [environments, setEnvironments] = useState<string[]>([])
  const [showValue, setShowValue] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateKeyName = (name: string): string | null => {
    if (!name) return "Key name is required"
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      return "Must be uppercase, start with a letter (e.g., MY_API_KEY)"
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validateKeyName(keyName)
    if (validationError) {
      setError(validationError)
      return
    }
    if (!keyValue) {
      setError("Key value is required")
      return
    }

    try {
      setSaving(true)
      setError(null)
      await onAdd(keyName, keyValue, workspace, environments)
      setKeyName("")
      setKeyValue("")
      setWorkspace("")
      setEnvironments([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save key")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="env-key-name" className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1">
            Key Name
          </label>
          <input
            id="env-key-name"
            type="text"
            value={keyName}
            onChange={e => {
              setKeyName(e.target.value.toUpperCase())
              setError(null)
            }}
            placeholder="MY_API_KEY"
            disabled={disabled || saving}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-black/20 dark:border-white/20 rounded-lg text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:border-black dark:focus:border-white transition-colors disabled:opacity-50 font-mono"
          />
        </div>

        <div>
          <label htmlFor="env-key-value" className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1">
            Value
          </label>
          <div className="relative">
            <input
              id="env-key-value"
              type={showValue ? "text" : "password"}
              value={keyValue}
              onChange={e => {
                setKeyValue(e.target.value)
                setError(null)
              }}
              placeholder="sk-..."
              disabled={disabled || saving}
              className="w-full px-3 py-2 pr-10 bg-white dark:bg-zinc-800 border border-black/20 dark:border-white/20 rounded-lg text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:border-black dark:focus:border-white transition-colors disabled:opacity-50 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors"
              tabIndex={-1}
            >
              {showValue ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Scope row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1">Environments</label>
          <EnvironmentCheckboxes selected={environments} onChange={setEnvironments} disabled={disabled || saving} />
          <p className="text-[10px] text-black/40 dark:text-white/40 mt-1">
            {environments.length === 0
              ? "Available in all environments"
              : `Available in: ${environments.map(e => getEnvLabel(e)).join(", ")}`}
          </p>
        </div>

        <div>
          <label
            htmlFor="env-key-workspace"
            className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1"
          >
            Workspace <span className="text-black/40 dark:text-white/40">(optional)</span>
          </label>
          <input
            id="env-key-workspace"
            type="text"
            value={workspace}
            onChange={e => setWorkspace(e.target.value.toLowerCase())}
            placeholder="example.alive.best"
            disabled={disabled || saving}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-black/20 dark:border-white/20 rounded-lg text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:border-black dark:focus:border-white transition-colors disabled:opacity-50 font-mono"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={disabled || saving || !keyName || !keyValue}
        className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-80 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Plus size={16} />
            Add Key
          </>
        )}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Scope badges
// ---------------------------------------------------------------------------

function ScopeBadges({ workspace, environments }: { workspace: string; environments: string[] }) {
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {environments.length === 0 ? (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50">
          <Globe size={10} />
          All envs
        </span>
      ) : (
        environments.map(env => (
          <span
            key={env}
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getEnvColor(env)}`}
          >
            {getEnvLabel(env)}
          </span>
        ))
      )}
      {workspace && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono">
          {workspace}
        </span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Key row with inline environment editing
// ---------------------------------------------------------------------------

interface EnvKeyRowProps {
  envKey: EnvKey
  onDelete: (keyName: string, workspace: string) => Promise<void>
  onUpdateEnvironments: (keyName: string, workspace: string, environments: string[]) => Promise<void>
}

function EnvKeyRow({ envKey, onDelete, onUpdateEnvironments }: EnvKeyRowProps) {
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editEnvs, setEditEnvs] = useState<string[]>(envKey.environments)
  const [saving, setSaving] = useState(false)

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await onDelete(envKey.name, envKey.workspace)
    } finally {
      setDeleting(false)
    }
  }

  const handleSaveEnvs = async () => {
    try {
      setSaving(true)
      await onUpdateEnvironments(envKey.name, envKey.workspace, editEnvs)
      setEditing(false)
    } catch {
      // error handled by parent
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditEnvs(envKey.environments)
    setEditing(false)
  }

  return (
    <div className="px-3 py-2.5 rounded-lg border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded">
            <Key size={14} className="text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium font-mono text-black dark:text-white truncate">{envKey.name}</span>
              {!editing && <ScopeBadges workspace={envKey.workspace} environments={envKey.environments} />}
            </div>
            {!editing && (
              <span className="text-xs text-black/50 dark:text-white/50">Encrypted and stored securely</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="p-2 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
              title="Edit environments"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || saving}
            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
            title="Delete key"
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      {/* Inline environment editor */}
      {editing && (
        <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10 flex items-center gap-3">
          <EnvironmentCheckboxes selected={editEnvs} onChange={setEditEnvs} disabled={saving} />
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={handleSaveEnvs}
              disabled={saving || deleting}
              className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
              title="Save"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saving || deleting}
              className="p-1.5 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
              title="Cancel"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UserEnvKeysSettings() {
  const { keys, loading, error, refetch } = useUserEnvKeys()

  const handleAddKey = async (keyName: string, keyValue: string, workspace: string, environments: string[]) => {
    const validated = validateRequest("user-env-keys/create", { keyName, keyValue, workspace, environments })
    await postty("user-env-keys/create", validated)
    toast(`${keyName} saved`)
    await refetch()
  }

  const handleDeleteKey = async (keyName: string, workspace: string) => {
    try {
      const validated = validateRequest("user-env-keys/delete", { keyName, workspace })
      await delly("user-env-keys/delete", validated)
      toast(`${keyName} deleted`)
      await refetch()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't delete key")
    }
  }

  const handleUpdateEnvironments = async (keyName: string, workspace: string, environments: string[]) => {
    try {
      const validated = validateRequest("user-env-keys/update", { keyName, workspace, environments })
      await putty("user-env-keys/update", validated)
      const envLabel = environments.length > 0 ? environments.map(e => getEnvLabel(e)).join(", ") : "all"
      toast(`${keyName} updated to ${envLabel}`)
      await refetch()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't update key")
      throw err
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-black/40 dark:text-white/40" />
        <span className="ml-2 text-sm text-black/60 dark:text-white/60">Loading keys...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
        <button
          type="button"
          onClick={refetch}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Add New Key Form */}
      <div className="p-4 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl border border-black/10 dark:border-white/10">
        <h4 className="text-sm font-medium text-black dark:text-white mb-3">Add Environment Key</h4>
        <AddKeyForm onAdd={handleAddKey} />
      </div>

      {/* Existing Keys List */}
      <div>
        <h4 className="text-sm font-medium text-black dark:text-white mb-3">
          Your Keys {keys.length > 0 && <span className="text-black/50 dark:text-white/50">({keys.length})</span>}
        </h4>

        {keys.length === 0 ? (
          <div className="text-center py-8 text-black/40 dark:text-white/40 text-sm border border-dashed border-black/20 dark:border-white/20 rounded-lg">
            No environment keys yet. Add one above.
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map(key => (
              <EnvKeyRow
                key={`${key.name}:${key.workspace}`}
                envKey={key}
                onDelete={handleDeleteKey}
                onUpdateEnvironments={handleUpdateEnvironments}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800/50">
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <strong>Secure storage:</strong> Your keys are encrypted with AES-256-GCM before storage. They can be used by
          MCP integrations (like custom AI services) to authenticate on your behalf. Scope keys to specific environments
          or workspaces, or leave as global to use everywhere.
        </p>
      </div>
    </div>
  )
}
