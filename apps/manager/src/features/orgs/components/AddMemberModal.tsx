import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Modal } from "@/components/overlays/Modal"

interface AddMemberModalProps {
  open: boolean
  onClose: () => void
  onAdd: (userId: string, role: string) => Promise<void>
}

export function AddMemberModal({ open, onClose, onAdd }: AddMemberModalProps) {
  const [userId, setUserId] = useState("")
  const [role, setRole] = useState("member")
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!userId.trim()) return
    setLoading(true)
    try {
      await onAdd(userId.trim(), role)
      setUserId("")
      setRole("member")
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Member"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAdd} loading={loading} disabled={!userId.trim()}>
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          id="user-id"
          label="User ID"
          placeholder="Enter user ID"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          autoFocus
        />
        <Select id="role" label="Role" value={role} onChange={e => setRole(e.target.value)}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </Select>
      </div>
    </Modal>
  )
}
