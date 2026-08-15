import { useEffect } from 'react'
import { useApp } from '../store'
import { IconActivity, IconCpu, IconMemory } from '../components/Icons'
import { Ring, SectionTitle } from '../components/ui'
import { bytes } from '../lib/utils'

export function ContainerStatsScreen({ id }: { id: string }) {
  const stats = useApp((s) => s.stats)
  const startStats = useApp((s) => s.startStats)
  const stopStats = useApp((s) => s.stopStats)
  const containers = useApp((s) => s.containers)

  useEffect(() => {
    startStats(id)
    return () => stopStats()
  }, [id, startStats, stopStats])

  const name = containers.find((c) => c.Id === id)?.Names[0]?.replace('/', '') || 'container'

  if (!stats) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, gap: 10 }}>
        <IconActivity size={32} style={{ color: 'var(--text-faint)' }} />
        <div style={{ color: 'var(--text-dim)' }}>Collecting metrics…</div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="card" style={{ marginTop: 8, padding: 12 }}>
        <div className="gauge">
          <Ring value={stats.cpuPercent} color="var(--accent-2)" />
          <div className="bars">
            <div className="bar-row">
              <div className="top"><span><IconCpu size={13} style={{ verticalAlign: -2 }} /> CPU</span><span>{stats.cpuPercent.toFixed(1)}%</span></div>
              <div className="bar"><div style={{ width: `${Math.min(100, stats.cpuPercent)}%` }} /></div>
            </div>
            <div className="bar-row">
              <div className="top"><span><IconMemory size={13} style={{ verticalAlign: -2 }} /> Memory</span><span>{stats.memPercent.toFixed(1)}%</span></div>
              <div className="bar"><div style={{ width: `${Math.min(100, stats.memPercent)}%`, background: 'linear-gradient(90deg, var(--purple), var(--accent-2))' }} /></div>
            </div>
          </div>
        </div>
      </div>

      <SectionTitle>{name} · live</SectionTitle>
      <div className="card">
        <div className="kv"><span className="k">Memory</span><span className="v">{bytes(stats.memUsage)} / {bytes(stats.memLimit)}</span></div>
        <div className="kv"><span className="k">Network ↓</span><span className="v">{bytes(stats.netRx)}/s</span></div>
        <div className="kv"><span className="k">Network ↑</span><span className="v">{bytes(stats.netTx)}/s</span></div>
        <div className="kv"><span className="k">Block read</span><span className="v">{bytes(stats.blockRead)}</span></div>
        <div className="kv"><span className="k">Block write</span><span className="v">{bytes(stats.blockWrite)}</span></div>
        <div className="kv"><span className="k">Processes</span><span className="v">{stats.pids}</span></div>
      </div>

      <div style={{ color: 'var(--text-faint)', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
        Updates every 2.5s
      </div>
    </div>
  )
}
