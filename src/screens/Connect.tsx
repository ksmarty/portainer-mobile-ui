import { useState } from 'react'
import { useApp } from '../store'
import { IconBox, IconKey } from '../components/Icons'
import { Spinner } from '../components/ui'

export function ConnectScreen() {
  const connect = useApp((s) => s.connect)
  const toggleDemo = useApp((s) => s.toggleDemo)
  const loading = useApp((s) => s.loading)
  const error = useApp((s) => s.error)

  const [url, setUrl] = useState('https://portainer.example.com')
  const [token, setToken] = useState('')
  const [isJwt, setIsJwt] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || !token.trim()) return
    try {
      await connect(url.trim(), token.trim(), isJwt)
    } catch {
      /* handled by store */
    }
  }

  return (
    <div className="page" style={{ paddingTop: 20 }}>
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
        <h1 style={{ fontSize: 19, margin: '12px 0 2px', letterSpacing: '-0.02em' }}>Connect to Portainer</h1>
        <p style={{ color: 'var(--text-faint)', margin: 0, fontSize: 14 }}>
          Enter your Portainer URL and API key or JWT token.
        </p>
      </div>

      <form onSubmit={submit}>
        <div className="field">
          <label>Portainer URL</label>
          <input
            className="input"
            type="url"
            placeholder="https://portainer.example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>

        <div className="field">
          <label>API key / JWT token</label>
          <input
            className="input mono"
            placeholder="ptr_xxxx or eyJhbGciOi…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <div className="hint">
            <IconKey size={12} style={{ verticalAlign: -2 }} /> Create an access token in Portainer → My account → Access
            tokens.
          </div>
        </div>

        <div className="switch-row" style={{ marginBottom: 12 }}>
          <div className="grow">
            <div className="t">JWT token</div>
            <div className="d">Toggle if using a bearer token from /auth</div>
          </div>
          <button type="button" className={`switch ${isJwt ? 'on' : ''}`} onClick={() => setIsJwt(!isJwt)} />
        </div>

        {error && (
          <div style={{ color: 'var(--red)', fontSize: 13.5, marginBottom: 14, fontWeight: 500 }}>{error}</div>
        )}

        <button className="btn primary full" type="submit" disabled={loading || !url.trim() || !token.trim()}>
          {loading ? <Spinner size={18} /> : 'Connect'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button
          className="btn ghost"
          onClick={toggleDemo}
          style={{ color: 'var(--accent-2)' }}
        >
          Explore the demo instead
        </button>
      </div>
    </div>
  )
}
