import { useState } from "react"
import { Modal } from "@/components/overlays/Modal"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

interface EditCreditsModalProps {
  open: boolean
  onClose: () => void
  onSave: (credits: number) => Promise<void>
  currentCredits: number
  orgName: string
}

export function EditCreditsModal({ open, onClose, onSave, currentCredits, orgName }: EditCreditsModalProps) {
  const [credits, setCredits] = useState(String(currentCredits))
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    try {
      await onSave(Number.parseFloat(credits))
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Credits — ${orgName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={loading}>
            Save
          </Button>
        </>
      }
    >
      <Input
        id="credits"
        label="Credits"
        type="number"
        step="0.01"
        min="0"
        value={credits}
        onChange={e => setCredits(e.target.value)}
        autoFocus
      />
    </Modal>
  )
}
