import {
  demoContainerAction,
  demoCreateContainer,
  demoDashboard,
  demoDanglingImages,
  demoDeployStack,
  demoGet,
  demoGetImageInfo,
  demoGetNetworkInfo,
  demoPullImage,
  demoRecreateContainer,
  demoRemoveContainer,
  demoRemoveImage,
  demoRemoveNetwork,
  demoRemoveStack,
  demoRemoveVolume,
  demoState,
  demoStats,
  demoLogs,
} from './demo'
import type {
  Container,
  DashboardStats,
  Endpoint,
  Image,
  ImageInfo,
  LogLine,
  Network,
  NetworkDetail,
  Registry,
  Settings,
  Stack,
  Stats,
  Team,
  User,
  Volume,
} from './types'
import { jsonClone } from './utils'

export interface ConnectionConfig {
  url: string
  token: string
  isJwt: boolean
}

interface CacheEntry<T> {
  data: T
  at: number
  ttl: number
}

const CACHE_TTL = 3000
let cache = new Map<string, CacheEntry<any>>()

function cacheKey(path: string, params?: Record<string, unknown>): string {
  return path + (params ? '?' + JSON.stringify(params) : '')
}

function getCache<T>(key: string): T | null {
  const e = cache.get(key)
  if (e && Date.now() - e.at < e.ttl) return e.data as T
  cache.delete(key)
  return null
}

function setCache<T>(key: string, data: T, ttl = CACHE_TTL): T {
  cache.set(key, { data, at: Date.now(), ttl })
  return data
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

export function getConfig(): ConnectionConfig {
  return {
    url: localStorage.getItem('portainerUrl') || '',
    token: localStorage.getItem('portainerToken') || '',
    isJwt: localStorage.getItem('portainerIsJwt') === '1',
  }
}

export function setConfig(cfg: ConnectionConfig) {
  localStorage.setItem('portainerUrl', cfg.url)
  localStorage.setItem('portainerToken', cfg.token)
  localStorage.setItem('portainerIsJwt', cfg.isJwt ? '1' : '0')
  clearCache()
}

export function clearConfig() {
  localStorage.removeItem('portainerUrl')
  localStorage.removeItem('portainerToken')
  localStorage.removeItem('portainerIsJwt')
  clearCache()
}

export function clearCache() {
  cache = new Map()
}

export function isDemo(): boolean {
  return localStorage.getItem('demoMode') !== '0'
}

export function setDemoMode(on: boolean) {
  localStorage.setItem('demoMode', on ? '1' : '0')
  clearCache()
}

function demoDelay<T>(value: T, ms = 140): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(jsonClone(value) as T), ms))
}

// Portainer's REST API lives under /api. Accept a host with or without the
// prefix and always normalize to include it (e.g. https://portainer.example.com
// -> https://portainer.example.com/api).
function apiBase(url: string): string {
  const u = url.replace(/\/+$/, '')
  return /\/api$/i.test(u) ? u : `${u}/api`
}

// Shared request plumbing: resolves the base URL, attaches auth headers and
// normalizes network/HTTP errors. Returns the raw Response so streamed
// endpoints (image pulls, builds) can read the body themselves.
async function portainerRequest(path: string, options: RequestInit = {}, params?: Record<string, unknown>): Promise<Response> {
  const cfg = getConfig()
  if (!cfg.url) throw new ApiError('No Portainer URL configured. Add a connection in Settings.', 0)
  const base = apiBase(cfg.url)
  const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  // Only claim JSON when there's actually a body. POSTs like image pulls send
  // no body, and some middlewares reject an empty body with a JSON
  // content-type.
  if (options.body) headers['Content-Type'] = 'application/json'
  if (cfg.isJwt) {
    headers.Authorization = `Bearer ${cfg.token}`
  } else {
    headers['X-API-Key'] = cfg.token
  }
  let res: Response
  try {
    res = await fetch(base + path + qs, {
      ...options,
      headers,
      // Never let a single request hang the UI forever (e.g. an unreachable
      // endpoint during dashboard aggregation).
      signal: options.signal ?? AbortSignal.timeout(30000),
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError(`Timed out contacting ${cfg.url}.`, 0)
    }
    throw new ApiError(
      `Cannot reach ${cfg.url}. Check the URL and your network. If this app is hosted on a different origin, Portainer must allow CORS — or run it behind the container's /api proxy (PORTAINER_URL).`,
      0,
    )
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 401 || res.status === 403) {
      throw new ApiError(`Authentication failed (${res.status}) — check your API key or JWT.`, res.status)
    }
    let msg = text
    if (text) {
      try {
        const parsed = JSON.parse(text)
        if (parsed.message) msg = parsed.message
        else if (parsed.details) msg = parsed.details
        else if (parsed.err) msg = parsed.err
      } catch {}
    }
    throw new ApiError(msg || `Request failed (${res.status})`, res.status)
  }
  return res
}

