import { useState } from 'react'
import { useApp } from '../store'
import { useSchema } from '../lib/schema'
import { SectionTitle } from '../components/ui'

export function SchemaSettingsScreen() {
  const keyOrder = useSchema((s) => s.keyOrder)
  const requireContainerName = useSchema((s) => s.requireContainerName)
  const colonEnvironment = useSchema((s) => s.colonEnvironment)
  const setKeyOrder = useSchema((s) => s.setKeyOrder)
  const setRequireContainerName = useSchema((s) => s.setRequireContainerName)
  const setColonEnvironment = useSchema((s) => s.setColonEnvironment)
  const resetSchema = useSchema((s) => s.resetSchema)
  const toast = useApp((s) => s.toast)

  const [draft, setDraft] = useState(keyOrder.join('\n'))
  const dirty = draft !== keyOrder.join('\n')

  const applyOrder = () => {
    const order = draft.split('\n')
    setKeyOrder(order)
    setDraft(order.map((k) => k.trim()).filter(Boolean).join('\n'))
    toast('Key order saved', 'success')
  }

  return (
    <div className="page">
      <div className="card" style={{ marginTop: 8 }}>
        <div className="switch-row">
          <div className="grow">
            <div className="t">Require container_name</div>
            <div className="d">Add container_name to every service if missing</div>
          </div>
          <button className={`switch ${requireContainerName ? 'on' : ''}`} onClick={() => setRequireContainerName(!requireContainerName)} />
        </div>
        <div className="switch-row">
          <div className="grow">
            <div className="t">Environment colon notation</div>
            <div className="d">Convert env lists to KEY: value maps</div>
          </div>
          <button className={`switch ${colonEnvironment ? 'on' : ''}`} onClick={() => setColonEnvironment(!colonEnvironment)} />
        </div>
      </div>

      <SectionTitle>Service key order</SectionTitle>
      <div className="card">
        <textarea
          className="textarea"
          style={{ minHeight: 170, fontSize: 11.5 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          placeholder={'image\ncontainer_name\nenvironment\nrestart'}
        />
        <div className="hint" style={{ marginTop: 6 }}>
          One key per line, in the order you want them written. Anything not listed keeps its original position.
        </div>
      </div>

      <div className="btn-row">
        <button className="btn ghost" onClick={() => { resetSchema(); setDraft(useSchema.getState().keyOrder.join('\n')) }}>
          Reset defaults
        </button>
        <button className="btn primary" onClick={applyOrder} disabled={!dirty}>
          Apply order
        </button>
      </div>

      <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
        These rules are used by the <b>Apply schema</b> action in the stack editor to normalize compose files.
      </div>
    </div>
  )
}
