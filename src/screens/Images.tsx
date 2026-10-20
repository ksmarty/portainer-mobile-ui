import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../store'
import { IconBroom, IconCheck, IconImage, IconPlus, IconSearch, IconTrash } from '../components/Icons'
import { Empty, ListItem, Skeleton, Spinner } from '../components/ui'
import { bytes, shortId, timeAgo } from '../lib/utils'
import { getDanglingImages } from '../lib/api'
import type { Image as ImageT } from '../lib/types'
import { ConfirmModal } from '../components/ConfirmModal'

// Pull-image and cleanup actions, rendered in the top bar so they're always
// reachable without scrolling to the bottom of the list.
export function ImageActions() {
  const doPullImage = useApp((s) => s.doPullImage)
  const [pullOpen, setPullOpen] = useState(false)
  const [cleanOpen, setCleanOpen] = useState(false)
  return (
    <>
      <button className="icon-btn" aria-label="Pull image" onClick={() => setPullOpen(true)}>
        <IconPlus size={19} />
      </button>
      <button className="icon-btn" aria-label="Clean up unused images" onClick={() => setCleanOpen(true)}>
        <IconBroom size={17} />
      </button>
      {pullOpen &&
        createPortal(
          <PullSheet onClose={() => setPullOpen(false)} onPull={(img) => { void doPullImage(img); setPullOpen(false) }} />,
          document.body,
        )}
      {cleanOpen && createPortal(<CleanupSheet onClose={() => setCleanOpen(false)} />, document.body)}
    </>
  )
}

export function ImagesScreen() {
  const images = useApp((s) => s.images)
  const loading = useApp((s) => s.loading)
  const doRemoveImage = useApp((s) => s.doRemoveImage)
  const [query, setQuery] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return images
    const q = query.toLowerCase()
    return images.filter((i) => i.RepoTags?.some((t) => t.toLowerCase().includes(q)) || i.Id.includes(q))
  }, [images, query])

  return (
    <div className="page">
      <CleanupBanner />

      <div style={{ margin: '10px 0' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={17} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
          <input className="input" style={{ paddingLeft: 40 }} placeholder="Search images…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {loading && !images.length ? (
        <div className="card-list">
          <Skeleton h={58} />
          <Skeleton h={58} />
          <Skeleton h={58} />
        </div>
      ) : (
        <div className="card-list">
          {filtered.map((img) => (
            <ImageRow key={img.Id} img={img} onRemove={() => setConfirmId(img.Id)} />
          ))}
          {!filtered.length && <Empty icon={<IconImage size={36} />} title="No images" sub="Pull an image to get started" />}
        </div>
      )}

      {confirmId && (
        <ConfirmModal
          title="Remove image"
          body={`Force-remove ${images.find((i) => i.Id === confirmId)?.RepoTags?.[0] || shortId(confirmId)}?`}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => { void doRemoveImage(confirmId); setConfirmId(null) }}
        />
      )}
    </div>
  )
}

function ImageRow({ img, onRemove }: { img: ImageT; onRemove: () => void }) {
  const dangling = !img.RepoTags || img.RepoTags.length === 0 || img.RepoTags.includes('<none>:<none>')
  return (
    <ListItem
      icon={
        <div className="item-icon" style={{ background: dangling ? 'var(--amber-soft)' : 'var(--blue-soft)', color: dangling ? 'var(--amber)' : 'var(--blue)' }}>
          <IconImage size={18} />
        </div>
      }
      title={
        dangling ? (
          <span style={{ color: 'var(--amber)' }}>dangling · {shortId(img.Id)}</span>
        ) : (
          <span className="mono" style={{ fontSize: 12.5 }}>{img.RepoTags?.[0]}</span>
        )
      }
      sub={`${bytes(img.Size)} · ${img.Containers} container${img.Containers === 1 ? '' : 's'} · ${timeAgo(img.Created)}`}
      right={<button className="icon-btn" style={{ width: 32, height: 32 }} onClick={(e) => { e.stopPropagation(); onRemove() }} aria-label="Remove image"><IconTrash size={15} /></button>}
    />
  )
}

function PullSheet({ onClose, onPull }: { onClose: () => void; onPull: (img: string) => void }) {
  const [name, setName] = useState('nginx:latest')
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">Pull image</div>
        <div className="field">
          <label>Image name</label>
          <input className="input mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="nginx:latest" autoFocus />
          <div className="hint">Pulled from Docker Hub by default.</div>
        </div>
        <button className="btn primary full" onClick={() => onPull(name.trim())} disabled={!name.trim()}>
          Pull
        </button>
      </div>
    </div>
  )
}

