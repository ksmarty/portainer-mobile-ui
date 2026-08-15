import { useState } from 'react'
import { useApp } from '../store'
import { IconDatabase, IconTrash } from '../components/Icons'
import { Empty, ListItem, Skeleton } from '../components/ui'
import { bytes } from '../lib/utils'
import { ConfirmModal } from '../components/ConfirmModal'

export function VolumesScreen() {
  const volumes = useApp((s) => s.volumes)
  const loading = useApp((s) => s.loading)
  const doRemoveVolume = useApp((s) => s.doRemoveVolume)
  const [confirmName, setConfirmName] = useState<string | null>(null)

  return (
    <div className="page">
      {loading && !volumes.length ? (
        <div className="card-list" style={{ marginTop: 8 }}>
          <Skeleton h={64} />
          <Skeleton h={64} />
        </div>
      ) : (
        <div className="card-list" style={{ marginTop: 8 }}>
          {volumes.map((v) => (
            <ListItem
              key={v.Name}
              icon={
                <div className="item-icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                  <IconDatabase size={20} />
                </div>
              }
              title={<span className="mono" style={{ fontSize: 13.5 }}>{v.Name}</span>}
              sub={`${v.Driver} · ${bytes(v.Size || 0)} · ${v.RefCount ?? 0} in use`}
              right={
                <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={(e) => { e.stopPropagation(); setConfirmName(v.Name) }}>
                  <IconTrash size={15} />
                </button>
              }
            />
          ))}
          {!volumes.length && <Empty icon={<IconDatabase size={40} />} title="No volumes" />}
        </div>
      )}

      {confirmName && (
        <ConfirmModal
          title="Remove volume"
          body={`Permanently delete ${confirmName} and all its data? This cannot be undone.`}
          onCancel={() => setConfirmName(null)}
          onConfirm={() => { void doRemoveVolume(confirmName); setConfirmName(null) }}
        />
      )}
    </div>
  )
}
