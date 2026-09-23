import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import {
  IconBox,
  IconChevronRight,
  IconCopy,
  IconDownload,
  IconEdit,
  IconEye,
  IconFile,
  IconKey,
  IconPlay,
  IconStack,
  IconStop,
  IconTrash,
} from '../components/Icons'
import { Empty, KV, ListItem, Pill, SectionTitle, Spinner } from '../components/ui'
import { copyText, portLabel, stateColor, stateLabel, timeAgo } from '../lib/utils'
import type { Container, Image } from '../lib/types'
import { ConfirmModal } from '../components/ConfirmModal'

type ImageState = 'current' | 'stale' | 'unknown'

// A container is "up to date" when the image it was created from still matches
// the locally stored image for its tag. If the tag now points at a different
// image id, a newer image has been pulled and the container needs recreating.
function imageState(c: Container, images: Image[]): ImageState {
  if (!c.Image) return 'unknown'
  const img = images.find((i) => i.RepoTags?.includes(c.Image!))
  if (!img) return 'unknown'
  const local = (img.Id || '').replace(/^sha256:/, '')
  const used = (c.ImageID || '').replace(/^sha256:/, '')
  if (!local || !used) return 'unknown'
  return local === used ? 'current' : 'stale'
}

export function StackDetailScreen({ id, fileOverride }: { id: number; fileOverride?: string }) {
  const stacks = useApp((s) => s.stacks)
  const containers = useApp((s) => s.containers)
  const images = useApp((s) => s.images)
  const openStackFile = useApp((s) => s.openStackFile)
  const doStackAction = useApp((s) => s.doStackAction)
  const doRemoveStack = useApp((s) => s.doRemoveStack)
  const doPullStackImages = useApp((s) => s.doPullStackImages)
  const navigate = useApp((s) => s.navigate)
  const back = useApp((s) => s.back)
  const [confirm, setConfirm] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [envVar, setEnvVar] = useState<{ name: string; value: string } | null>(null)

  const stack = useMemo(() => stacks.find((s) => s.Id === id), [stacks, id])

  const stackContainers = useMemo(() => {
    if (!stack) return []
    const name = stack.Name.toLowerCase()
    return containers
      .filter((c) => {
        const project = (c.Labels?.['com.docker.compose.project'] || c.Labels?.['com.docker.compose.stack'] || '').toLowerCase()
        if (project && project === name) return true
        const cname = (c.Names[0] || '').replace(/^\//, '').toLowerCase()
        return cname === name || cname.startsWith(name + '-') || cname.startsWith(name + '_')
      })
      .sort((a, b) => (a.Names[0] || '').localeCompare(b.Names[0] || ''))
  }, [containers, stack])

  useEffect(() => {
    if (!stack && !fileOverride) back()
  }, [stack, fileOverride, back])

  if (!stack && !fileOverride) return null

  const file = fileOverride ?? null

  const pullLatestImages = async () => {
    setPulling(true)
    try {
      await doPullStackImages(id)
    } catch {
      /* toast handled in the store */
    } finally {
      setPulling(false)
    }
  }

  return (
    <div className="page">
      {stack && (
        <div className="card" style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div className="item-icon" style={{ background: 'var(--purple-soft)', color: 'var(--purple)', width: 42, height: 42 }}>
              <IconStack size={21} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 750 }}>{stack.Name}</div>
              <div style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>{stack.EntryPoint || 'docker-compose.yml'}</div>
            </div>
            <Pill color={stack.Status === 1 ? 'var(--green)' : 'var(--amber)'}>{stack.Status === 1 ? 'active' : 'inactive'}</Pill>
          </div>

          <div className="btn-row">
            <button className="btn" onClick={() => void doStackAction(stack.Id, 'start')}>
              <IconPlay size={15} /> Start
            </button>
            <button className="btn" onClick={() => void doStackAction(stack.Id, 'stop')}>
              <IconStop size={15} /> Stop
            </button>
          </div>
          <div className="btn-row">
            <button className="btn" onClick={() => navigate({ name: 'stack-edit', title: `Edit ${stack.Name}`, props: { id: stack.Id } })}>
              <IconEdit size={15} /> Edit
            </button>
            <button className="btn ghost" onClick={() => void openStackFile(stack.Id)}>
              <IconFile size={15} /> View file
            </button>
          </div>
          <div className="btn-row">
            <button className="btn ghost" style={{ color: 'var(--red)' }} onClick={() => setConfirm(true)}>
              <IconTrash size={15} /> Remove
            </button>
          </div>
          <div className="btn-row">
            <button className="btn primary" disabled={pulling} onClick={() => void pullLatestImages()}>
              {pulling ? <Spinner size={15} /> : <IconDownload size={15} />}
              {pulling ? 'Pulling images…' : 'Pull latest & update'}
            </button>
          </div>

          <div className="divider" />
          <KV k="Created" v={timeAgo(stack.CreationDate)} />
          <KV k="Created by" v={stack.CreatedBy || '—'} />
          <KV k="Type" v={stack.Type === 1 ? 'Swarm' : 'Compose'} />
          <KV k="Containers" v={String(stackContainers.length)} />
        </div>
      )}

      {stack && (
        <>
          <SectionTitle>Containers</SectionTitle>
          <div className="card-list">
            {stackContainers.map((c) => (
              <StackContainerRow
                key={c.Id}
                c={c}
                imgState={imageState(c, images)}
                onClick={() => navigate({ name: 'container-detail', title: c.Names[0]?.replace('/', ''), props: { id: c.Id } })}
              />
            ))}
            {!stackContainers.length && (
              <Empty icon={<IconBox size={34} />} title="No containers in this stack" sub="Deploy the stack to start its services" />
            )}
          </div>
        </>
      )}

      {stack?.Env && stack.Env.length > 0 && (
        <>
          <SectionTitle>Environment ({stack.Env.length})</SectionTitle>
          <div className="card-list">
            {stack.Env.map((e) => (
              <ListItem
                key={e.name}
                icon={
                  <div className="item-icon" style={{ background: 'var(--surface-3)', color: 'var(--text-dim)' }}>
                    <IconKey size={17} />
                  </div>
                }
                title={<span className="mono" style={{ fontSize: 12.5 }}>{e.name}</span>}
                onClick={() => setEnvVar(e)}
              />
            ))}
          </div>
        </>
      )}

      {file && (
        <>
          <SectionTitle>Compose file</SectionTitle>
          <div className="code-block">{file}</div>
        </>
      )}

      {confirm && (
        <ConfirmModal
          title="Remove stack"
          body={`Remove ${stack?.Name}? All its containers will be removed.`}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false)
            void doRemoveStack(id)
            back()
          }}
        />
      )}

      {envVar && <EnvValueModal name={envVar.name} value={envVar.value} onClose={() => setEnvVar(null)} />}
    </div>
  )
}

