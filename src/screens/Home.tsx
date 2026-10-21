import { useEffect } from 'react'
import { useApp } from '../store'
import {
  IconBox,
  IconCpu,
  IconDatabase,
  IconDrive,
  IconImage,
  IconMemory,
  IconNetwork,
  IconServer,
  IconStack,
  IconUsers,
  IconWifi,
} from '../components/Icons'
import { Ring, ListItem, SectionTitle, Skeleton, useAnimatedNumber } from '../components/ui'
import { bytes, groupByDisk } from '../lib/utils'

// Capacity in GB, with a decimal below 100 so a 60 GB volume doesn't round to
// "60 / 60" and look full.
function formatGb(gb: number): string {
  if (!isFinite(gb) || gb <= 0) return '0'
  return gb >= 100 ? gb.toFixed(0) : gb.toFixed(1)
}

export function HomeScreen() {
  const dashboard = useApp((s) => s.dashboard)
  const storage = useApp((s) => s.storage)
  const endpoints = useApp((s) => s.endpoints)
  const navigate = useApp((s) => s.navigate)
  const demo = useApp((s) => s.demo)
  const refreshDashboard = useApp((s) => s.refreshDashboard)
  const refreshStorage = useApp((s) => s.refreshStorage)
  const animatedMemUsed = useAnimatedNumber(dashboard?.memoryUsed ?? 0)

  // Live CPU/memory: refresh the aggregates while the dashboard is visible.
  useEffect(() => {
    void refreshDashboard()
    const timer = window.setInterval(() => void refreshDashboard(), 5000)
    return () => window.clearInterval(timer)
  }, [refreshDashboard])

  // Host disk usage: the entrypoint regenerates /storage.json every 15s.
  useEffect(() => {
    void refreshStorage()
    const timer = window.setInterval(() => void refreshStorage(), 15000)
    return () => window.clearInterval(timer)
  }, [refreshStorage])

  if (!dashboard) {
    return (
      <div className="page">
        <Skeleton h={120} r={14} style={{ marginTop: 8 }} />
        <Skeleton h={24} r={8} style={{ width: 140, marginTop: 16 }} />
        <div className="stat-grid" style={{ marginTop: 8 }}>
          <Skeleton h={70} />
          <Skeleton h={70} />
          <Skeleton h={70} />
          <Skeleton h={70} />
        </div>
      </div>
    )
  }

  const usedGb = dashboard?.memoryUsed ? (animatedMemUsed / 1073741824).toFixed(1) : '0'
  const totalGb = dashboard.memoryTotal ? (dashboard.memoryTotal / 1073741824).toFixed(0) : '16'

  // The "main drive" is the physical disk carrying the container root (`/`) —
  // also the disk Portainer itself runs on. Grouping matters here: the same
  // drive is usually mounted several times (root overlay, LVM volume, /boot),
  // and reporting a raw mount would count it more than once.
  const groups = groupByDisk(storage?.mounts ?? [])
  const rootGroup = groups.find((g) => g.mounts.some((m) => m.mountpoint === '/')) ?? groups[0]
  const storagePct = rootGroup ? Math.round(Math.max(0, Math.min(100, rootGroup.usedPercent))) : 0
  const storageUsedGb = rootGroup ? rootGroup.usedBytes / 1073741824 : 0
  const storageTotalGb = rootGroup ? rootGroup.totalBytes / 1073741824 : 0

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '2px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconCpu size={15} style={{ color: 'var(--accent-2)' }} />
              <span className="metric-label">CPU</span>
            </div>
            <Ring value={dashboard.cpu} color="var(--accent-2)" size={78} stroke={7} />
            <div className="metric-sub">Processor</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '2px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconMemory size={15} style={{ color: 'var(--purple)' }} />
              <span className="metric-label">Memory</span>
            </div>
            <Ring value={dashboard.memory} color="var(--purple)" size={78} stroke={7} />
            <div className="metric-sub">
              {usedGb} / {totalGb} GB
            </div>
          </div>
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '2px 0', cursor: 'pointer' }}
            onClick={() => navigate({ name: 'drives', title: 'Drive info' })}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconDrive size={15} style={{ color: 'var(--green)' }} />
              <span className="metric-label">Storage</span>
            </div>
            <Ring value={storagePct} color="var(--green)" size={78} stroke={7} />
            <div className="metric-sub">
              {rootGroup ? `${formatGb(storageUsedGb)} / ${formatGb(storageTotalGb)} GB` : 'unavailable'}
            </div>
          </div>
        </div>
      </div>

      <SectionTitle>Resources</SectionTitle>

      <div className="stat-grid">
        <Stat
          icon={<IconBox size={17} />}
          color="var(--green)"
          label="Containers"
          value={dashboard.containersRunning}
          sub={`${dashboard.containersStopped} stopped`}
          onClick={() => navigate({ name: 'containers', title: 'Containers' })}
        />
        <Stat
          icon={<IconImage size={17} />}
          color="var(--blue)"
          label="Images"
          value={dashboard.images}
          sub={`${dashboard.volumes} volumes`}
          onClick={() => navigate({ name: 'images', title: 'Images' })}
        />
        <Stat
          icon={<IconStack size={17} />}
          color="var(--purple)"
          label="Stacks"
          value={dashboard.stacks}
          sub="compose projects"
          onClick={() => navigate({ name: 'stacks', title: 'Stacks' })}
        />
        <Stat
          icon={<IconNetwork size={17} />}
          color="var(--amber)"
          label="Networks"
          value={dashboard.networks}
          sub={`${endpoints.length} endpoints`}
          onClick={() => navigate({ name: 'networks', title: 'Networks' })}
        />
      </div>

      <SectionTitle>Quick access</SectionTitle>
      <div className="card-list">
        <QuickItem
          icon={<IconDrive size={19} />}
          label="Drive info"
          sub={
            rootGroup
              ? `${groups.length} ${groups.length === 1 ? 'drive' : 'drives'} · ${rootGroup.id} at ${storagePct}%`
              : 'All drives & partitions'
          }
          to={{ name: 'drives', title: 'Drive info' }}
        />
        <QuickItem
          icon={<IconMemory size={19} />}
          label="Container memory"
          sub={
            dashboard.memoryUsed > 0
              ? `${bytes(dashboard.memoryUsed)} in use · ranked by container`
              : 'Memory use, highest first'
          }
          to={{ name: 'memory', title: 'Container memory' }}
        />
        <QuickItem icon={<IconServer size={19} />} label="Endpoints" sub={`${endpoints.length} configured`} to={{ name: 'endpoints', title: 'Endpoints' }} />
        <QuickItem icon={<IconUsers size={19} />} label="Users & teams" sub="Access control" to={{ name: 'users', title: 'Users' }} />
        <QuickItem icon={<IconDatabase size={19} />} label="Volumes" sub={`${dashboard.volumes} volumes`} to={{ name: 'volumes', title: 'Volumes' }} />
        {demo && <QuickItem icon={<IconWifi size={19} />} label="Connection" sub="Demo mode is active" to={{ name: 'settings', title: 'Settings' }} />}
      </div>
    </div>
  )
}

function Stat({
  icon,
  color,
  label,
  value,
  sub,
  onClick,
}: {
  icon: React.ReactNode
  color: string
  label: string
  value: number
  sub: string
  onClick?: () => void
}) {
  return (
    <button className="stat" onClick={onClick} style={{ textAlign: 'left' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color }}>
        {icon}
        <span className="k" style={{ color: 'var(--text-faint)' }}>{label}</span>
      </span>
      <span className="v">{value}</span>
      <span className="s">{sub}</span>
    </button>
  )
}

function QuickItem({ icon, label, sub, to }: { icon: React.ReactNode; label: string; sub: string; to: any }) {
  const navigate = useApp((s) => s.navigate)
  return <ListItem icon={icon} title={label} sub={sub} onClick={() => navigate(to)} />
}
