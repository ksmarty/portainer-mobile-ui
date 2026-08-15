import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import {
  IconActivity,
  IconBox,
  IconPause,
  IconPlay,
  IconRestart,
  IconStop,
  IconTerminal,
  IconTrash,
} from '../components/Icons'
import { KV, Pill, SectionTitle, Tag } from '../components/ui'
import { shortId, stateColor, stateLabel, timeAgo } from '../lib/utils'
import type { Container } from '../lib/types'

export function ContainerDetailScreen({ id }: { id: string }) {
  const containers = useApp((s) => s.containers)
  const doContainerAction = useApp((s) => s.doContainerAction)
  const doRemoveContainer = useApp((s) => s.doRemoveContainer)
  const navigate = useApp((s) => s.navigate)
  const back = useApp((s) => s.back)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const c = useMemo(() => containers.find((x) => x.Id === id), [containers, id])

  useEffect(() => {
    if (!c) back()
  }, [c, back])

  if (!c) return null

  const color = stateColor(c.State)
  const name = c.Names[0]?.replace('/', '')

  const quickActions = [
    c.State === 'running'
      ? { label: 'Stop', icon: <IconStop size={19} />, cls: 'warn', action: () => doContainerAction(id, 'stop') }
      : { label: 'Start', icon: <IconPlay size={19} />, cls: 'ok', action: () => doContainerAction(id, 'start') },
    c.State === 'running'
      ? { label: 'Pause', icon: <IconPause size={19} />, cls: '', action: () => doContainerAction(id, 'pause') }
      : { label: 'Restart', icon: <IconRestart size={19} />, cls: '', action: () => doContainerAction(id, 'restart') },
    { label: 'Logs', icon: <IconTerminal size={19} />, cls: '', action: () => navigate({ name: 'container-logs', title: `${name} logs`, props: { id } }) },
    { label: 'Stats', icon: <IconActivity size={19} />, cls: '', action: () => navigate({ name: 'container-stats', title: `${name} stats`, props: { id } }) },
  ]

  return (
    <div className="page">
      <div className="detail-hero" style={{ marginTop: 8 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 15,
                background: `${color}22`,
                color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconBox size={26} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 750, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </div>
              <div className="mono" style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 2 }}>
                {shortId(c.Id, 16)}
              </div>
            </div>
            <Pill color={color}>{stateLabel(c.State)}</Pill>
          </div>

          <div className="quick-actions">
            {quickActions.map((qa) => (
              <button key={qa.label} className={`qa ${qa.cls}`} onClick={qa.action}>
                <span className="ico">{qa.icon}</span>
                {qa.label}
              </button>
            ))}
            <button className="qa danger" onClick={() => setConfirmRemove(true)}>
              <span className="ico"><IconTrash size={19} /></span>
              Remove
            </button>
          </div>

          <div className="divider" style={{ margin: '6px 0 12px' }} />

          <KV k="Image" v={c.Image} mono />
          <KV k="Status" v={c.Status} />
          <KV k="Created" v={timeAgo(c.Created)} />
          <KV k="Command" v={c.Command || '—'} mono />
          <KV k="Restart policy" v={c.RestartPolicy || 'no'} />
          <KV k="Platform" v={c.Platform || '—'} mono />
        </div>
      </div>

      <SectionTitle>Ports</SectionTitle>
      <div className="card">
        {c.Ports?.length ? (
          c.Ports.map((p, i) => (
            <KV key={i} k={`${p.PrivatePort}/${p.Type}`} v={p.PublicPort != null ? `→ ${p.PublicPort} (${p.IP || '0.0.0.0'})` : 'not published'} />
          ))
        ) : (
          <div style={{ color: 'var(--text-faint)', fontSize: 13.5 }}>No published ports</div>
        )}
      </div>

      {!!c.Mounts?.length && (
        <>
          <SectionTitle>Mounts</SectionTitle>
          <div className="card">
            {c.Mounts!.map((m, i) => (
              <KV key={i} k={<span className="mono" style={{ color: 'var(--text-faint)' }}>{m.Destination}</span>} v={`${m.Type === 'bind' ? m.Source : m.Name || m.Source}`} mono />
            ))}
          </div>
        </>
      )}

      {!!c.Labels && Object.keys(c.Labels).length > 0 && (
        <>
          <SectionTitle>Labels</SectionTitle>
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(c.Labels).map(([k, v]) => (
              <Tag key={k}>{k}={v}</Tag>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Network</SectionTitle>
      <div className="card">
        <KV k="Mode" v={c.NetworkMode || '—'} />
        {c.Networks?.length ? <KV k="Networks" v={c.Networks.join(', ')} /> : null}
        {c.IPs?.length ? <KV k="IP address" v={c.IPs.join(', ')} mono /> : null}
      </div>

      {confirmRemove && (
        <RemoveConfirm
          name={name}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            setConfirmRemove(false)
            void doRemoveContainer(id)
          }}
        />
      )}
    </div>
  )
}

function RemoveConfirm({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="overlay overlay-center">
      <div className="modal">
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Remove {name}?</div>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: '0 0 18px' }}>
          This will force-remove the container. Its data may be lost unless it's in a volume.
        </p>
        <div className="btn-row">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn danger" onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  )
}