// A persistent progress strip shown above the image list whenever a cleanup is
// in flight or just finished. Because the job lives in the store and is
// mirrored to localStorage, it stays accurate across navigation and survives a
// full page reload — the reloaded tab rebuilds it and carries on.
function CleanupBanner() {
  const job = useApp((s) => s.cleanupJob)
  const dismissCleanup = useApp((s) => s.dismissCleanup)

  if (!job) return null
  const running = job.status === 'running'
  const total = job.total || 1
  const pct = Math.round((job.done / total) * 100)
  const removed = job.total - job.failed
  const accent = running ? 'var(--amber)' : job.failed ? 'var(--red)' : 'var(--green)'
  const soft = running ? 'var(--amber-soft)' : job.failed ? 'var(--red-soft)' : 'var(--green-soft)'

  return (
    <div className="card" style={{ marginTop: 10, background: soft, borderColor: accent }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          {running ? <Spinner size={16} /> : <IconCheck size={16} style={{ color: accent }} />}
          <span style={{ fontWeight: 700, fontSize: 13, color: accent }}>{running ? 'Cleaning up images' : 'Cleanup finished'}</span>
        </div>
        <span style={{ fontWeight: 800, fontSize: 14, color: accent }}>{bytes(job.reclaimed)} freed</span>
      </div>

      <div className="bar" style={{ marginTop: 8 }}>
        <div style={{ width: `${pct}%`, background: accent }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 7, gap: 8 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
          {running
            ? `${job.done} of ${job.total} removed${job.failed ? ` · ${job.failed} failed` : ''}`
            : `${removed} removed${job.failed ? ` · ${job.failed} failed` : ''}`}
        </span>
        {!running && (
          <button className="link" onClick={dismissCleanup}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}

// The confirmation sheet that lists dangling images and kicks off the cleanup.
// The work itself runs in the store, so once started the sheet can be closed
// (or the page reloaded) without interrupting it — the banner tracks progress.
function CleanupSheet({ onClose }: { onClose: () => void }) {
  const activeEndpoint = useApp((s) => s.activeEndpoint)
  const job = useApp((s) => s.cleanupJob)
  const startImageCleanup = useApp((s) => s.startImageCleanup)
  const [dangling, setDangling] = useState<ImageT[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // While a job is already running, go straight to the progress view instead of
  // re-listing.
  const busy = job?.status === 'running'

  useEffect(() => {
    let alive = true
    getDanglingImages(activeEndpoint)
      .then((list) => {
        if (alive) setDangling(list)
      })
      .catch((e) => {
        if (alive) setError((e as Error).message)
      })
    return () => {
      alive = false
    }
  }, [activeEndpoint])

  const total = dangling?.reduce((s, i) => s + (i.Size || 0), 0) ?? 0
  const pct = job && job.total ? Math.round((job.done / job.total) * 100) : 0

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">Clean up images</div>

        {busy && job && (
          <>
            <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>Removing dangling images…</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--amber)', marginTop: 4 }}>{pct}%</div>
            </div>
            <div className="bar" style={{ marginTop: 6 }}>
              <div style={{ width: `${pct}%`, background: 'var(--amber)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
              <span>
                {job.done} of {job.total} removed
              </span>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>{bytes(job.reclaimed)} freed</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 12, lineHeight: 1.5 }}>
              This runs in the background, so you can close this sheet or leave the page — it keeps going and resumes
              even if you reload.
            </div>
            <button className="btn full" style={{ marginTop: 12 }} onClick={onClose}>
              Hide
            </button>
          </>
        )}

        {!busy && error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{error}</div>}

        {!busy && dangling === null && !error && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 26 }}>
            <Spinner size={22} />
          </div>
        )}

        {!busy && dangling !== null && dangling.length === 0 && (
          <div style={{ textAlign: 'center', padding: '18px 0 24px', color: 'var(--text-dim)' }}>
            <IconBroom size={30} style={{ color: 'var(--surface-3)', marginBottom: 6 }} />
            <div style={{ fontWeight: 650 }}>Nothing to clean up</div>
            <div style={{ fontSize: 12.5, marginTop: 3 }}>No dangling images found.</div>
          </div>
        )}

        {!busy && dangling !== null && dangling.length > 0 && (
          <>
            <div className="card-list" style={{ maxHeight: '42vh', overflowY: 'auto' }}>
              {dangling.map((img) => (
                <div key={img.Id} className="list-item">
                  <div className="item-icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                    <IconImage size={17} />
                  </div>
                  <div className="item-main">
                    <div className="item-title" style={{ fontSize: 12.5 }}>{shortId(img.Id, 18)}</div>
                    <div className="item-sub">Dangling · {timeAgo(img.Created)}</div>
                  </div>
                  <span className="chip">{bytes(img.Size)}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginTop: 10, background: 'var(--green-soft)', borderColor: 'var(--green)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>Storage to be freed</span>
                <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--green)' }}>{bytes(total)}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 3 }}>
                {dangling.length} dangling image{dangling.length === 1 ? '' : 's'}
              </div>
            </div>

            <button
              className="btn danger full"
              style={{ marginTop: 10 }}
              onClick={() => {
                void startImageCleanup()
                onClose()
              }}
            >
              <IconBroom size={16} /> Clean up {dangling.length} image{dangling.length === 1 ? '' : 's'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
