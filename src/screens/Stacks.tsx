import { useApp } from '../store'
import { IconPlus, IconStack } from '../components/Icons'
import { Empty, ListItem, Pill, Skeleton } from '../components/ui'
import { timeAgo } from '../lib/utils'

export function StacksScreen() {
  const stacks = useApp((s) => s.stacks)
  const loading = useApp((s) => s.loading)
  const navigate = useApp((s) => s.navigate)

  return (
    <div className="page">
      {loading && !stacks.length ? (
        <div className="card-list" style={{ marginTop: 8 }}>
          <Skeleton h={64} />
          <Skeleton h={64} />
        </div>
      ) : (
        <div className="card-list" style={{ marginTop: 8 }}>
          {[...stacks].sort((a, b) => a.Name.localeCompare(b.Name)).map((s) => (
            <ListItem
              key={s.Id}
              onClick={() => navigate({ name: 'stack-detail', title: s.Name, props: { id: s.Id } })}
              icon={
                <div className="item-icon" style={{ background: 'var(--purple-soft)', color: 'var(--purple)' }}>
                  <IconStack size={20} />
                </div>
              }
              title={s.Name}
              sub={`${timeAgo(s.CreationDate)} · ${s.CreatedBy || 'unknown'}`}
              right={<Pill color={s.Status === 1 ? 'var(--green)' : 'var(--amber)'}>{s.Status === 1 ? 'active' : 'inactive'}</Pill>}
            />
          ))}
          {!stacks.length && <Empty icon={<IconStack size={40} />} title="No stacks" sub="Deploy a compose file to get started" />}
        </div>
      )}

      <button className="btn primary" style={{ width: '100%', marginTop: 8 }} onClick={() => navigate({ name: 'deploy-stack', title: 'Deploy stack' })}>
        <IconPlus size={18} /> Deploy stack
      </button>
    </div>
  )
}
