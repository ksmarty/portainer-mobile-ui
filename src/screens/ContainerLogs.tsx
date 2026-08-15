import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { IconCopy, IconDownload, IconPlay, IconRefresh, IconTerminal } from '../components/Icons'
import { Empty, Spinner } from '../components/ui'

export function ContainerLogsScreen({ id }: { id: string }) {
  const logs = useApp((s) => s.logs)
  const loadLogs = useApp((s) => s.loadLogs)
  const toast = useApp((s) => s.toast)
  const [following, setFollowing] = useState(true)
  const [tail, setTail] = useState(150)
  const endRef = useRef<HTMLDivElement>(null)
  const loading = logs.length === 0

  useEffect(() => {
    void loadLogs(id, tail)
  }, [id, tail, loadLogs])

  useEffect(() => {
    if (following && endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [logs, following])

  const copy = async () => {
    const text = logs.map((l) => l.text).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast('Logs copied', 'success')
    } catch {
      toast('Copy failed', 'error')
    }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 8, margin: '14px 0 12px', alignItems: 'center' }}>
        <button className={`btn sm ${following ? 'primary' : 'ghost'}`} onClick={() => setFollowing(!following)}>
          <IconPlay size={14} /> {following ? 'Following' : 'Paused'}
        </button>
        <button className="btn sm ghost" onClick={() => void loadLogs(id, tail)}>
          <IconRefresh size={14} /> Reload
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn sm ghost" onClick={copy}>
          <IconCopy size={14} /> Copy
        </button>
      </div>

      <div
        className="code-block"
        style={{ maxHeight: '62vh', overflowY: 'auto', fontSize: 12, lineHeight: 1.55 }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
            <Spinner />
          </div>
        ) : (
          logs.map((l) => (
            <div key={l.id} style={{ color: l.stream === 'stderr' ? 'var(--red)' : 'var(--text)', whiteSpace: 'pre-wrap' }}>
              {l.text}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {!loading && !logs.length && <Empty icon={<IconTerminal size={36} />} title="No logs yet" />}
    </div>
  )
}
