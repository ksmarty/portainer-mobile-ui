import { useState } from 'react'
import { useApp } from '../store'
import { IconBox } from '../components/Icons'
import { Spinner } from '../components/ui'
import { sanitizeName } from '../lib/utils'

export function CreateContainerScreen() {
  const doCreateContainer = useApp((s) => s.doCreateContainer)
  const images = useApp((s) => s.images)
  const back = useApp((s) => s.back)
  const [name, setName] = useState('')
  const [image, setImage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!name.trim() || !image.trim()) return
    setBusy(true)
    try {
      await doCreateContainer(sanitizeName(name), image.trim())
      back()
    } catch {
      /* handled by store */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="field" style={{ marginTop: 10 }}>
        <label>Container name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-container" autoFocus autoCapitalize="none" />
        <div className="hint">Lowercase letters, numbers, dashes and underscores.</div>
      </div>

      <div className="field">
        <label>Image</label>
        <input className="input mono" value={image} onChange={(e) => setImage(e.target.value)} placeholder="nginx:latest" autoCapitalize="none" autoCorrect="off" list="images" />
        <datalist id="images">
          {images.map((i) => (
            <option key={i.Id} value={i.RepoTags?.[0] || ''} />
          ))}
        </datalist>
      </div>

      <button className="btn primary full" onClick={submit} disabled={busy || !name.trim() || !image.trim()}>
        {busy ? <Spinner size={18} /> : <IconBox size={18} />}
        {busy ? 'Creating…' : 'Create container'}
      </button>
    </div>
  )
}
