export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function bytes(n: number, digits = 1): string {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : digits)} ${units[i]}`
}

export function timeAgo(unixSeconds: number): string {
  const s = Math.floor(Date.now() / 1000) - unixSeconds
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

export function shortId(id: string, len = 12): string {  const clean = id.replace(/^sha256:/, '')
  return clean.length > len ? clean.slice(0, len) + '…' : clean
}

// Splits an image reference into repo and tag for the /images/create API.
// Digest refs (repo@sha256:...) are returned whole with an empty tag.
export function parseImageRef(ref: string): { from: string; tag: string } {
  const r = ref.trim()
  if (!r) return { from: r, tag: 'latest' }
  if (r.includes('@')) return { from: r.toLowerCase(), tag: '' }
  const slash = r.lastIndexOf('/')
  const colon = r.lastIndexOf(':')
  if (colon > slash) return { from: r.slice(0, colon).toLowerCase(), tag: r.slice(colon + 1) }
  return { from: r.toLowerCase(), tag: 'latest' }
}

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function stateColor(state: string): string {
  switch (state) {
    case 'running':
      return 'var(--green)'
    case 'exited':
      return 'var(--red)'
    case 'paused':
      return 'var(--amber)'
    case 'created':
      return 'var(--blue)'
    case 'restarting':
      return 'var(--amber)'
    case 'dead':
      return 'var(--gray-500)'
    default:
      return 'var(--gray-500)'
  }
}

export function stateLabel(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1)
}

export function portLabel(ports: { PublicPort?: number; PrivatePort: number; IP?: string; Type: string }[]): string {
  if (!ports.length) return '—'
  const mapped = ports.filter((p) => p.PublicPort != null)
  if (!mapped.length) return `${ports[0].PrivatePort}/${ports[0].Type}`
  return mapped.map((p) => `${p.PublicPort}→${p.PrivatePort}/${p.Type}`).join(', ')
}

export function imageTag(image: string): string {
  if (image.includes('@')) return image.split('@')[1].slice(0, 18) + '…'
  const last = image.lastIndexOf(':')
  if (last === -1 || last < image.lastIndexOf('/')) return image + ':latest'
  return image
}

export function titleCase(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function endpointTypeName(type: number): string {
  const map: Record<number, string> = {
    1: 'Docker',
    2: 'Agent',
    3: 'Azure',
    4: 'Docker API',
    5: 'Edge Agent',
    6: 'Local',
    7: 'Edge Agent (async)',
  }
  return map[type] || 'Docker'
}

export function roleName(role: number): string {
  const map: Record<number, string> = { 1: 'Administrator', 2: 'Operator', 3: 'Standard User', 4: 'Help Desk' }
  return map[role] || 'Standard User'
}

export function registryTypeName(type: number): string {
  const map: Record<number, string> = { 1: 'Docker Hub', 2: 'Quay', 3: 'GitHub', 4: 'Custom', 5: 'ProGet', 6: 'Azure' }
  return map[type] || 'Custom'
}

export function shortName(name: string): string {
  return name.replace(/^\//, '')
}

export function sanitizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
