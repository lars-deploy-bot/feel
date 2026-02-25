import { useState } from "react"
import { Modal } from "@/components/overlays/Modal"
import { Button } from "@/components/ui/Button"
import { Select } from "@/components/ui/Select"
import type { Organization } from "../orgs.types"

interface TransferDomainModalProps {
  open: boolean
  onClose: () => void
  onTransfer: (targetOrgId: string) => Promise<void>
  hostname: string
  currentOrgId: string
  orgs: Organization[]
}

export function TransferDomainModal({
  open,
  onClose,
  onTransfer,
  hostname,
  currentOrgId,
  orgs,
}: TransferDomainModalProps) {
  const [targetOrgId, setTargetOrgId] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleTransfer() {
    if (!targetOrgId) return
    setLoading(true)
    try {
      await onTransfer(targetOrgId)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const otherOrgs = orgs.filter(o => o.org_id !== currentOrgId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transfer Domain"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleTransfer} loading={loading} disabled={!targetOrgId}>
            Transfer
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-secondary mb-4">
        Transfer <span className="font-medium text-text-primary">{hostname}</span> to another organization.
      </p>
      <Select
        id="target-org"
        label="Target Organization"
        value={targetOrgId}
        onChange={e => setTargetOrgId(e.target.value)}
      >
        <option value="">Select organization...</option>
        {otherOrgs.map(org => (
          <option key={org.org_id} value={org.org_id}>
            {org.name}
          </option>
        ))}
      </Select>
    </Modal>
  )
}