async function portainerFetch<T>(path: string, options: RequestInit = {}, params?: Record<string, unknown>): Promise<T> {
  const res = await portainerRequest(path, options, params)
  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const text = await res.text()
    if (!text.trim()) return undefined as T
    try {
      return JSON.parse(text) as T
    } catch {
      // Docker endpoints (e.g. /images/create, /build) stream NDJSON chunks
      // ({"status":"..."}\r\n{"status":"..."}). If JSON.parse fails on the
      // full concatenated stream, return undefined for void/streamed callers
      // instead of throwing a SyntaxError DOMException.
      return undefined as T
    }
  }
  return (await res.text()) as unknown as T
}

function dockerPath(endpointId: number, path: string): string {
  return `/endpoints/${endpointId}/docker${path}`
}

/* ------------------------------ endpoints -------------------------------- */

export function getEndpoints(): Promise<Endpoint[]> {
  if (isDemo()) return demoDelay(demoGet<Endpoint[]>('endpoints'))
  return portainerFetch<Endpoint[]>('/endpoints', undefined, { limit: 100, start: 0 })
}

/* ------------------------------ dashboard -------------------------------- */

export function getDashboard(): Promise<DashboardStats> {
  if (isDemo()) return demoDelay(demoDashboard(), 300)
  return (async () => {
    const eps = await getEndpoints()
    const total: DashboardStats = {
      endpoints: eps.length,
      stacks: 0,
      containersRunning: 0,
      containersStopped: 0,
      images: 0,
      volumes: 0,
      networks: 0,
      cpu: 0,
      memory: 0,
      memoryUsed: 0,
      memoryTotal: 0,
    }
    const stacksP = getStacks()
    for (const ep of eps.filter((e) => e.Status === 1)) {
      try {
        const [containers, images, volumes, networks, info] = await Promise.all([
          getContainers(ep.Id, true),
          getImages(ep.Id),
          getVolumes(ep.Id),
          getNetworks(ep.Id),
          // System totals: CPU count and total memory for this endpoint host
          portainerFetch<{ NCPU?: number; MemTotal?: number }>(dockerPath(ep.Id, '/info')),
        ])
        total.containersRunning += containers.filter((c) => c.State === 'running').length
        total.containersStopped += containers.filter((c) => c.State !== 'running').length
        total.images += images.length
        total.volumes += volumes.length
        total.networks += networks.length
        total.memoryTotal += info.MemTotal || 0
        // Live CPU + memory usage. One-shot stats report precpu_stats equal to
        // cpu_stats (delta 0), so sample twice ~1.5s apart and diff them.
        const running = containers.filter((c) => c.State === 'running')
        if (running.length > 0) {
          const ids = running.map((c) => c.Id)
          const a = await sampleContainerUsage(ep.Id, ids)
          await new Promise((r) => setTimeout(r, 1500))
          const b = await sampleContainerUsage(ep.Id, ids)
          for (let k = 0; k < b.length; k++) {
            const dTotal = b[k].total - a[k].total
            const dSys = b[k].sys - a[k].sys
            if (dSys > 0 && dTotal >= 0) total.cpu += (dTotal / dSys) * b[k].cpus * 100
            total.memoryUsed += b[k].mem
          }
        }
      } catch {
        // skip unreachable endpoint
      }
    }
    total.stacks = (await stacksP).length
    total.cpu = Math.min(100, Math.round(total.cpu))
    total.memory =
      total.memoryTotal > 0 ? Math.min(100, Math.round((total.memoryUsed / total.memoryTotal) * 100)) : 0
    return total
  })()
}

