import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import {
  IconActivity,
  IconBox,
  IconDownload,
  IconInfo,
  IconNetwork,
  IconPause,
  IconPlay,
  IconRestart,
  IconStop,
  IconTerminal,
  IconTrash,
} from '../components/Icons'
import { KV, ListItem, Pill, SectionTitle, Spinner } from '../components/ui'
import { bytes, shortId, stateColor, stateLabel, timeAgo } from '../lib/utils'
import { getImageInfo } from '../lib/api'
import type { ImageInfo } from '../lib/types'

export function ContainerDetailScreen({ id }: { id: string }) {
  const containers = useApp((s) => s.containers)
  const networks = useApp((s) => s.networks)
  const doContainerAction = useApp((s) => s.doContainerAction)
  const doRemoveContainer = useApp((s) => s.doRemoveContainer)
  const doFetchNewImage = useApp((s) => s.doFetchNewImage)
  const navigate = useApp((s) => s.navigate)
  const back = useApp((s) => s.back)
  const ep = useApp((s) => s.activeEndpoint || s.endpoints[0]?.Id || 1)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [confirmFetch, setConfirmFetch] = useState(false)
  const [fetchBusy, setFetchBusy] = useState(false)
  const [showImageInfo, setShowImageInfo] = useState(false)

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
      : c.State === 'paused'
        ? { label: 'Unpause', icon: <IconPlay size={19} />, cls: 'ok', action: () => doContainerAction(id, 'unpause') }
        : { label: 'Start', icon: <IconPlay size={19} />, cls: 'ok', action: () => doContainerAction(id, 'start') },
    c.State === 'running'
      ? { label: 'Pause', icon: <IconPause size={19} />, cls: '', action: () => doContainerAction(id, 'pause') }
      : c.State === 'paused'
        ? { label: 'Stop', icon: <IconStop size={19} />, cls: 'warn', action: () => doContainerAction(id, 'stop') }
        : { label: 'Restart', icon: <IconRestart size={19} />, cls: '', action: () => doContainerAction(id, 'restart') },
    { label: 'Logs', icon: <IconTerminal size={19} />, cls: '', action: () => navigate({ name: 'container-logs', title: `${name} logs`, props: { id } }) },
    { label: 'Stats', icon: <IconActivity size={19} />, cls: '', action: () => navigate({ name: 'container-stats', title: `${name} stats`, props: { id } }) },
    { label: 'Pull image', icon: <IconDownload size={19} />, cls: '', action: () => setConfirmFetch(true) },
    { label: 'Image', icon: <IconInfo size={19} />, cls: '', action: () => setShowImageInfo(true) },
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
          <div className="card">
            {Object.entries(c.Labels).map(([k, v]) => (
              <div key={k} className="label-row">
                <div className="label-key mono">{k}</div>
                <div className="label-value mono">{v || '—'}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Networks</SectionTitle>
      <div className="card">
        <KV k="Mode" v={c.NetworkMode || '—'} />
        {!c.Networks?.length && <KV k="Attached" v="none" />}
      </div>
      {!!c.Networks?.length && (
        <div className="card-list" style={{ marginTop: 6 }}>
          {c.Networks.map((name, i) => {
            const net = networks.find((n) => n.Name === name)
            const ip = c.IPs?.[i]
            return (
              <ListItem
                key={name}
                icon={
                  <div className="item-icon" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
                    <IconNetwork size={18} />
                  </div>
                }
                title={name}
                sub={[ip, net?.Driver, net?.Internal ? 'internal' : undefined].filter(Boolean).join(' · ') || 'network'}
                onClick={
                  net
                    ? () => navigate({ name: 'network-detail', title: name, props: { id: net.Id } })
                    : undefined
                }
              />
            )
          })}
        </div>
      )}

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
      {confirmFetch && (
        <FetchNewImageConfirm
          name={c.Image}
          busy={fetchBusy}
          onCancel={() => setConfirmFetch(false)}
          onConfirm={() => {
            setFetchBusy(true)
            void doFetchNewImage(id).finally(() => {
              setFetchBusy(false)
              setConfirmFetch(false)
            })
          }}
        />
      )}
      {showImageInfo && (
        <ImageInfoSheet
          ep={ep}
          imageId={c.ImageID}
          imageRef={c.Image}
          onClose={() => setShowImageInfo(false)}
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

function FetchNewImageConfirm({
  name,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="overlay overlay-center">
      <div className="modal">
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Pull newer image?</div>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: '0 0 18px' }}>
          Pulls the newest version of <span className="mono">{name}</span> to the host. The running container is left
          untouched — it will keep the old image until you recreate it.
        </p>
        <div className="btn-row">
          <button className="btn ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy} onClick={onConfirm}>
            {busy ? <Spinner size={15} /> : 'Pull image'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ImageInfoSheet({
  ep,
  imageId,
  imageRef,
  onClose,
}: {
  ep: number
  imageId: string
  imageRef: string
  onClose: () => void
}) {
  const [info, setInfo] = useState<ImageInfo | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let alive = true
    getImageInfo(ep, imageId)
      .then((d) => alive && setInfo(d))
      .catch((e) => alive && setErr((e as Error).message))
    return () => {
      alive = false
    }
  }, [ep, imageId])
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <IconBox size={17} /> Image
          </span>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {err ? (
          <div style={{ color: 'var(--red)', fontSize: 13.5, padding: '10px 0' }}>{err}</div>
        ) : !info ? (
          <div style={{ padding: '18px 0', display: 'flex', justifyContent: 'center' }}>
            <Spinner size={20} />
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: 12, marginBottom: 10 }}>
              <div className="mono" style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-all' }}>
                {info.RepoTags[0] || 'untagged'}
              </div>
              <div className="mono" style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 3, wordBreak: 'break-all' }}>
                {shortId(info.Id, 24)}
              </div>
            </div>
            <div className="card">
              <KV k="Tags" v={info.RepoTags.length ? info.RepoTags.join(', ') : '—'} />
              <KV k="Created" v={info.Created ? timeAgo(info.Created) : '—'} />
              <KV k="Size" v={bytes(info.Size)} />
              <KV k="Architecture" v={info.Architecture ? `${info.Architecture} / ${info.Os}` : '—'} />
              <KV k="Docker version" v={info.DockerVersion || '—'} />
              {!!info.Author && <KV k="Author" v={info.Author} />}
              {!!info.ExposedPorts?.length && <KV k="Exposed ports" v={info.ExposedPorts.join(', ')} mono />}
              {!!info.Env?.length && <KV k="Env" v={`${info.Env.length} entries`} />}
              {!!info.Labels && <KV k="Labels" v={`${Object.keys(info.Labels).length} labels`} />}
            </div>
            <div style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 10 }}>
              {imageRef} → {shortId(imageId, 16)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
