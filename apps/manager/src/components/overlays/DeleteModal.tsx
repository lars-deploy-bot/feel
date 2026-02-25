import { ConfirmModal } from "./ConfirmModal"

interface DeleteModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  entityName: string
  loading?: boolean
}

export function DeleteModal({ open, onClose, onConfirm, entityName, loading }: DeleteModalProps) {
  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Delete ${entityName}`}
      description={`Are you sure you want to delete this ${entityName.toLowerCase()}? This action cannot be undone.`}
      confirmLabel="Delete"
      loading={loading}
      variant="danger"
    />
  )
}
