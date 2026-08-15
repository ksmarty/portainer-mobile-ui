import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { IconBox, IconPlus, IconSearch } from '../components/Icons'
import { Empty, ListItem, Pill, Skeleton } from '../components/ui'
import { portLabel, stateColor, stateLabel } from '../lib/utils'
import type { Container } from '../lib/types'

export function ContainersScreen() {
  const containers = useApp((s) => s.containers)
  const loading = useApp((s) => s.loading)
  const navigate = useApp((s) => s.navigate)
  const [filter, setFilter] = useState<'all' | 'running' | 'stopped'>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    let list = containers
    if (filter === 'running') list = list.filter((c) => c.State === 'running')
    if (filter === 'stopped') list = list.filter((c) => c.State !== 'running')
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((c) => c.Names.some((n) => n.toLowerCase().includes(q)) || c.Image.toLowerCase().includes(q))
    }
    return list
  }, [containers, filter, query])

  return (
    <div className="page">
      <div style={{ margin: '12px 0 12px' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
          <input
            className="input"
            style={{ paddingLeft: 42 }}
            placeholder="Search containers or images…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="segmented">
        {(['all', 'running', 'stopped'] as const).map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'running' ? 'Running' : 'Stopped'}
          </button>
        ))}
      </div>

      <div style={{ height: 12 }} />

      {loading && !containers.length ? (
        <div className="card-list">
          <Skeleton h={64} />
          <Skeleton h={64} />
          <Skeleton h={64} />
          <Skeleton h={64} />
        </div>
      ) : (
        <div className="card-list">
          {filtered.map((c) => (
            <ContainerRow key={c.Id} c={c} onClick={() => navigate({ name: 'container-detail', title: c.Names[0]?.replace('/', ''), props: { id: c.Id } })} />
          ))}
          {!filtered.length && (
            <Empty
              icon={<IconBox size={40} />}
              title={query ? 'No matches' : 'No containers'}
              sub={query ? 'Try a different search' : 'Pull an image or deploy a stack'}
            />
          )}
        </div>
      )}

      <FAB onClick={() => navigate({ name: 'create-container', title: 'Create container' })} />
    </div>
  )
}

function ContainerRow({ c, onClick }: { c: Container; onClick: () => void }) {
  const color = stateColor(c.State)
  return (
    <ListItem
      onClick={onClick}
      icon={
        <div style={{ width: 40, height: 40, borderRadius: 11, background: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconBox size={20} />
        </div>
      }
      title={<>{c.Names[0]?.replace('/', '')}</>}
      sub={
        <>
          <span className="mono" style={{ color: 'var(--text-dim)' }}>{c.Image}</span>
          <span style={{ margin: '0 6px', color: 'var(--text-faint)' }}>·</span>
          {portLabel(c.Ports)}
        </>
      }
      right={<Pill color={color}>{stateLabel(c.State)}</Pill>}
    />
  )
}

export function FAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Create"
      style={{
        position: 'fixed',
        bottom: 'calc(88px + var(--safe-bottom))',
        right: 'max(20px, calc(50% - 240px))',
        width: 58,
        height: 58,
        borderRadius: 18,
        background: 'var(--accent)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 14px 34px rgba(61,123,253,0.45)',
        zIndex: 50,
      }}
    >
      <IconPlus size={26} />
    </button>
  )
}
