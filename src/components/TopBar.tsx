import { useApp } from '../store'
import { IconChevronLeft, IconMenu, IconRefresh } from './Icons'

export function TopBar({ back = false }: { back?: boolean }) {
  const screen = useApp((s) => s.screen)
  const navigate = useApp((s) => s.navigate)
  const backFn = useApp((s) => s.back)
  const refresh = useApp((s) => s.refresh)
  const loading = useApp((s) => s.loading)
  const endpoints = useApp((s) => s.endpoints)
  const activeEndpoint = useApp((s) => s.activeEndpoint)
  const demo = useApp((s) => s.demo)

  const ep = endpoints.find((e) => e.Id === activeEndpoint)

  return (
    <header className="topbar">
      <div className="topbar-inner">
        {back ? (
          <button className="icon-btn" onClick={backFn} aria-label="Back">
            <IconChevronLeft size={22} />
          </button>
        ) : (
          <button
            className="icon-btn"
            onClick={() => navigate({ name: 'settings', title: 'Settings' })}
            aria-label="Settings"
          >
            <IconMenu size={22} />
          </button>
        )}
        <div className="topbar-title">
          <h1>{screen.title}</h1>
          <div className="topbar-subtitle">
            {demo ? 'Demo mode · ' : ''}
            {ep?.Name || 'No endpoint'}
          </div>
        </div>
        <button
          className="icon-btn"
          onClick={() => void refresh()}
          aria-label="Refresh"
          disabled={loading}
          style={{ opacity: loading ? 0.4 : 1 }}
        >
          <IconRefresh size={19} />
        </button>
      </div>
    </header>
  )
}
