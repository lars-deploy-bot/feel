import { dollarsToTokens } from "@webalive/shared/constants"
import { useState } from "react"
import { Modal } from "@/components/overlays/Modal"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

interface CreateOrgModalProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, tokens: number) => Promise<void>
}

export function CreateOrgModal({ open, onClose, onCreate }: CreateOrgModalProps) {
  const [name, setName] = useState("")
  const [dollars, setDollars] = useState("0")
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    try {
      await onCreate(name.trim(), dollarsToTokens(Number.parseFloat(dollars) || 0))
      setName("")
      setDollars("0")
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Organization"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} loading={loading} disabled={!name.trim()}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          id="org-name"
          label="Organization Name"
          placeholder="Acme Corp"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <Input
          id="org-credits"
          label="Starting Balance ($)"
          type="number"
          step="0.01"
          min="0"
          value={dollars}
          onChange={e => setDollars(e.target.value)}
        />
      </div>
    </Modal>
  )
}
