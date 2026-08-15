import { useState } from 'react'
import { useApp } from '../store'
import { IconPlus, IconTrash, IconUser } from '../components/Icons'
import { Empty, ListItem, Pill, Skeleton } from '../components/ui'
import { roleName } from '../lib/utils'
import { ConfirmModal } from '../components/ConfirmModal'

export function UsersScreen() {
  const users = useApp((s) => s.users)
  const loading = useApp((s) => s.loading)
  const doRemoveUser = useApp((s) => s.doRemoveUser)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  return (
    <div className="page">
      {loading && !users.length ? (
        <div className="card-list" style={{ marginTop: 8 }}>
          <Skeleton h={64} />
          <Skeleton h={64} />
        </div>
      ) : (
        <div className="card-list" style={{ marginTop: 8 }}>
          {users.map((u) => (
            <ListItem
              key={u.Id}
              icon={
                <div className="item-icon" style={{ background: u.Role === 1 ? 'var(--purple-soft)' : 'var(--surface-3)', color: u.Role === 1 ? 'var(--purple)' : 'var(--text-dim)' }}>
                  <IconUser size={20} />
                </div>
              }
              title={u.Username}
              sub={roleName(u.Role)}
              right={
                <>
                  {u.Role === 1 && <Pill color="var(--purple)">admin</Pill>}
                  {u.Username !== 'admin' && (
                    <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={(e) => { e.stopPropagation(); setConfirmId(u.Id) }}>
                      <IconTrash size={15} />
                    </button>
                  )}
                </>
              }
            />
          ))}
          {!users.length && <Empty icon={<IconUser size={40} />} title="No users" />}
        </div>
      )}

      <button className="btn primary" style={{ width: '100%', marginTop: 8 }} onClick={() => setAddOpen(true)}>
        <IconPlus size={18} /> Add user
      </button>

      {addOpen && <AddUserSheet onClose={() => setAddOpen(false)} />}
      {confirmId != null && (
        <ConfirmModal
          title="Remove user"
          body={`Remove ${users.find((u) => u.Id === confirmId)?.Username}?`}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => { void doRemoveUser(confirmId); setConfirmId(null) }}
        />
      )}
    </div>
  )
}

function AddUserSheet({ onClose }: { onClose: () => void }) {
  const doAddUser = useApp((s) => s.doAddUser)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(2)

  const submit = async () => {
    if (!username.trim() || !password.trim()) return
    await doAddUser(username.trim(), password, role)
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">Add user</div>
        <div className="field">
          <label>Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="jdoe" autoFocus autoCapitalize="none" />
        </div>
        <div className="field">
          <label>Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="field">
          <label>Role</label>
          <select className="select" value={role} onChange={(e) => setRole(Number(e.target.value))}>
            <option value={2}>Operator</option>
            <option value={3}>Standard User</option>
            <option value={4}>Help Desk</option>
          </select>
        </div>
        <button className="btn primary full" onClick={submit} disabled={!username.trim() || !password.trim()}>
          Create user
        </button>
      </div>
    </div>
  )
}