async function sampleContainerUsage(
  endpointId: number,
  ids: string[],
): Promise<{ total: number; sys: number; cpus: number; mem: number }[]> {
  return Promise.all(
    ids.map((id) =>
      portainerFetch<any>(dockerPath(endpointId, `/containers/${id}/stats`), {}, { stream: 0, 'one-shot': 1 }).then(
        (raw) => ({
          total: raw.cpu_stats?.cpu_usage?.total_usage ?? 0,
          sys: raw.cpu_stats?.system_cpu_usage ?? 0,
          cpus: raw.cpu_stats?.online_cpus || 1,
          mem: raw.memory_stats?.usage ?? 0,
        }),
      ),
    ),
  )
}

/* ------------------------------ containers -------------------------------- */

// Docker's container payloads nest the fields the UI needs under
// NetworkSettings / HostConfig. Flatten them once here so screens can read
// `Networks`, `IPs`, `NetworkMode` and `RestartPolicy` directly.
function normalizeContainer(raw: any): Container {
  const nets: Record<string, any> = raw?.NetworkSettings?.Networks || {}
  const netNames = Object.keys(nets)
  const host = raw?.HostConfig || {}
  return {
    ...raw,
    Networks: raw?.Networks ?? netNames,
    IPs: raw?.IPs ?? netNames.map((n) => nets[n]?.IPAddress).filter(Boolean),
    NetworkMode: raw?.NetworkMode ?? host?.NetworkMode,
    RestartPolicy: raw?.RestartPolicy ?? host?.RestartPolicy?.Name,
  }
}

export function getContainers(endpointId: number, all = true): Promise<Container[]> {
  if (isDemo()) return demoDelay(demoGet<Container[]>('containers'))
  const key = cacheKey(dockerPath(endpointId, '/containers/json'), { all })
  const cached = getCache<Container[]>(key)
  if (cached) return Promise.resolve(cached)
  return portainerFetch<any[]>(dockerPath(endpointId, '/containers/json'), undefined, { all, size: 0 }).then((d) =>
    setCache(
      key,
      d.map(normalizeContainer),
    ),
  )
}

export function containerAction(endpointId: number, id: string, action: string): Promise<void> {
  if (isDemo()) {
    demoContainerAction(id, action)
    return demoDelay(undefined)
  }
  return portainerFetch<void>(dockerPath(endpointId, `/containers/${id}/${action}`), { method: 'POST' })
}

export function removeContainer(endpointId: number, id: string, force = false): Promise<void> {
  if (isDemo()) {
    demoRemoveContainer(id)
    return demoDelay(undefined)
  }
  return portainerFetch<void>(dockerPath(endpointId, `/containers/${id}`), { method: 'DELETE' }, { force, v: 1 })
}

export function createContainer(endpointId: number, name: string, image: string): Promise<{ Id: string }> {
  if (isDemo()) {
    demoCreateContainer(name, image)
    return demoDelay({ Id: 'demo-' + Date.now() })
  }
  // Docker reads the container name from the `?name=` query, NOT the body.
  return portainerFetch<{ Id: string }>(
    dockerPath(endpointId, '/containers/create'),
    { method: 'POST', body: JSON.stringify({ Image: image }) },
    { name },
  )
}

// Shape of `GET /containers/{id}/json` (only the parts recreate needs).
interface ContainerInspect {
  Id: string
  Name?: string
  Config?: Record<string, any>
  HostConfig?: Record<string, any>
  NetworkingConfig?: { EndpointsConfig?: Record<string, any> }
  State?: { Running?: boolean }
}

export function inspectContainer(endpointId: number, id: string): Promise<ContainerInspect> {
  return portainerFetch<ContainerInspect>(dockerPath(endpointId, `/containers/${id}/json`))
}

/**
 * Rebuild a container in place so it runs `image`, keeping its configuration
 * (env, ports, mounts, networks, restart policy, labels). Docker has no atomic
 * recreate, so this is the same dance Portainer does: stop it, rename it out
 * of the way, create a replacement from the inspected config with the new
 * image, start that, then remove the old one.
 *
 * If anything fails after the rename we put the original container back
 * (rename + restart), so an interrupted update can't leave the user with a
 * renamed, stopped container and no replacement.
 */
