import { useState } from 'react'
import { useApp } from '../store'
import { IconBox } from '../components/Icons'
import { Spinner } from '../components/ui'

export function LoginScreen() {
  const login = useApp((s) => s.login)
  const toggleDemo = useApp((s) => s.toggleDemo)
  const loading = useApp((s) => s.loading)
  const error = useApp((s) => s.error)

  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(username.trim(), password)
    } catch {
      /* handled by store */
    }
  }

  return (
    <div className="page" style={{ paddingTop: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 15,
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 16px 40px rgba(61,123,253,0.35)',
          }}
        >
          <IconBox size={34} />
        </div>
        <h1 style={{ fontSize: 19, margin: '12px 0 2px', letterSpacing: '-0.02em' }}>Portainer Mobile</h1>
        <p style={{ color: 'var(--text-faint)', margin: 0, fontSize: 14 }}>Demo mode · sign in to continue</p>
      </div>

      <form onSubmit={submit}>
        <div className="field">
          <label>Username</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 13.5, marginBottom: 14 }}>{error}</div>}

        <button className="btn primary full" type="submit" disabled={loading}>
          {loading ? <Spinner size={18} /> : 'Sign in'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button className="btn ghost" onClick={toggleDemo} style={{ color: 'var(--accent-2)' }}>
          Connect to a real Portainer instead
        </button>
      </div>
    </div>
  )
}
