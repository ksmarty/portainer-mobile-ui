import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { IconBox, IconEdit, IconFile, IconPlay, IconStack, IconStop, IconTrash } from '../components/Icons'
import { Empty, KV, Pill, SectionTitle, Tag } from '../components/ui'
import { portLabel, stateColor, stateLabel, timeAgo } from '../lib/utils'
import type { Container } from '../lib/types'
import { ConfirmModal } from '../components/ConfirmModal'

export function StackDetailScreen({ id, fileOverride }: { id: number; fileOverride?: string }) {
  const stacks = useApp((s) => s.stacks)
  const containers = useApp((s) => s.containers)
  const openStackFile = useApp((s) => s.openStackFile)
  const doStackAction = useApp((s) => s.doStackAction)
  const doRemoveStack = useApp((s) => s.doRemoveStack)
  const navigate = useApp((s) => s.navigate)
  const back = useApp((s) => s.back)
  const [confirm, setConfirm] = useState(false)

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
          <SectionTitle>Environment</SectionTitle>
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {stack.Env.map((e) => (
              <Tag key={e.name}>{e.name}={e.value}</Tag>
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
    </div>
  )
}

function StackContainerRow({ c, onClick }: { c: Container; onClick: () => void }) {
  const color = stateColor(c.State)
  return (
    <div className="list-item" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}>
      <div className="item-icon" style={{ background: `${color}22`, color }}>
        <IconBox size={18} />
      </div>
      <div className="item-main">
        <div className="item-title">{c.Names[0]?.replace('/', '')}</div>
        <div className="item-sub">
          <span className="mono">{c.Image}</span>
          <span style={{ margin: '0 5px', color: 'var(--text-faint)' }}>·</span>
          {portLabel(c.Ports)}
        </div>
      </div>
      <Pill color={color}>{stateLabel(c.State)}</Pill>
      <span className="chev">›</span>
    </div>
  )
}
