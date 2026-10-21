import type { CleanupJob } from './types'

// Image cleanup runs as a background job in the store so it survives closing
// the cleanup sheet and navigating around. To also survive a page reload —
// closing and reopening the site while a cleanup is in flight — the job is
// mirrored to localStorage on every progress tick and reconstructed on boot.
const KEY = 'imageCleanupJob'
const LOCK = 'imageCleanupOwner'

// Identifies this tab so a reloaded/other tab can tell whether the job's owner
// is still alive. A browser cannot run the loop for a tab that is gone, so the
// heartbeat is what decides takeover.
const TAB = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

// A heartbeat older than this counts as abandoned. Two image deletions can
// easily take longer than a second, so the window is generous.
const STALE_MS = 12000

export function loadCleanupJob(): CleanupJob | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const job = JSON.parse(raw) as CleanupJob
    // A job persisted as "running" whose process is gone (the page reloaded)
    // is still resumable — the remaining list is what matters.
    if (job && Array.isArray(job.remaining) && typeof job.endpointId === 'number') return job
    return null
  } catch {
    return null
  }
}

export function saveCleanupJob(job: CleanupJob): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(job))
  } catch {
    /* quota / private mode — progress still works for this session */
  }
}

export function clearCleanupJob(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(LOCK)
  } catch {
    /* ignore */
  }
}

function readLock(): { owner: string; at: number } | null {
  try {
    const raw = localStorage.getItem(LOCK)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { owner?: string; at?: number }
    if (!parsed?.owner || typeof parsed.at !== 'number') return null
    return { owner: parsed.owner, at: parsed.at }
  } catch {
    return null
  }
}

/**
 * Claim the cleanup for this tab. Returns false when another live tab is
 * already working through the same job, which stops two tabs from deleting (and
 * reporting) the same images twice.
 *
 * The check is a heartbeat rather than a hard lock: a tab that was closed or
 * killed mid-run stops beating, and after STALE_MS the next tab simply takes
 * over — which is exactly the "close the site and reopen it" case.
 */
export function claimCleanup(): boolean {
  const lock = readLock()
  if (lock && lock.owner !== TAB && Date.now() - lock.at < STALE_MS) return false
  beatCleanup()
  return true
}

/** Refresh the heartbeat and, with a job, the progress mirror. */
export function beatCleanup(job?: CleanupJob): void {
  try {
    if (job) localStorage.setItem(KEY, JSON.stringify(job))
    localStorage.setItem(LOCK, JSON.stringify({ owner: TAB, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

/** Give up ownership (job finished or errored out). */
export function releaseCleanup(job?: CleanupJob): void {
  try {
    if (job) localStorage.setItem(KEY, JSON.stringify(job))
    const lock = readLock()
    if (!lock || lock.owner === TAB) localStorage.removeItem(LOCK)
  } catch {
    /* ignore */
  }
}

/**
 * Another tab's in-flight job, mirrored to storage. Used to show live progress
 * in a tab that is only watching, so opening the site while a cleanup runs
 * elsewhere still displays real numbers.
 */
export function readCleanupJob(): CleanupJob | null {
  return loadCleanupJob()
}
