import { useState } from 'react'
import { useApp } from '../store'
import { IconPlus, IconStack, IconTrash } from '../components/Icons'
import { Empty, ListItem, Pill, Skeleton } from '../components/ui'
import { timeAgo } from '../lib/utils'
import { ConfirmModal } from '../components/ConfirmModal'

export function StacksScreen() {
  const stacks = useApp((s) => s.stacks)
  const loading = useApp((s) => s.loading)
  const navigate = useApp((s) => s.navigate)
  const doRemoveStack = useApp((s) => s.doRemoveStack)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  return (
    <div className="page">
      {loading && !stacks.length ? (
        <div className="card-list" style={{ marginTop: 8 }}>
          <Skeleton h={64} />
          <Skeleton h={64} />
        </div>
      ) : (
        <div className="card-list" style={{ marginTop: 8 }}>
          {stacks.map((s) => (
            <ListItem
              key={s.Id}
              onClick={() => navigate({ name: 'stack-detail', title: s.Name, props: { id: s.Id } })}
              icon={
                <div className="item-icon" style={{ background: 'var(--purple-soft)', color: 'var(--purple)' }}>
                  <IconStack size={20} />
                </div>
              }
              title={s.Name}
              sub={`${s.EntryPoint || 'compose'} · ${timeAgo(s.CreationDate)} · ${s.CreatedBy || 'unknown'}`}
              right={
                <>
                  <Pill color={s.Status === 1 ? 'var(--green)' : 'var(--amber)'}>{s.Status === 1 ? 'active' : 'inactive'}</Pill>
                  <button
                    className="icon-btn"
                    style={{ width: 30, height: 30 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmId(s.Id)
                    }}
                  >
                    <IconTrash size={15} />
                  </button>
                </>
              }
            />
          ))}
          {!stacks.length && <Empty icon={<IconStack size={40} />} title="No stacks" sub="Deploy a compose file to get started" />}
        </div>
      )}

      <button className="btn primary" style={{ width: '100%', marginTop: 8 }} onClick={() => navigate({ name: 'deploy-stack', title: 'Deploy stack' })}>
        <IconPlus size={18} /> Deploy stack
      </button>

      {confirmId != null && (
        <ConfirmModal
          title="Remove stack"
          body={`Remove ${stacks.find((s) => s.Id === confirmId)?.Name}? Its containers will be stopped and removed.`}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => {
            void doRemoveStack(confirmId)
            setConfirmId(null)
          }}
        />
      )}
    </div>
  )
}
