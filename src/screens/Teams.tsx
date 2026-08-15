import { useState } from 'react'
import { useApp } from '../store'
import { IconPlus, IconTrash, IconUsers } from '../components/Icons'
import { Empty, ListItem, Skeleton } from '../components/ui'
import { ConfirmModal } from './Images'

export function TeamsScreen() {
  const teams = useApp((s) => s.teams)
  const loading = useApp((s) => s.loading)
  const doRemoveTeam = useApp((s) => s.doRemoveTeam)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  return (
    <div className="page">
      {loading && !teams.length ? (
        <div className="card-list" style={{ marginTop: 8 }}>
          <Skeleton h={64} />
        </div>
      ) : (
        <div className="card-list" style={{ marginTop: 8 }}>
          {teams.map((t) => (
            <ListItem
              key={t.Id}
              icon={
                <div className="item-icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                  <IconUsers size={20} />
                </div>
              }
              title={t.Name}
              sub="Team"
              right={
                <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={(e) => { e.stopPropagation(); setConfirmId(t.Id) }}>
                  <IconTrash size={15} />
                </button>
              }
            />
          ))}
          {!teams.length && <Empty icon={<IconUsers size={40} />} title="No teams" />}
        </div>
      )}

      <button className="btn primary" style={{ width: '100%', marginTop: 8 }} onClick={() => setAddOpen(true)}>
        <IconPlus size={18} /> Add team
      </button>

      {addOpen && <AddTeamSheet onClose={() => setAddOpen(false)} />}
      {confirmId != null && (
        <ConfirmModal
          title="Remove team"
          body={`Remove ${teams.find((t) => t.Id === confirmId)?.Name}?`}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => { void doRemoveTeam(confirmId); setConfirmId(null) }}
        />
      )}
    </div>
  )
}

function AddTeamSheet({ onClose }: { onClose: () => void }) {
  const doAddTeam = useApp((s) => s.doAddTeam)
  const [name, setName] = useState('')

  const submit = async () => {
    if (!name.trim()) return
    await doAddTeam(name.trim())
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">Add team</div>
        <div className="field">
          <label>Team name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="developers" autoFocus autoCapitalize="none" />
        </div>
        <button className="btn primary full" onClick={submit} disabled={!name.trim()}>
          Create team
        </button>
      </div>
    </div>
  )
}
