import { useApp } from '../store'
import { IconKey, IconServer } from '../components/Icons'
import { Empty, ListItem, Pill, Skeleton } from '../components/ui'
import { registryTypeName } from '../lib/utils'

export function RegistriesScreen() {
  const registries = useApp((s) => s.registries)
  const loading = useApp((s) => s.loading)

  return (
    <div className="page">
      {loading && !registries.length ? (
        <div className="card-list" style={{ marginTop: 8 }}>
          <Skeleton h={64} />
          <Skeleton h={64} />
        </div>
      ) : (
        <div className="card-list" style={{ marginTop: 8 }}>
          {registries.map((r) => (
            <ListItem
              key={r.Id}
              icon={
                <div className="item-icon" style={{ background: 'var(--surface-3)', color: 'var(--text-dim)' }}>
                  <IconServer size={20} />
                </div>
              }
              title={r.Name}
              sub={<span className="mono">{r.URL}</span>}
              right={
                <>
                  <Pill color={r.Authentication ? 'var(--green)' : 'var(--text-faint)'}>
                    {r.Authentication ? 'auth' : 'anon'}
                  </Pill>
                  <span className="tag">{registryTypeName(r.Type)}</span>
                </>
              }
            />
          ))}
          {!registries.length && <Empty icon={<IconKey size={40} />} title="No registries" />}
        </div>
      )}
    </div>
  )
}
