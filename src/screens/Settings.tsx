import { useEffect, useState } from 'react'
import { useApp } from '../store'
import {
  IconDownload,
  IconKey,
  IconLogOut,
  IconRefresh,
  IconServer,
  IconUsers,
} from '../components/Icons'
import { ListItem, SectionTitle } from '../components/ui'
import { getConfig } from '../lib/api'

export function SettingsScreen() {
  const demo = useApp((s) => s.demo)
  const toggleDemo = useApp((s) => s.toggleDemo)
  const navigate = useApp((s) => s.navigate)
  const logout = useApp((s) => s.logout)
  const refresh = useApp((s) => s.refresh)
  const user = useApp((s) => s.user)
  const settings = useApp((s) => s.settings)

  const cfg = getConfig()

  return (
    <div className="page">
      <div className="card" style={{ marginTop: 8, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar" style={{ width: 38, height: 38, fontSize: 14 }}>
            {(user?.Username || 'u').slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{user?.Username || 'Connected'}</div>
            <div style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>
              {demo ? 'Demo administrator' : cfg.isJwt ? 'JWT session' : 'API key connection'}
            </div>
          </div>
          <span className="pill" style={{ color: demo ? 'var(--amber)' : 'var(--green)' }}>
            <span className="dot" />
            {demo ? 'demo' : 'live'}
          </span>
        </div>
      </div>

      <div className="switch-row" style={{ marginTop: 4 }}>
        <div className="grow">
          <div className="t">Demo mode</div>
          <div className="d">Explore with simulated data instead of a real server</div>
        </div>
        <button className={`switch ${demo ? 'on' : ''}`} onClick={toggleDemo} />
      </div>

      {!demo && (
        <div className="card" style={{ marginTop: 4 }}>
          <div className="kv"><span className="k">URL</span><span className="v mono" style={{ fontSize: 11 }}>{cfg.url}</span></div>
          <div className="kv"><span className="k">Auth</span><span className="v">{cfg.isJwt ? 'Bearer token' : 'X-API-Key'}</span></div>
        </div>
      )}

      <SectionTitle>Management</SectionTitle>
      <div className="card-list">
        <ListItem
          icon={<IconServer size={19} />}
          title="Endpoints"
          sub="Docker environments"
          onClick={() => navigate({ name: 'endpoints', title: 'Endpoints' })}
        />
        <ListItem
          icon={<IconUsers size={19} />}
          title="Users & teams"
          sub="Access control"
          onClick={() => navigate({ name: 'users', title: 'Users' })}
        />
        <ListItem
          icon={<IconKey size={19} />}
          title="Registries"
          sub="Image registries"
          onClick={() => navigate({ name: 'registries', title: 'Registries' })}
        />
      </div>

      <SectionTitle>Editor</SectionTitle>
      <div className="card-list">
        <ListItem
          icon={<IconKey size={19} />}
          title="Compose schema"
          sub="Key ordering and env rules for the stack editor"
          onClick={() => navigate({ name: 'schema-settings', title: 'Compose schema' })}
        />
        <ListItem
          icon={<IconRefresh size={19} />}
          title="Refresh data"
          sub="Reload all resources"
          onClick={() => void refresh()}
        />
      </div>

      {settings && (
        <>
          <SectionTitle>Instance</SectionTitle>
          <div className="card">
            <div className="kv"><span className="k">Snapshot interval</span><span className="v">{settings.SnapshotInterval || '—'}</span></div>
            <div className="kv"><span className="k">Telemetry</span><span className="v">{settings.EnableTelemetry ? 'Enabled' : 'Disabled'}</span></div>
            <div className="kv"><span className="k">Edge compute</span><span className="v">{settings.EnableEdgeComputeFeatures ? 'Enabled' : 'Disabled'}</span></div>
          </div>
        </>
      )}

      {!demo && (
        <button className="btn ghost full" style={{ marginTop: 12, color: 'var(--red)' }} onClick={logout}>
          <IconLogOut size={17} /> Disconnect
        </button>
      )}

      <SectionTitle>App</SectionTitle>
      <div className="card-list">
        <ListItem
          icon={<IconDownload size={19} />}
          title="Check for updates"
          sub="Fetch the latest build and reload"
          onClick={() => void checkUpdates()}
        />
      </div>

      <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 11.5, marginTop: 14 }}>
        Portainer Mobile · <BuildVersion />
      </div>
    </div>
  )
}

// Manually trigger a service-worker update check and reload. Storage (tokens)
// is untouched, so no re-authentication is needed.
async function checkUpdates() {
  const toast = useApp.getState().toast
  if (!('serviceWorker' in navigator)) {
    toast('Service worker is unavailable on this origin', 'error')
    return
  }
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) {
    toast('This build is not installed as a PWA', 'error')
    return
  }
  await reg.update().catch(() => {})
  toast('Reloading with the latest version…')
  setTimeout(() => window.location.reload(), 700)
}

// Shows the build version baked into the container at /version.json
// (VERSION/COMMIT build-args), falling back to "dev build" in dev/preview.
function BuildVersion() {
  const [v, setV] = useState('…')
  useEffect(() => {
    let alive = true
    fetch('/version.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { version?: string; commit?: string } | null) => {
        if (!alive) return
        if (d?.version && d.version !== 'dev') {
          const short = d.commit ? d.commit.slice(0, 7) : ''
          setV(`v${d.version}${short ? ` · ${short}` : ''}`)
        } else {
          setV('dev build')
        }
      })
      .catch(() => alive && setV('dev build'))
    return () => {
      alive = false
    }
  }, [])
  return <>{v}</>
}
