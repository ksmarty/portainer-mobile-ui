import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { IconArrowRight, IconCheck, IconCopy, IconPlus, IconStack, IconTrash } from '../components/Icons'
import { CodeEditor, type CodeEditorHandle } from '../components/CodeEditor'
import { Spinner, Tag } from '../components/ui'
import { dockerRunToCompose, isValidDockerRun } from '../lib/composerize'
import { formatCompose, normalizeCompose } from '../lib/compose'
import { sanitizeName } from '../lib/utils'
import { getStackFile } from '../lib/api'

const SAMPLE_COMPOSE = `version: "3.8"
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    environment:
      - NGINX_HOST=example.com
  db:
    image: postgres:16-alpine
    volumes:
      - db_data:/var/lib/postgresql/data
volumes:
  db_data: {}
`

const SAMPLE_RUN = `docker run -d --name my-nginx \\
  -p 8080:80 \\
  -v nginx_data:/usr/share/nginx/html \\
  -e NGINX_HOST=example.com \\
  --restart unless-stopped \\
  nginx:alpine`

const ENV_SUGGESTIONS = [
  'DOMAIN', 'TZ', 'NODE_ENV', 'PORT', 'DATABASE_URL', 'API_URL', 'LOG_LEVEL',
  'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB',
  'MYSQL_ROOT_PASSWORD', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD',
  'REDIS_PASSWORD', 'NGINX_HOST', 'NGINX_PORT',
]

interface EnvRow {
  key: string
  value: string
}

