import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { IconMemory, IconSearch } from '../components/Icons'
import { Empty, Pill, SectionTitle, Skeleton } from '../components/ui'
import { bytes, stateColor, stateLabel } from '../lib/utils'
import type { ContainerMemory } from '../lib/types'

type SortKey = 'memory' | 'percent' | 'name'

/**
 * Every container's memory footprint, ranked. The dashboard only reports the
 * host total, which hides the case this screen exists for: one container
 * quietly holding most of the RAM.
 */
export function MemoryScreen() {
  const rows = useApp((s) => s.memoryUsage)
  const loading = useApp((s) => s.memoryLoading)
  const load = useApp((s) => s.loadMemoryUsage)
  const navigate = useApp((s) => s.navigate)
  const dashboard = useApp((s) => s.dashboard)
  const containers = useApp((s) => s.containers)
  const [sort, setSort] = useState<SortKey>('memory')
  const [query, setQuery] = useState('')
  const [hideIdle, setHideIdle] = useState(true)

  useEffect(() => {
    void load()
    // Sampling every container is heavier than an aggregate poll, so this is a
    // slower cadence than the dashboard's 5s.
    const timer = window.setInterval(() => void load(), 10000)
    return () => window.clearInterval(timer)
  }, [load])

  const total = rows.reduce((s, r) => s + r.mem, 0)
  const hostTotal = dashboard?.memoryTotal || 0

  const list = useMemo(() => {
    let out = rows
    if (hideIdle) out = out.filter((r) => r.mem > 0)
    if (query.trim()) {
      const q = query.toLowerCase()
      out = out.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
    }
    const sorted = [...out]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'percent') sorted.sort((a, b) => b.percent - a.percent)
    // `rows` already arrives highest-first from the store; re-sorting keeps the
    // list honest after a refresh changes the numbers.
    else sorted.sort((a, b) => b.mem - a.mem)
    return sorted
  }, [rows, sort, query, hideIdle])

  const top = list[0]
  const maxMem = list.reduce((m, r) => Math.max(m, r.mem), 0)
  const running = containers.filter((c) => c.State === 'running').length

  return (
    <div className="page">
      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>Containers total</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{bytes(total)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>
              {hostTotal > 0 ? `of ${bytes(hostTotal)} host RAM` : 'host RAM unknown'}
            </div>
            <div style={{ fontSize: 13, marginTop: 3 }}>
              {running} running · {rows.length} containers
            </div>
          </div>
        </div>
        {hostTotal > 0 && (
          <div className="bar" style={{ marginTop: 10 }}>
            <div
              style={{
                width: `${Math.min(100, (total / hostTotal) * 100)}%`,
                background: 'linear-gradient(90deg, var(--purple), var(--accent-2))',
              }}
            />
          </div>
        )}
        {top && top.mem > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 7 }}>
            Heaviest: <span style={{ color: 'var(--text-dim)' }}>{top.name}</span> at {bytes(top.mem)}
            {total > 0 ? ` (${Math.round((top.mem / total) * 100)}% of all containers)` : ''}
          </div>
        )}
      </div>

      <div style={{ margin: '12px 0' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch
            size={18}
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }}
          />
          <input
            className="input"
            style={{ paddingLeft: 42 }}
            placeholder="Search containers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="segmented">
        {(
          [
            ['memory', 'Highest memory'],
            ['percent', 'Closest to limit'],
            ['name', 'Name'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} className={sort === key ? 'active' : ''} onClick={() => setSort(key)}>
            {label}
          </button>
        ))}
      </div>

      <label className="check-row" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={hideIdle} onChange={(e) => setHideIdle(e.target.checked)} />
        <span>
          <span className="t">Hide idle containers</span>
          <span className="d">Stopped containers use no memory, so they are left out of the ranking.</span>
        </span>
      </label>

      <SectionTitle
        link={loading ? undefined : 'Refresh'}
        onLink={() => void load()}
      >
        {list.length} {list.length === 1 ? 'container' : 'containers'}
      </SectionTitle>

      {loading && !rows.length && (
        <div className="card-list">
          <Skeleton h={62} />
          <Skeleton h={62} />
          <Skeleton h={62} />
        </div>
      )}

      {!loading && !list.length && (
        <Empty
          icon={<IconMemory size={36} />}
          title={query ? 'No matches' : hideIdle ? 'Nothing running' : 'No containers'}
          sub={query ? 'Try a different search' : hideIdle ? 'Uncheck "Hide idle containers" to see them all' : 'No containers on this endpoint'}
        />
      )}

      {list.length > 0 && (
        <div className="card-list">
          {list.map((r, i) => (
            <MemoryRow
              key={r.id}
              row={r}
              rank={i + 1}
              max={maxMem}
              onClick={() => navigate({ name: 'container-detail', title: r.name, props: { id: r.id } })}
            />
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-faint)', margin: '12px 2px 0', lineHeight: 1.5 }}>
        Memory is read from each container's stats and excludes page cache, so it matches what
        <span className="mono"> docker stats</span> reports. Refreshes every 10s.
      </div>
    </div>
  )
}

function MemoryRow({
  row,
  rank,
  max,
  onClick,
}: {
  row: ContainerMemory
  rank: number
  max: number
  onClick: () => void
}) {
  const color = stateColor(row.state)
  const width = max > 0 ? Math.max(2, (row.mem / max) * 100) : 0
  const pct = row.limit > 0 ? Math.round(Math.min(100, row.percent)) : 0
  return (
    <button className="list-item" onClick={onClick} style={{ width: '100%', textAlign: 'left' }}>
      <div className="item-icon" style={{ background: `${color}22`, color }}>
        <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
          {rank}
        </span>
      </div>
      <div className="item-main">
        <div className="item-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
          {row.state !== 'running' && <Pill color={color}>{stateLabel(row.state)}</Pill>}
        </div>
        <div className="item-sub">
          <span className="mono" style={{ color: 'var(--text-dim)' }}>{bytes(row.mem)}</span>
          {row.limit > 0 && (
            <>
              <span style={{ margin: '0 6px', color: 'var(--text-faint)' }}>·</span>
              {pct}% of {bytes(row.limit)}
            </>
          )}
        </div>
        <div className="bar" style={{ marginTop: 6, height: 4 }}>
          <div style={{ width: `${width}%`, background: 'linear-gradient(90deg, var(--purple), var(--accent-2))' }} />
        </div>
      </div>
    </button>
  )
}
