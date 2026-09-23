import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../store'
import { IconBroom, IconImage, IconPlus, IconSearch, IconTrash } from '../components/Icons'
import { Empty, ListItem, Skeleton, Spinner } from '../components/ui'
import { bytes, shortId, timeAgo } from '../lib/utils'
import { getDanglingImages, removeImage } from '../lib/api'
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

function CleanupSheet({ onClose }: { onClose: () => void }) {
  const activeEndpoint = useApp((s) => s.activeEndpoint)
  const refresh = useApp((s) => s.refresh)
  const toast = useApp((s) => s.toast)
  const [dangling, setDangling] = useState<ImageT[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number; reclaimed: number } | null>(null)

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

  // Remove images one at a time instead of a single prune request: the prune
  // call can run past the request timeout on a busy host, and per-image deletes
  // give us real progress to show.
  const prune = async () => {
    if (!dangling?.length) return
    const list = dangling
    let done = 0
    let reclaimed = 0
    let failed = 0
    setProgress({ done: 0, total: list.length, reclaimed: 0 })
    for (const img of list) {
      try {
        await removeImage(activeEndpoint, img.Id, true)
        reclaimed += img.Size || 0
      } catch {
        failed++
      }
      done++
      setProgress({ done, total: list.length, reclaimed })
    }
    await refresh()
    if (failed === 0) {
      toast(`Freed ${bytes(reclaimed)} (${done} image${done === 1 ? '' : 's'})`, 'success')
    } else {
      toast(`Removed ${done - failed} of ${list.length} images`, 'error')
    }
    onClose()
  }

  const busy = progress !== null
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="overlay" onClick={busy ? undefined : onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">Clean up images</div>

        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{error}</div>}

        {dangling === null && !error && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 26 }}>
            <Spinner size={22} />
          </div>
        )}

        {dangling !== null && dangling.length === 0 && (
          <div style={{ textAlign: 'center', padding: '18px 0 24px', color: 'var(--text-dim)' }}>
            <IconBroom size={30} style={{ color: 'var(--surface-3)', marginBottom: 6 }} />
            <div style={{ fontWeight: 650 }}>Nothing to clean up</div>
            <div style={{ fontSize: 12.5, marginTop: 3 }}>No dangling images found.</div>
          </div>
        )}

        {dangling !== null && dangling.length > 0 && (
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
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                  {progress ? 'Freed so far' : 'Storage to be freed'}
                </span>
                <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--green)' }}>
                  {bytes(progress ? progress.reclaimed : total)}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 3 }}>
                {progress
                  ? `${progress.done} of ${progress.total} images removed`
                  : `${dangling.length} dangling image${dangling.length === 1 ? '' : 's'}`}
              </div>
            </div>

            {progress ? (
              <div style={{ marginTop: 12 }}>
                <div className="bar">
                  <div style={{ width: `${pct}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                  <span>Removing images…</span>
                  <span>{pct}%</span>
                </div>
              </div>
            ) : (
              <button className="btn danger full" style={{ marginTop: 10 }} onClick={prune}>
                <IconBroom size={16} /> Clean up {dangling.length} image{dangling.length === 1 ? '' : 's'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