function EnvValueModal({ name, value, onClose }: { name: string; value: string; onClose: () => void }) {
  const toast = useApp((s) => s.toast)
  const [show, setShow] = useState(false)

  const copy = async () => {
    try {
      await copyText(value)
      toast('Value copied', 'success')
    } catch {
      toast('Copy failed', 'error')
    }
  }

  const masked = value ? '•'.repeat(Math.min(18, Math.max(8, value.length))) : '(empty)'

  return (
    <div className="overlay overlay-center" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Environment variable</div>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="field">
          <label>Key</label>
          <div className="value-box mono">{name}</div>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label>Value</label>
          <div className="value-box" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="mono" style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
              {show ? value || '(empty)' : masked}
            </span>
            <button
              className="icon-btn"
              style={{ width: 30, height: 30 }}
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Hide value' : 'Show value'}
            >
              <IconEye size={16} />
            </button>
            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={copy} aria-label="Copy value">
              <IconCopy size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StackContainerRow({ c, imgState, onClick }: { c: Container; imgState: ImageState; onClick: () => void }) {
  const color = stateColor(c.State)
  return (
    <div className="list-item" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}>
      <div className="item-icon" style={{ background: `${color}22`, color }}>
        <IconBox size={18} />
      </div>
      <div className="item-main">
        <div className="item-title">
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.Names[0]?.replace('/', '')}
          </span>
          {imgState === 'stale' && <Pill color="var(--amber)">update</Pill>}
          {imgState === 'current' && <Pill color="var(--green)">current</Pill>}
        </div>
        <div className="item-sub">
          <span className="mono">{c.Image}</span>
          <span style={{ margin: '0 5px', color: 'var(--text-faint)' }}>·</span>
          {portLabel(c.Ports)}
        </div>
      </div>
      <Pill color={color}>{stateLabel(c.State)}</Pill>
      <span className="chev">
        <IconChevronRight size={18} />
      </span>
    </div>
  )
}
