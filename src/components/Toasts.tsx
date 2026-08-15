import { useApp } from '../store'
import { IconAlert, IconCheck, IconInfo } from './Icons'

export function Toasts() {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)

  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>
          {t.kind === 'success' ? (
            <IconCheck size={16} />
          ) : t.kind === 'error' ? (
            <IconAlert size={16} />
          ) : (
            <IconInfo size={16} />
          )}
          <span style={{ flex: 1 }}>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
