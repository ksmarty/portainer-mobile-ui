import { useApp } from '../store'
import { IconBroom, IconCheck } from './Icons'
import { Spinner } from './ui'
import { bytes } from '../lib/utils'

// A compact, always-visible strip that tracks a background image cleanup no
// matter which screen is open. The job itself lives in the store and is
// mirrored to localStorage, so reopening the site (or any navigation) shows the
// real progress immediately instead of hiding it behind the Images screen.
export function CleanupProgress() {
  const job = useApp((s) => s.cleanupJob)
  const navigate = useApp((s) => s.navigate)
  const screen = useApp((s) => s.screen)
  const dismissCleanup = useApp((s) => s.dismissCleanup)

  // On the Images screen the detailed CleanupBanner already covers this.
  if (!job || screen.name === 'images') return null

  const running = job.status === 'running'
  const total = job.total || 1
  const pct = Math.round((job.done / total) * 100)
  const accent = running ? 'var(--amber)' : job.failed ? 'var(--red)' : 'var(--green)'
  const soft = running ? 'var(--amber-soft)' : job.failed ? 'var(--red-soft)' : 'var(--green-soft)'

  return (
    <button
      onClick={() => navigate({ name: 'images', title: 'Images' })}
      style={{
        flex: 'none',
        display: 'block',
        width: 'calc(100% - 20px)',
        margin: '8px 10px 0',
        padding: '8px 11px',
        textAlign: 'left',
        borderRadius: 12,
        border: `1px solid ${accent}`,
        background: soft,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {running ? (
          <Spinner size={14} />
        ) : job.failed ? (
          <IconBroom size={14} style={{ color: accent }} />
        ) : (
          <IconCheck size={14} style={{ color: accent }} />
        )}
        <span style={{ fontSize: 12.5, fontWeight: 700, color: accent, flex: 1, minWidth: 0 }}>
          {running ? `Cleaning images · ${job.done}/${job.total}` : 'Image cleanup finished'}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{bytes(job.reclaimed)}</span>
      </div>
      {running ? (
        <div className="bar" style={{ marginTop: 6 }}>
          <div style={{ width: `${pct}%`, background: accent }} />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
            {job.total - job.failed} removed{job.failed ? ` · ${job.failed} failed` : ''}
          </span>
          <span
            role="button"
            tabIndex={0}
            className="link"
            style={{ fontSize: 11.5 }}
            onClick={(e) => {
              e.stopPropagation()
              dismissCleanup()
            }}
          >
            Dismiss
          </span>
        </div>
      )}
    </button>
  )
}
