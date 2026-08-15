import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { IconDownload, IconImage, IconPlus, IconSearch, IconTrash } from '../components/Icons'
import { Empty, ListItem, Skeleton } from '../components/ui'
import { bytes, formatDate, shortId, timeAgo } from '../lib/utils'
import type { Image as ImageT } from '../lib/types'

export function ImagesScreen() {
  const images = useApp((s) => s.images)
  const loading = useApp((s) => s.loading)
  const doRemoveImage = useApp((s) => s.doRemoveImage)
  const doPullImage = useApp((s) => s.doPullImage)
  const [query, setQuery] = useState('')
  const [pullOpen, setPullOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return images
    const q = query.toLowerCase()
    return images.filter((i) => i.RepoTags?.some((t) => t.toLowerCase().includes(q)) || i.Id.includes(q))
  }, [images, query])

  return (
    <div className="page">
      <div style={{ margin: '12px 0' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
          <input className="input" style={{ paddingLeft: 42 }} placeholder="Search images…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {loading && !images.length ? (
        <div className="card-list">
          <Skeleton h={64} />
          <Skeleton h={64} />
          <Skeleton h={64} />
        </div>
      ) : (
        <div className="card-list">
          {filtered.map((img) => (
            <ListItem
              key={img.Id}
              icon={
                <div className="item-icon" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
                  <IconImage size={20} />
                </div>
              }
              title={<span className="mono" style={{ fontSize: 13.5 }}>{img.RepoTags?.[0] || shortId(img.Id)}</span>}
              sub={`${bytes(img.Size)} · ${img.Containers} container${img.Containers === 1 ? '' : 's'} · ${timeAgo(img.Created)}`}
              right={<TagBtn onClick={() => setConfirmId(img.Id)} />}
            />
          ))}
          {!filtered.length && <Empty icon={<IconImage size={40} />} title="No images" sub="Pull an image to get started" />}
        </div>
      )}

      <button
        onClick={() => setPullOpen(true)}
        className="btn primary"
        style={{ width: '100%', marginTop: 8 }}
      >
        <IconDownload size={18} /> Pull image
      </button>

      {pullOpen && <PullSheet onClose={() => setPullOpen(false)} onPull={(img) => { void doPullImage(img); setPullOpen(false) }} />}
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

function TagBtn({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={(e) => { e.stopPropagation(); onClick() }} aria-label="Remove image">
      <IconTrash size={16} />
    </button>
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

export function ConfirmModal({ title, body, onCancel, onConfirm }: { title: string; body: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="overlay overlay-center" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{title}</div>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: '0 0 18px' }}>{body}</p>
        <div className="btn-row">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn danger" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  )
}
