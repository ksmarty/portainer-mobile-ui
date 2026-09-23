export function ConfirmModal({
  title,
  body,
  onCancel,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
}: {
  title: string
  body: string
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}) {
  return (
    <div className="overlay overlay-center" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{title}</div>
        <p style={{ color: 'var(--text-dim)', fontSize: 13.5, margin: '0 0 16px' }}>{body}</p>
        <div className="btn-row">
          <button className="btn ghost" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
