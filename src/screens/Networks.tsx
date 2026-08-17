import { useState } from 'react'
import { useApp } from '../store'
import { IconNetwork, IconTrash } from '../components/Icons'
import { Empty, ListItem, Pill, Skeleton } from '../components/ui'
import { ConfirmModal } from '../components/ConfirmModal'

export function NetworksScreen() {
  const networks = useApp((s) => s.networks)
  const loading = useApp((s) => s.loading)
  const navigate = useApp((s) => s.navigate)
  const doRemoveNetwork = useApp((s) => s.doRemoveNetwork)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const removable = (driver: string) => driver !== 'host' && driver !== 'null'

  return (
    <div className="page">
      {loading && !networks.length ? (
        <div className="card-list" style={{ marginTop: 8 }}>
          <Skeleton h={64} />
          <Skeleton h={64} />
        </div>
      ) : (
        <div className="card-list" style={{ marginTop: 8 }}>
          {networks.map((n) => (
            <ListItem
              key={n.Id}
              onClick={() => navigate({ name: 'network-detail', title: n.Name, props: { id: n.Id } })}
              icon={
                <div className="item-icon" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
                  <IconNetwork size={19} />
                </div>
              }
              title={n.Name}
              sub={`${n.Driver} · ${n.Containers?.length ?? 0} container${n.Containers?.length === 1 ? '' : 's'}`}
              right={
                <>
                  {n.Internal && <Pill color="var(--text-faint)">internal</Pill>}
                  {removable(n.Driver) && (
                    <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={(e) => { e.stopPropagation(); setConfirmId(n.Id) }}>
                      <IconTrash size={15} />
                    </button>
                  )}
                </>
              }
            />
          ))}
          {!networks.length && <Empty icon={<IconNetwork size={38} />} title="No networks" />}
        </div>
      )}

      {confirmId && (
        <ConfirmModal
          title="Remove network"
          body={`Remove ${networks.find((n) => n.Id === confirmId)?.Name}?`}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => { void doRemoveNetwork(confirmId); setConfirmId(null) }}
        />
      )}
    </div>
  )
}
