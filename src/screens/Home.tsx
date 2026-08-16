import { useApp } from '../store'
import {
  IconBox,
  IconCpu,
  IconDatabase,
  IconImage,
  IconMemory,
  IconNetwork,
  IconServer,
  IconStack,
  IconUsers,
  IconWifi,
} from '../components/Icons'
import { Ring, SectionTitle, Skeleton } from '../components/ui'

export function HomeScreen() {
  const dashboard = useApp((s) => s.dashboard)
  const endpoints = useApp((s) => s.endpoints)
  const navigate = useApp((s) => s.navigate)
  const demo = useApp((s) => s.demo)

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

  const usedGb = dashboard.memoryUsed ? (dashboard.memoryUsed / 1073741824).toFixed(1) : '0'
  const totalGb = dashboard.memoryTotal ? (dashboard.memoryTotal / 1073741824).toFixed(0) : '16'

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '2px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconCpu size={15} style={{ color: 'var(--accent-2)' }} />
              <span className="metric-label">CPU</span>
            </div>
            <Ring value={dashboard.cpu} color="var(--accent-2)" />
            <div className="metric-sub">Processor usage</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '2px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconMemory size={15} style={{ color: 'var(--purple)' }} />
              <span className="metric-label">Memory</span>
            </div>
            <Ring value={dashboard.memory} color="var(--purple)" />
            <div className="metric-sub">{usedGb} GB used · {totalGb} GB total</div>
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
  return (
    <div className="list-item" onClick={() => navigate(to)}>
      <div className="item-icon">{icon}</div>
      <div className="item-main">
        <div className="item-title">{label}</div>
        <div className="item-sub">{sub}</div>
      </div>
      <span className="chev">›</span>
    </div>
  )
}
