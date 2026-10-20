import type { CleanupJob } from './types'

// Image cleanup runs as a background job in the store so it survives closing
// the cleanup sheet and navigating around. To also survive a page reload —
// closing and reopening the site while a cleanup is in flight — the job is
// mirrored to localStorage on every progress tick and reconstructed on boot.
const KEY = 'imageCleanupJob'

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
  } catch {
    /* ignore */
  }
}