export function StackEditorScreen({ stackId }: { stackId?: number }) {
  const stacks = useApp((s) => s.stacks)
  const doDeployStack = useApp((s) => s.doDeployStack)
  const doUpdateStack = useApp((s) => s.doUpdateStack)
  const back = useApp((s) => s.back)
  const toast = useApp((s) => s.toast)

  const existing = useMemo(() => stacks.find((s) => s.Id === stackId), [stacks, stackId])

  const [name, setName] = useState(existing?.Name || '')
  const [mode, setMode] = useState<'compose' | 'env' | 'run'>('compose')
  const [compose, setCompose] = useState(existing?.File || SAMPLE_COMPOSE)
  const [run, setRun] = useState(SAMPLE_RUN)
  const [envRows, setEnvRows] = useState<EnvRow[]>(() =>
    existing?.Env ? existing.Env.map((e) => ({ key: e.name, value: e.value })) : [],
  )
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<{ error?: string; warnings: string[] }>({ warnings: [] })
  const editorRef = useRef<CodeEditorHandle>(null)

  // When editing an existing stack, load its current compose file — the stack
  // list endpoint doesn't include the file contents.
  useEffect(() => {
    if (!stackId) return
    if (existing?.File) {
      setCompose(existing.File)
      return
    }
    let alive = true
    getStackFile(stackId)
      .then((f) => {
        if (alive) setCompose(f)
      })
      .catch(() => {}) // keep the sample if the file can't be loaded
    return () => {
      alive = false
    }
  }, [stackId, existing?.File])

  const convert = () => {
    if (!isValidDockerRun(run)) {
      toast('Paste a full command starting with "docker run"', 'error')
      return
    }
    const res = dockerRunToCompose(run)
    setCompose(res.yaml)
    if (!name.trim()) setName(sanitizeName(res.serviceName))
    setMode('compose')
    setNotes({ warnings: res.warnings })
  }

  const applyFormat = () => {
    const res = formatCompose(compose)
    if (res.error) {
      setNotes({ error: res.error, warnings: [] })
      return
    }
    setCompose(res.yaml)
    setNotes({ warnings: [] })
    toast('Formatted', 'success')
  }

  const applySchema = () => {
    const res = normalizeCompose(compose)
    if (res.error) {
      setNotes({ error: res.error, warnings: [] })
      return
    }
    setCompose(res.yaml)
    setNotes({ warnings: res.warnings })
    toast('Schema applied', 'success')
  }

  const save = async () => {
    if (!name.trim() || !compose.trim()) return
    const env = envRows.filter((r) => r.key.trim()).map((r) => ({ name: r.key.trim(), value: r.value }))
    setBusy(true)
    try {
      if (existing) {
        await doUpdateStack(existing.Id, compose, env)
      } else {
        await doDeployStack(sanitizeName(name), compose, env)
      }
      back()
    } catch {
      /* handled by store */
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(compose)
      toast('Copied', 'success')
    } catch {
      toast('Copy failed', 'error')
    }
  }

  const updateEnvRow = (i: number, patch: Partial<EnvRow>) => {
    setEnvRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const addEnvRow = (key = '') => {
    setEnvRows((rows) => [...rows, { key, value: '' }])
  }

  const removeEnvRow = (i: number) => {
    setEnvRows((rows) => rows.filter((_, idx) => idx !== i))
  }

  return (
    <div className={mode === 'compose' ? 'page page-editor' : 'page'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Stack name"
            disabled={!!existing}
            autoCapitalize="none"
          />
        </div>
        {existing && <Tag>{existing.Name}</Tag>}
      </div>

      <div className="segmented" style={{ marginTop: 8 }}>
        <button className={mode === 'compose' ? 'active' : ''} onClick={() => setMode('compose')}>
          Compose
        </button>
        <button className={mode === 'env' ? 'active' : ''} onClick={() => setMode('env')}>
          Env vars
        </button>
        <button className={mode === 'run' ? 'active' : ''} onClick={() => setMode('run')}>
          run → compose
        </button>
      </div>

      {mode === 'compose' && (
        <div style={{ marginTop: 8, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', overflowX: 'auto' }}>
            <button className="btn sm ghost" onClick={applyFormat}>Format</button>
            <button className="btn sm ghost" onClick={applySchema}>Apply schema</button>
            <div style={{ flex: 1 }} />
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={copy} aria-label="Copy">
              <IconCopy size={15} />
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginTop: 6 }}>
            <CodeEditor
              ref={editorRef}
              value={compose}
              onChange={setCompose}
              minHeight={160}
              grow
              placeholder={'services:\n  app:\n    image: nginx:alpine'}
              extraEnv={envRows.map((r) => r.key.trim()).filter(Boolean)}
            />
          </div>

          {notes.error && (
            <div className="card" style={{ marginTop: 6, borderColor: 'var(--red)', background: 'var(--red-soft)' }}>
              <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 600 }}>Parse error</div>
              <div className="mono" style={{ color: 'var(--red)', fontSize: 11.5, marginTop: 2 }}>{notes.error}</div>
            </div>
          )}
          {notes.warnings.length > 0 && (
            <div className="card" style={{ marginTop: 6 }}>
              {notes.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-dim)', padding: '3px 0', display: 'flex', gap: 6 }}>
                  <span style={{ color: 'var(--amber)' }}>•</span>
                  {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'env' && (
        <div style={{ marginTop: 8 }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Stack environment variables</span>
              <button className="btn sm ghost" onClick={() => addEnvRow()}>
                <IconPlus size={14} /> Add
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
              Used for ${'{'}VAR{'}'} interpolation in the compose file.
            </div>

            {envRows.length === 0 && (
              <div style={{ color: 'var(--text-faint)', fontSize: 12.5, padding: '10px 0', textAlign: 'center' }}>
                No variables yet. Add one or tap a suggestion below.
              </div>
            )}

            {envRows.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  className="input mono"
                  style={{ flex: '1 1 40%' }}
                  value={row.key}
                  onChange={(e) => updateEnvRow(i, { key: e.target.value })}
                  placeholder="KEY"
                  autoCapitalize="none"
                  autoCorrect="off"
                  list="env-keys"
                />
                <input
                  className="input"
                  style={{ flex: '1 1 60%' }}
                  value={row.value}
                  onChange={(e) => updateEnvRow(i, { value: e.target.value })}
                  placeholder="value"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => removeEnvRow(i)} aria-label="Remove">
                  <IconTrash size={15} />
                </button>
              </div>
            ))}
          </div>

          <datalist id="env-keys">
            {ENV_SUGGESTIONS.map((key) => (
              <option key={key} value={key} />
            ))}
          </datalist>
        </div>
      )}

      {mode === 'run' && (
        <div className="field" style={{ marginTop: 8 }}>
          <label>Paste a docker run command</label>
          <textarea
            className="textarea"
            style={{ minHeight: 150, fontSize: 12 }}
            value={run}
            onChange={(e) => setRun(e.target.value)}
            spellCheck={false}
          />
          <button className="btn primary full" style={{ marginTop: 8 }} onClick={convert} disabled={!run.trim()}>
            <IconArrowRight size={17} /> Convert to compose
          </button>
          <div className="hint" style={{ marginTop: 6 }}>
            Supports -p, -v, -e, --env-file, --restart, --network, --link, -m, --cpus, --entrypoint and more.
          </div>
        </div>
      )}

      <button
        className="btn primary full"
        style={{ marginTop: 14 }}
        onClick={save}
        disabled={busy || !name.trim() || !compose.trim()}
      >
        {busy ? <Spinner size={17} /> : existing ? <IconCheck size={17} /> : <IconStack size={17} />}
        {busy ? 'Saving…' : existing ? 'Save changes' : 'Deploy stack'}
      </button>
    </div>
  )
}