export async function recreateContainer(endpointId: number, id: string, image: string): Promise<void> {
  if (isDemo()) {
    demoRecreateContainer(id, image)
    return demoDelay(undefined, 500)
  }
  const inspect = await inspectContainer(endpointId, id)
  const name = (inspect.Name || '').replace(/^\//, '') || inspect.Id.slice(0, 12)
  const backup = `${name}-old-${Date.now().toString(36)}`
  const wasRunning = !!inspect.State?.Running

  // Rebuild the create body from the inspect output. Config/HostConfig are
  // accepted by /containers/create almost verbatim (that is what makes the
  // recreate faithful); only the new image is swapped in.
  const body: Record<string, any> = {
    ...(inspect.Config || {}),
    Image: image,
    HostConfig: inspect.HostConfig || {},
  }
  delete body.ImageID
  delete body.Created
  delete body.State
  delete body.Config
  const networking = inspect.NetworkingConfig ? jsonClone(inspect.NetworkingConfig) : undefined
  if (networking?.EndpointsConfig) {
    for (const epConf of Object.values<any>(networking.EndpointsConfig)) {
      // The old container still exists and holds any static IP, so Docker
      // would reject the create with "address already in use". Leave the
      // interface without an address and let Docker assign one.
      if (epConf?.IPAMConfig) delete epConf.IPAMConfig.IPv4Address
    }
    body.NetworkingConfig = networking
  }

  let renamed = false
  let createdId = ''
  try {
    if (wasRunning) {
      // 304 (already stopped) is a normal answer here, not an error.
      await portainerFetch<void>(dockerPath(endpointId, `/containers/${id}/stop`), { method: 'POST' }, { t: 10 }).catch(() => {})
    }
    await portainerFetch<void>(dockerPath(endpointId, `/containers/${id}/rename`), { method: 'POST' }, { name: backup })
    renamed = true
    const created = await portainerFetch<{ Id: string }>(
      dockerPath(endpointId, '/containers/create'),
      { method: 'POST', body: JSON.stringify(body) },
      { name },
    )
    createdId = created?.Id || ''
    await portainerFetch<void>(dockerPath(endpointId, `/containers/${createdId}/start`), { method: 'POST' })
    // v=0: keep anonymous volumes — an update must not look like a reset.
    await portainerFetch<void>(dockerPath(endpointId, `/containers/${id}`), { method: 'DELETE' }, { force: 1, v: 0 })
  } catch (e) {
    if (createdId) {
      await portainerFetch<void>(dockerPath(endpointId, `/containers/${createdId}`), { method: 'DELETE' }, { force: 1, v: 0 }).catch(() => {})
    }
    if (renamed) {
      await portainerFetch<void>(dockerPath(endpointId, `/containers/${id}/rename`), { method: 'POST' }, { name }).catch(() => {})
      if (wasRunning) {
        await portainerFetch<void>(dockerPath(endpointId, `/containers/${id}/start`), { method: 'POST' }).catch(() => {})
      }
    }
    throw e
  }
}

export function getContainerLogs(endpointId: number, id: string, tail = 100): Promise<LogLine[]> {
  if (isDemo()) return demoDelay(demoLogs(id, tail))
  return (async () => {
    const raw = await portainerFetchBinary(dockerPath(endpointId, `/containers/${id}/logs`), {
      stdout: 1,
      stderr: 1,
      timestamps: 1,
      tail,
    })
    return parseDockerLogs(raw)
  })()
}

async function portainerFetchBinary(path: string, params?: Record<string, unknown>): Promise<Uint8Array> {
  const cfg = getConfig()
  if (!cfg.url) throw new ApiError('No Portainer URL configured. Add a connection in Settings.', 0)
  const base = apiBase(cfg.url)
  const qs = params
    ? '?' +
      new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
    : ''
  const headers: Record<string, string> = {}
  if (cfg.token) headers[cfg.isJwt ? 'Authorization' : 'X-API-Key'] = cfg.token
  const res = await fetch(base + path + qs, { headers, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status)
  return new Uint8Array(await res.arrayBuffer())
}

export function parseDockerLogs(raw: Uint8Array): LogLine[] {
  // Docker multiplexed stream: 8-byte header per frame (byte 0 = stream type,
  // bytes 4-7 = big-endian payload length). Parse on bytes — decoding the
  // response as text first corrupts both the headers and multi-byte log
  // content.
  const lines: LogLine[] = []
  let i = 0
  while (i + 8 <= raw.length) {
    const stream = raw[i]
    const size = ((raw[i + 4] << 24) | (raw[i + 5] << 16) | (raw[i + 6] << 8) | raw[i + 7]) >>> 0
    i += 8
    if (i + size > raw.length) break
    let text = new TextDecoder().decode(raw.subarray(i, i + size)).replace(/\n$/, '')
    const ts = text.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s?([\s\S]*)$/)
    if (ts) text = ts[2]
    lines.push({
      id: `log-${lines.length}-${Math.random()}`,
      text,
      stream: stream === 2 ? 'stderr' : stream === 1 ? 'stdout' : 'system',
    })
    i += size
  }
  return lines
}

export function getContainerStats(endpointId: number, id: string): Promise<Stats> {
  if (isDemo()) return demoDelay(demoStats(), 250)
  return (async () => {
    const path = dockerPath(endpointId, `/containers/${id}/stats`)
    const sample = () => portainerFetch<any>(path, {}, { stream: 0, 'one-shot': 1 })
    // A single one-shot sample reports precpu_stats equal to cpu_stats (delta 0),
    // so take two readings ~1.2s apart and diff them — same approach as
    // getDashboard(), which would otherwise show a flat 0% CPU here.
    const first = await sample()
    await new Promise((r) => setTimeout(r, 1200))
    const raw = await sample()
    const cpuDelta = (raw.cpu_stats?.cpu_usage?.total_usage ?? 0) - (first.cpu_stats?.cpu_usage?.total_usage ?? 0)
    const sysDelta = (raw.cpu_stats?.system_cpu_usage ?? 0) - (first.cpu_stats?.system_cpu_usage ?? 0)
    const cpus = raw.cpu_stats?.online_cpus || first.cpu_stats?.online_cpus || 1
    const cpuPercent = sysDelta > 0 && cpuDelta >= 0 ? (cpuDelta / sysDelta) * cpus * 100 : 0
    // Docker counts page cache in `usage`; subtract it like `docker stats` does.
    const memUsage = Math.max(0, (raw.memory_stats?.usage ?? 0) - (raw.memory_stats?.stats?.cache ?? 0))
    const memLimit = raw.memory_stats?.limit ?? 0
    const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0
    const nets: Record<string, any> = raw.networks || {}
    const netRx = Object.values(nets).reduce((s, n) => s + (n?.rx_bytes ?? 0), 0)
    const netTx = Object.values(nets).reduce((s, n) => s + (n?.tx_bytes ?? 0), 0)
    return {
      cpuPercent,
      memPercent,
      memUsage,
      memLimit,
      netRx,
      netTx,
      blockRead: raw.blkio_stats?.io_service_bytes_recursive?.find((b: any) => b.op === 'Read')?.value ?? 0,
      blockWrite: raw.blkio_stats?.io_service_bytes_recursive?.find((b: any) => b.op === 'Write')?.value ?? 0,
      pids: raw.pids_stats?.current ?? 0,
    }
  })()
}

/* -------------------------------- images --------------------------------- */

export function getImages(endpointId: number): Promise<Image[]> {
  if (isDemo()) return demoDelay(demoGet<Image[]>('images'))
  const key = cacheKey(dockerPath(endpointId, '/images/json'))
  const cached = getCache<Image[]>(key)
  if (cached) return Promise.resolve(cached)
  return portainerFetch<Image[]>(dockerPath(endpointId, '/images/json')).then((d) => setCache(key, d, 5000))
}

export function getDanglingImages(endpointId: number): Promise<Image[]> {
  if (isDemo()) return demoDelay(demoDanglingImages())
  return portainerFetch<Image[]>(dockerPath(endpointId, '/images/json'), undefined, {
    all: 1,
    filters: JSON.stringify({ dangling: ['true'] }),
  })
}

export function removeImage(endpointId: number, id: string, force = false): Promise<void> {
  if (isDemo()) {
    demoRemoveImage(id)
    return demoDelay(undefined)
  }
  return portainerFetch<void>(dockerPath(endpointId, `/images/${id}`), { method: 'DELETE' }, { force, noprune: 0 })
}

export interface PullResult {
  /** Image reference that was pulled. */
  image: string
  /** Docker reported the tag already pointed at the newest image. */
  upToDate: boolean
  /** Terminal "Status:" progress line from Docker, when present. */
  status: string
  /** Content digest Docker reported, when present. */
  digest?: string
}

// Docker streams newline-delimited JSON progress events for a pull. Mine the
// stream for the terminal status so callers can tell the user whether anything
// actually changed and which version came down.
function parsePullResult(image: string, text: string): PullResult {
  const errMatch = text.match(/"error"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  if (errMatch) {
    let msg = errMatch[1]
    try {
      msg = JSON.parse('"' + errMatch[1] + '"')
    } catch {}
    throw new ApiError(msg, 0)
  }
  const statuses: string[] = []
  const re = /"status"\s*:\s*"((?:[^"\\]|\\.)*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    let s = m[1]
    try {
      s = JSON.parse('"' + m[1] + '"')
    } catch {}
    statuses.push(s)
  }
  const finalStatus =
    [...statuses].reverse().find((s) => s.startsWith('Status:')) || statuses[statuses.length - 1] || ''
  const digest = text.match(/sha256:[0-9a-f]{12,}/i)?.[0]
  return {
    image,
    upToDate: /image is up to date/i.test(text),
    status: finalStatus,
    digest,
  }
}

