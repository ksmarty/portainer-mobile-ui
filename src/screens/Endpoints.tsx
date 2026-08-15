import { useState } from 'react'
import { useApp } from '../store'
import { IconPlus, IconServer, IconWifi } from '../components/Icons'
import { Empty, ListItem, Pill, Skeleton } from '../components/ui'
import { endpointTypeName } from '../lib/utils'

export function EndpointsScreen() {
  const endpoints = useApp((s) => s.endpoints)
  const activeEndpoint = useApp((s) => s.activeEndpoint)
  const selectEndpoint = useApp((s) => s.selectEndpoint)
  const loading = useApp((s) => s.loading)
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="page">
      {loading && !endpoints.length ? (
        <div className="card-list" style={{ marginTop: 8 }}>
          <Skeleton h={68} />
          <Skeleton h={68} />
        </div>
      ) : (
        <div className="card-list" style={{ marginTop: 8 }}>
          {endpoints.map((e) => (
            <ListItem
              key={e.Id}
              onClick={() => selectEndpoint(e.Id)}
              icon={
                <div className="item-icon" style={{ background: activeEndpoint === e.Id ? 'var(--accent-soft)' : 'var(--surface-3)', color: activeEndpoint === e.Id ? 'var(--accent-2)' : 'var(--text-dim)' }}>
                  <IconServer size={20} />
                </div>
              }
              title={
                <>
                  {e.Name}
                  {activeEndpoint === e.Id && <Pill color="var(--accent-2)">active</Pill>}
                </>
              }
              sub={`${endpointTypeName(e.Type)} · ${e.Snapshot?.RunningContainerCount ?? 0} running · ${e.Snapshot?.DockerVersion || '—'}`}
              right={<Pill color={e.Status === 1 ? 'var(--green)' : 'var(--red)'}>{e.Status === 1 ? 'up' : 'down'}</Pill>}
            />
          ))}
          {!endpoints.length && <Empty icon={<IconServer size={40} />} title="No endpoints" />}
        </div>
      )}

      <button className="btn primary" style={{ width: '100%', marginTop: 8 }} onClick={() => setAddOpen(true)}>
        <IconPlus size={18} /> Add endpoint
      </button>

      {addOpen && <AddEndpointSheet onClose={() => setAddOpen(false)} />}
    </div>
  )
}

function AddEndpointSheet({ onClose }: { onClose: () => void }) {
  const doAddEndpoint = useApp((s) => s.doAddEndpoint)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('tcp://10.0.0.10:2375')

  const submit = async () => {
    if (!name.trim() || !url.trim()) return
    await doAddEndpoint(name.trim(), url.trim())
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">Add endpoint</div>
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="production" autoFocus />
        </div>
        <div className="field">
          <label>Docker API URL</label>
          <input className="input mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="tcp://host:2375" autoCapitalize="none" autoCorrect="off" />
          <div className="hint"><IconWifi size={12} style={{ verticalAlign: -2 }} /> For Docker standalone environments.</div>
        </div>
        <button className="btn primary full" onClick={submit} disabled={!name.trim() || !url.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}
