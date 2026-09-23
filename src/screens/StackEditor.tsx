import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { IconArrowRight, IconCheck, IconCopy, IconPlus, IconStack, IconTrash } from '../components/Icons'
import { CodeEditor, type CodeEditorHandle } from '../components/CodeEditor'
import { Spinner } from '../components/ui'
import { dockerRunToCompose, isValidDockerRun } from '../lib/composerize'
import { formatCompose, mergeCompose, normalizeCompose } from '../lib/compose'
import { ENV_VAR_NAMES } from '../lib/suggest'
import { copyText, sanitizeName } from '../lib/utils'
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
  const isEdit = !!stackId

  const [name, setName] = useState(existing?.Name || '')
  const [mode, setMode] = useState<'compose' | 'env' | 'run'>('compose')
  // Editing an existing stack: never show the sample — start empty and show a
  // loader until the real file arrives (or reuse the cached copy if we have it).
  const [compose, setCompose] = useState(existing?.File ?? (isEdit ? '' : SAMPLE_COMPOSE))
  const [composeTouched, setComposeTouched] = useState(false)
  const [run, setRun] = useState(SAMPLE_RUN)
  const [envRows, setEnvRows] = useState<EnvRow[]>(() =>
    existing?.Env ? existing.Env.map((e) => ({ key: e.name, value: e.value })) : [],
  )
  const [busy, setBusy] = useState(false)
  const [loadingFile, setLoadingFile] = useState(isEdit && !existing?.File)
  const [loadError, setLoadError] = useState('')
  const [notes, setNotes] = useState<{ error?: string; warnings: string[] }>({ warnings: [] })
  const [envRaw, setEnvRaw] = useState(false)
  const [envFocus, setEnvFocus] = useState<number | null>(null)
  const editorRef = useRef<CodeEditorHandle>(null)

  const loadFile = useMemo(
    () => async () => {
      if (!stackId) return
      setLoadingFile(true)
      setLoadError('')
      try {
        setCompose(await getStackFile(stackId))
      } catch (e) {
        setLoadError((e as Error).message)
      } finally {
        setLoadingFile(false)
      }
    },
    [stackId],
  )

  // When editing an existing stack, load its current compose file — the stack
  // list endpoint doesn't include the file contents.
  useEffect(() => {
    if (!stackId) return
    if (existing?.File) {
      setCompose(existing.File)
      setLoadingFile(false)
      setLoadError('')
      return
    }
    void loadFile()
  }, [stackId, existing?.File, loadFile])

  const convert = () => {
    if (!isValidDockerRun(run)) {
      toast('Paste a full command starting with "docker run"', 'error')
      return
    }
    const res = dockerRunToCompose(run)
    if (!res.yaml) {
      toast(res.warnings[res.warnings.length - 1] || 'Could not convert command', 'error')
      return
    }
    // Append to the existing compose rather than replacing it. For a brand-new
    // stack whose sample hasn't been touched, start clean instead.
    const base = !isEdit && !composeTouched ? '' : compose
    const merged = mergeCompose(base, res.yaml)
    if (merged.error) {
      setNotes({ error: merged.error, warnings: [] })
      return
    }
    setCompose(merged.yaml)
    setNotes({ warnings: [...res.warnings, ...merged.warnings] })
    if (!isEdit && !name.trim()) setName(sanitizeName(res.serviceName))
    setMode('compose')
    toast('Service added to compose', 'success')
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
      await copyText(compose)
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
    setEnvFocus(envRows.length)
  }

  const removeEnvRow = (i: number) => {
    setEnvRows((rows) => rows.filter((_, idx) => idx !== i))
    setEnvFocus(null)
  }

  // The raw .env textarea is uncontrolled; fold its text back into rows so it
  // isn't silently lost when leaving the tab.
  const commitRawEnv = () => {
    if (!envRaw) return
    const ta = document.getElementById('env-raw') as HTMLTextAreaElement | null
    if (ta) {
      const parsed = ta.value
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => {
          const eq = l.indexOf('=')
          return eq > 0 ? { key: l.slice(0, eq).trim(), value: l.slice(eq + 1).trim() } : { key: l, value: '' }
        })
        .filter((r) => r.key)
      setEnvRows(parsed)
    }
    setEnvRaw(false)
  }

  const selectMode = (next: 'compose' | 'env' | 'run') => {
    if (next !== 'env') commitRawEnv()
    if (next !== 'env') setEnvFocus(null)
    setMode(next)
  }

  // Env vars are local until the compose file is saved. "Save" here keeps the
  // edits and returns to the YAML tab so the stack itself can be updated.
  const saveEnv = () => {
    commitRawEnv()
    setEnvFocus(null)
    setMode('compose')
  }

  const envSuggestions = useMemo(() => {
    if (envFocus === null) return []
    const q = (envRows[envFocus]?.key || '').toLowerCase()
    const pool = [...new Set([...envRows.map((r) => r.key.trim()).filter(Boolean), ...ENV_VAR_NAMES])]
    return pool
      .filter((k) => k.toLowerCase().includes(q) && k.toLowerCase() !== q)
      .slice(0, 8)
  }, [envFocus, envRows])

  const editorReady = !loadingFile && !loadError && !!compose.trim()

  return (
    <div className={mode === 'compose' ? 'page page-editor' : 'page'}>
      {!isEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Stack name"
            autoCapitalize="none"
          />
        </div>
      )}

      <div className="segmented" style={{ marginTop: isEdit ? 8 : 8 }}>
        <button className={mode === 'compose' ? 'active' : ''} onClick={() => selectMode('compose')}>
          Compose
        </button>
        <button className={mode === 'env' ? 'active' : ''} onClick={() => selectMode('env')}>
          Env vars
        </button>
        <button className={mode === 'run' ? 'active' : ''} onClick={() => selectMode('run')}>
          run → compose
        </button>
      </div>

      {mode === 'compose' && (
        <div className="editor-fill">
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', overflowX: 'auto' }}>
            <button className="btn sm ghost" onClick={applyFormat} disabled={!editorReady}>Format</button>
            <button className="btn sm ghost" onClick={applySchema} disabled={!editorReady}>Apply schema</button>
            <div style={{ flex: 1 }} />
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={copy} aria-label="Copy" disabled={!editorReady}>
              <IconCopy size={15} />
            </button>
          </div>

          {loadingFile ? (
            <div className="editor-loading">
              <Spinner size={22} />
              <span>Loading compose file…</span>
            </div>
          ) : loadError ? (
            <div className="card" style={{ borderColor: 'var(--red)', background: 'var(--red-soft)' }}>
              <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 600 }}>Could not load the stack file</div>
              <div className="mono" style={{ color: 'var(--red)', fontSize: 11.5, marginTop: 2 }}>{loadError}</div>
              <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => void loadFile()}>
                Retry
              </button>
            </div>
          ) : (
            <div className="editor-fill-inner">
              <CodeEditor
                ref={editorRef}
                value={compose}
                onChange={(v) => {
                  setCompose(v)
                  setComposeTouched(true)
                }}
                minHeight={160}
                grow
                placeholder={'services:\n  app:\n    image: nginx:alpine'}
                extraEnv={envRows.map((r) => r.key.trim()).filter(Boolean)}
              />
            </div>
          )}

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
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn sm ghost" onClick={() => (envRaw ? commitRawEnv() : setEnvRaw(true))}>
                  {envRaw ? 'Structured' : 'Raw .env'}
                </button>
                {!envRaw && <button className="btn sm ghost" onClick={() => addEnvRow()}><IconPlus size={14} /> Add</button>}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
              Used for {'${'}VAR{'}'} interpolation in the compose file.
            </div>

            {envRaw ? (
              <textarea id="env-raw" className="textarea mono" style={{ minHeight: 180, fontSize: 12 }} defaultValue={envRows.map((r) => `${r.key}=${r.value}`).join('\n')} spellCheck={false} placeholder="# Comments are ignored when switching back" />
            ) : (
              <div>
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
                      onFocus={() => setEnvFocus(i)}
                      placeholder="KEY"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                    <input className="input" style={{ flex: '1 1 60%' }} value={row.value} onChange={(e) => updateEnvRow(i, { value: e.target.value })} onFocus={() => setEnvFocus(null)} placeholder="value" autoCapitalize="none" autoCorrect="off" />
                    <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => removeEnvRow(i)} aria-label="Remove"><IconTrash size={15} /></button>
                  </div>
                ))}
                {envSuggestions.length > 0 && (
                  <div className="chip-row" style={{ marginTop: 4 }}>
                    {envSuggestions.map((k) => (
                      <button
                        key={k}
                        className="chip"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          if (envFocus !== null) updateEnvRow(envFocus, { key: k })
                          setEnvFocus(null)
                        }}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
            <IconArrowRight size={17} /> Add to compose
          </button>
          <div className="hint" style={{ marginTop: 6 }}>
            The converted service is appended to your compose file. Supports -p, -v, -e, --env-file, --restart, --network, --link, -m, --cpus, --entrypoint and more.
          </div>
        </div>
      )}

      {mode === 'env' ? (
        <button className="btn primary full" style={{ marginTop: 14 }} onClick={saveEnv}>
          <IconCheck size={17} /> Save environment
        </button>
      ) : (
        <button
          className="btn primary full"
          style={{ marginTop: 14 }}
          onClick={save}
          disabled={busy || loadingFile || !!loadError || !name.trim() || !compose.trim()}
        >
          {busy ? <Spinner size={17} /> : existing ? <IconCheck size={17} /> : <IconStack size={17} />}
          {busy ? (existing ? 'Updating…' : 'Deploying…') : existing ? 'Update' : 'Deploy stack'}
        </button>
      )}
    </div>
  )
}