export async function pullImage(endpointId: number, image: string): Promise<PullResult> {
  const ref = image.trim()
  if (isDemo()) {
    demoPullImage(ref)
    await demoDelay(undefined, 700)
    return {
      image: ref,
      upToDate: false,
      status: `Status: Downloaded newer image for ${ref}`,
      digest: 'sha256:000000000000',
    }
  }
  // Match Portainer's own frontend exactly: POST /images/create with the full
  // image reference in fromImage and NO separate tag param — some Portainer
  // versions reject the tag param combination.
  // Large image pulls can take longer than the default 30s timeout, so give it 5 minutes.
  const res = await portainerRequest(
    '/endpoints/' + endpointId + '/docker/images/create',
    { method: 'POST', signal: AbortSignal.timeout(300000) },
    { fromImage: ref },
  )
  const text = await res.text().catch(() => '')
  return parsePullResult(ref, text)
}

// Detailed metadata for one network (docker inspect).
export function getNetworkInfo(endpointId: number, id: string): Promise<NetworkDetail> {
  if (isDemo()) return demoDelay(demoGetNetworkInfo(id), 220)
  return portainerFetch<any>(dockerPath(endpointId, `/networks/${id}`)).then((raw) => ({
    Id: raw.Id || '',
    Name: raw.Name || '',
    Driver: raw.Driver || '',
    Scope: raw.Scope || '',
    Internal: !!raw.Internal,
    Attachable: !!raw.Attachable,
    EnableIPv6: !!raw.EnableIPv6,
    IPAM: {
      Driver: raw.IPAM?.Driver,
      Config: (raw.IPAM?.Config || []).map((c: any) => ({
        Subnet: c.Subnet,
        Gateway: c.Gateway,
        IPRange: c.IPRange,
      })),
    },
    Options: raw.Options || {},
    Labels: raw.Labels || {},
    Created: raw.Created ? Date.parse(raw.Created) || 0 : 0,
    Containers: Object.values(raw.Containers || {}).map((c: any) => ({
      Id: c.EndpointID || c.Name || '',
      Name: c.Name || '',
      IPv4: c.IPv4Address || '',
    })),
  }))
}

