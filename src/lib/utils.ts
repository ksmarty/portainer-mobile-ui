import type { DiskGroup, HostMount } from './types'

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export function jsonClone<T>(value: T): T {
  // Note: JSON.stringify(undefined) is undefined, which JSON.parse rejects —
  // don't blow up the timer/action that cloned a void result.
  if (value === undefined) return value
  return JSON.parse(JSON.stringify(value))
}

// Copy plain text verbatim. Prefer the async Clipboard API, but fall back to a
// hidden textarea + execCommand for iOS/insecure contexts where it's missing —
// and never transform the text (no URL-encoding).
export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      /* fall through to the legacy path */
    }
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '-9999px'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  ta.setSelectionRange(0, text.length)
  try {
    if (!document.execCommand('copy')) throw new Error('Copy failed')
  } finally {
    document.body.removeChild(ta)
  }
}

export function bytes(n: number, digits = 1): string {
  // Guard the non-finite / negative inputs that used to leak through as
  // "NaN undefined": Math.log of a negative number is NaN, so the unit index
  // went NaN and the template printed both halves as garbage.
  if (typeof n !== 'number' || !isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : digits)} ${units[i]}`
}

/**
 * Group host mounts by the physical disk behind them.
 *
 * One drive usually appears several times in `df` — the root overlay, an LVM
 * volume, `/boot/efi`, a bind mount. Grouping is what turns "usage" into one
 * number per disk instead of counting the same 494 GB four times.
 *
 * Mounts within a group overlap (the overlay lies *on* the LVM volume), so
 * totals are NOT summed — that would report 200% of a drive mounted twice.
 * The group takes its numbers from its primary mount: the largest real
 * filesystem on the disk, preferring `/`.
 *
 * Mounts with no block device (overlay, tmpfs, shm) can't be attributed to
 * hardware by name. Inside a container the root filesystem is exactly that: an
 * overlay whose numbers are the host disk's. Such a mount is folded into the
 * physical group reporting the same capacity and usage, which is what puts a
 * container's `/` on the drive that actually backs it. Anything left over (a
 * real tmpfs) stays its own group keyed by its filesystem name.
 */
export function groupByDisk(mounts: HostMount[]): DiskGroup[] {
  const groups = new Map<string, HostMount[]>()
  for (const m of mounts) {
    // Key by the reported disk; fall back to the filesystem so two unrelated
    // tmpfs mounts don't merge into one bucket.
    const key = m.disk || `fs:${m.filesystem || m.mountpoint}`
    const list = groups.get(key)
    if (list) list.push(m)
    else groups.set(key, [m])
  }

  // Fold device-less mounts into the physical disk that reports identical
  // figures — a container's overlay root is its host disk seen without a
  // /dev name. Capacity and usage must both match exactly, which two unrelated
  // filesystems effectively never do.
  const physical = [...groups.entries()].filter(([, list]) => list.some((m) => !!m.disk))
  for (const [key, list] of [...groups.entries()]) {
    if (key.startsWith('fs:') === false) continue
    const pseudoMounts = list.filter((m) => !m.disk)
    if (!pseudoMounts.length) continue
    const match = physical.find(([, plist]) => {
      const p = plist.find((m) => !!m.disk)
      if (!p) return false
      return pseudoMounts.some(
        (m) => m.totalBytes > 0 && m.totalBytes === p.totalBytes && m.usedBytes === p.usedBytes,
      )
    })
    if (!match) continue
    // Move only the mounts that actually matched; leave the rest in place.
    const matched = pseudoMounts.filter((m) => {
      const p = match[1].find((x) => !!x.disk)!
      return m.totalBytes > 0 && m.totalBytes === p.totalBytes && m.usedBytes === p.usedBytes
    })
    if (!matched.length) continue
    match[1].push(...matched)
    const rest = list.filter((m) => !matched.includes(m))
    if (rest.length) groups.set(key, rest)
    else groups.delete(key)
  }

  const primary = (list: HostMount[]): HostMount =>
    // `/` first (it is "the" filesystem of a disk), then the largest.
    list.find((m) => m.mountpoint === '/') ?? [...list].sort((a, b) => b.totalBytes - a.totalBytes)[0]

  const out: DiskGroup[] = []
  for (const [key, list] of groups) {
    const p = primary(list)
    out.push({
      id: key.startsWith('fs:') ? key.slice(3) : key,
      mounts: [...list].sort((a, b) =>
        a.mountpoint === '/' ? -1 : b.mountpoint === '/' ? 1 : a.mountpoint.localeCompare(b.mountpoint),
      ),
      totalBytes: p.totalBytes,
      usedBytes: p.usedBytes,
      availBytes: p.availBytes,
      usedPercent: Math.max(0, Math.min(100, p.usedPercent)),
    })
  }

  // Physical disks first (largest first), then pseudo filesystems.
  return out.sort((a, b) => {
    const real = (g: DiskGroup) => (g.mounts.some((m) => !!m.disk) ? 0 : 1)
    if (real(a) !== real(b)) return real(a) - real(b)
    if (b.totalBytes !== a.totalBytes) return b.totalBytes - a.totalBytes
    return a.id.localeCompare(b.id)
  })
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

export function shortId(id: string, len = 12): string {
  const clean = id.replace(/^sha256:/, '')
  return clean.length > len ? clean.slice(0, len) + '…' : clean
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

export function sanitizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
