import { dollarsToTokens, tokensToDollars } from "@webalive/shared/constants"
import { useState } from "react"
import { Modal } from "@/components/overlays/Modal"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

interface EditCreditsModalProps {
  open: boolean
  onClose: () => void
  onSave: (tokens: number) => Promise<void>
  currentCredits: number
  orgName: string
}

export function EditCreditsModal({ open, onClose, onSave, currentCredits, orgName }: EditCreditsModalProps) {
  const [dollars, setDollars] = useState(String(tokensToDollars(currentCredits)))
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    try {
      await onSave(dollarsToTokens(Number.parseFloat(dollars)))
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Balance — ${orgName}`}
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
        label="Balance ($)"
        type="number"
        step="0.01"
        min="0"
        value={dollars}
        onChange={e => setDollars(e.target.value)}
        autoFocus
      />
    </Modal>
  )
}