// Detailed metadata for one image (docker inspect).
export function getImageInfo(endpointId: number, imageId: string): Promise<ImageInfo> {
  if (isDemo()) return demoDelay(demoGetImageInfo(imageId), 250)
  return portainerFetch<any>(dockerPath(endpointId, `/images/${imageId}/json`)).then((raw) => ({
    Id: raw.Id || '',
    RepoTags: raw.RepoTags || [],
    RepoDigests: raw.RepoDigests || [],
    Created: raw.Created ? new Date(raw.Created).getTime() : 0,
    Size: raw.Size || 0,
    Architecture: raw.Architecture,
    Os: raw.Os,
    DockerVersion: raw.DockerVersion,
    Author: raw.Author,
    Labels: raw.Config?.Labels,
    Env: raw.Config?.Env,
    ExposedPorts: raw.Config?.ExposedPorts ? Object.keys(raw.Config.ExposedPorts) : [],
  }))
}

/* -------------------------------- volumes -------------------------------- */

export function getVolumes(endpointId: number): Promise<Volume[]> {
  if (isDemo()) return demoDelay(demoGet<Volume[]>('volumes'))
  const key = cacheKey(dockerPath(endpointId, '/volumes'))
  const cached = getCache<Volume[]>(key)
  if (cached) return Promise.resolve(cached)
  return portainerFetch<any>(dockerPath(endpointId, '/volumes')).then((d) => {
    const raw: any[] = Array.isArray(d?.Volumes) ? d.Volumes : Array.isArray(d) ? d : []
    const list: Volume[] = raw.map((v: any) => ({
      Name: v.Name,
      Driver: v.Driver,
      Mountpoint: v.Mountpoint,
      CreatedAt: v.CreatedAt,
      Labels: v.Labels,
      Size: v.UsageData?.Size ?? 0,
      RefCount: v.UsageData?.RefCount ?? 0,
    }))
    return setCache(key, list, 5000)
  })
}

export function removeVolume(endpointId: number, name: string): Promise<void> {
  if (isDemo()) {
    demoRemoveVolume(name)
    return demoDelay(undefined)
  }
  return portainerFetch<void>(dockerPath(endpointId, `/volumes/${name}`), { method: 'DELETE' })
}

/* -------------------------------- networks -------------------------------- */

export function getNetworks(endpointId: number): Promise<Network[]> {
  if (isDemo()) return demoDelay(demoGet<Network[]>('networks'))
  const key = cacheKey(dockerPath(endpointId, '/networks'))
  const cached = getCache<Network[]>(key)
  if (cached) return Promise.resolve(cached)
  // `docker network ls` doesn't include container memberships, so count
  // connections from each container's NetworkSettings instead.
  return (async () => {
    const [nets, containers] = await Promise.all([
      portainerFetch<any[]>(dockerPath(endpointId, '/networks')),
      portainerFetch<any[]>(dockerPath(endpointId, '/containers/json'), undefined, { all: 1, size: 0 }),
    ])
    const enriched: Network[] = nets.map((n) => {
      const members: Network['Containers'] = []
      for (const c of containers) {
        const entry = c.NetworkSettings?.Networks?.[n.Name]
        if (entry) {
          members.push({
            Id: c.Id,
            Name: (c.Names?.[0] || '').replace(/^\//, ''),
            IPv4: entry.IPAddress || '',
          })
        }
      }
      return {
        Id: n.Id,
        Name: n.Name,
        Driver: n.Driver || '',
        Scope: n.Scope || '',
        Internal: !!n.Internal,
        Attachable: !!n.Attachable,
        Created: typeof n.Created === 'string' ? Date.parse(n.Created) || 0 : n.Created || 0,
        Containers: members,
      }
    })
    setCache(key, enriched, 5000)
    return enriched
  })()
}

export function removeNetwork(endpointId: number, id: string): Promise<void> {
  if (isDemo()) {
    demoRemoveNetwork(id)
    return demoDelay(undefined)
  }
  return portainerFetch<void>(dockerPath(endpointId, `/networks/${id}`), { method: 'DELETE' })
}

/* -------------------------------- stacks --------------------------------- */

export function getStacks(): Promise<Stack[]> {
  if (isDemo()) return demoDelay(demoGet<Stack[]>('stacks'))
  return portainerFetch<Stack[]>('/stacks')
}

export function getStackFile(id: number): Promise<string> {
  if (isDemo()) {
    const s = demoGet<Stack[]>('stacks').find((x) => x.Id === id)
    return demoDelay(s?.File || 'version: "3"\nservices: {}')
  }
  return portainerFetch<{ StackFileContent?: string }>(`/stacks/${id}/file`).then(
    (d) => d.StackFileContent || '',
  )
}

export function deployStack(endpointId: number, name: string, file: string, env: { name: string; value: string }[] = []): Promise<void> {
  if (isDemo()) {
    demoDeployStack(name, file, env)
    return demoDelay(undefined, 500)
  }
  return portainerFetch<void>(`/stacks?method=string&type=2&endpointId=${endpointId}`, {
    method: 'POST',
    body: JSON.stringify({ name, stackFileContent: file, env }),
  })
}

export function updateStack(id: number, endpointId: number, file: string, env: { name: string; value: string }[] = []): Promise<void> {
  if (isDemo()) {
    const s = demoState.stacks.find((x) => x.Id === id)
    if (s) {
      s.File = file
      s.Env = env
      s.CreationDate = Math.floor(Date.now() / 1000)
    }
    return demoDelay(undefined, 400)
  }
  return portainerFetch<void>(`/stacks/${id}?endpointId=${endpointId}`, {
    method: 'PUT',
    body: JSON.stringify({ stackFileContent: file, env }),
  })
}

export function removeStack(id: number, endpointId?: number): Promise<void> {
  if (isDemo()) {
    demoRemoveStack(id)
    return demoDelay(undefined)
  }
  const qs = endpointId != null ? `?endpointId=${endpointId}` : ''
  return portainerFetch<void>(`/stacks/${id}${qs}`, { method: 'DELETE' })
}

export function stackAction(id: number, action: 'start' | 'stop', endpointId?: number): Promise<void> {
  if (isDemo()) return demoDelay(undefined)
  const qs = endpointId != null ? `?endpointId=${endpointId}` : ''
  return portainerFetch<void>(`/stacks/${id}/${action}${qs}`, { method: 'POST' })
}

/* ------------------------------- settings --------------------------------- */

export function getSettings(): Promise<Settings> {
  if (isDemo()) return demoDelay(demoGet<Settings>('settings'))
  return portainerFetch<Settings>('/settings')
}

/* -------------------------------- users ----------------------------------- */

export function getUsers(): Promise<User[]> {
  if (isDemo()) return demoDelay(demoGet<User[]>('users'))
  return portainerFetch<User[]>('/users')
}

export function createUser(username: string, password: string, role: number): Promise<void> {
  if (isDemo()) return demoDelay(undefined)
  return portainerFetch<void>('/users', { method: 'POST', body: JSON.stringify({ username, password, role }) })
}

export function removeUser(id: number): Promise<void> {
  if (isDemo()) return demoDelay(undefined)
  return portainerFetch<void>(`/users/${id}`, { method: 'DELETE' })
}

/* -------------------------------- teams ----------------------------------- */

export function getTeams(): Promise<Team[]> {
  if (isDemo()) return demoDelay(demoGet<Team[]>('teams'))
  return portainerFetch<Team[]>('/teams')
}

export function createTeam(name: string): Promise<void> {
  if (isDemo()) return demoDelay(undefined)
  return portainerFetch<void>('/teams', { method: 'POST', body: JSON.stringify({ name }) })
}

export function removeTeam(id: number): Promise<void> {
  if (isDemo()) return demoDelay(undefined)
  return portainerFetch<void>(`/teams/${id}`, { method: 'DELETE' })
}

/* ------------------------------- registries -------------------------------- */

export function getRegistries(): Promise<Registry[]> {
  if (isDemo()) return demoDelay(demoGet<Registry[]>('registries'))
  return portainerFetch<Registry[]>('/registries')
}

/* -------------------------------- generic --------------------------------- */

export function createEndpoint(name: string, url: string): Promise<{ Id: number }> {
  return portainerFetch<{ Id: number }>('/endpoints', {
    method: 'POST',
    body: JSON.stringify({ Name: name, URL: url, EndpointCreationType: 4 }),
  })
}

export function getVersion(): Promise<{ ServerVersion: string }> {
  if (isDemo()) return demoDelay({ ServerVersion: '2.21.5' })
  return portainerFetch<{ ServerVersion: string }>('/system/version')
}

export function testConnection(): Promise<void> {
  return getVersion().then(() => undefined)
}
