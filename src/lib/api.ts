import {
  demoContainerAction,
  demoCreateContainer,
  demoDashboard,
  demoDanglingImages,
  demoDeployStack,
  demoGet,
  demoPruneImages,
  demoState,
  demoLogs,
  demoPullImage,
  demoRemoveContainer,
  demoRemoveImage,
  demoRemoveNetwork,
  demoRemoveStack,
  demoRemoveVolume,
  demoStats,
} from './demo'
import type {
  Container,
  DashboardStats,
  Endpoint,
  Image,
  LogLine,
  Network,
  Registry,
  Settings,
  Stack,
  Stats,
  Team,
  User,
  Volume,
} from './types'
import { jsonClone } from './utils'

export interface AuthResponse {
  jwt: string
  user: User
}

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

async function portainerFetch<T>(path: string, options: RequestInit = {}, params?: Record<string, unknown>): Promise<T> {
  const cfg = getConfig()
  if (!cfg.url) throw new ApiError('No Portainer URL configured. Add a connection in Settings.', 0)
  const base = cfg.url.replace(/\/+$/, '')
  const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (cfg.isJwt) {
    headers.Authorization = `Bearer ${cfg.token}`
  } else {
    headers['X-API-Key'] = cfg.token
  }
  let res: Response
  try {
    res = await fetch(base + path + qs, { ...options, headers })
  } catch (e) {
    throw new ApiError(`Cannot reach Portainer at ${cfg.url}. Check the URL and your network.`, 0)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(text || `Request failed (${res.status})`, res.status)
  }
  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return (await res.json()) as T
  return (await res.text()) as unknown as T
}

function dockerPath(endpointId: number, path: string): string {
  return `/endpoints/${endpointId}/docker${path}`
}

/* ------------------------------- auth ----------------------------------- */

export async function apiLogin(username: string, password: string): Promise<AuthResponse> {
  const cfg = getConfig()
  const res = await fetch(cfg.url.replace(/\/+$/, '') + '/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new ApiError('Invalid credentials', res.status)
  const data = await res.json()
  const user = await portainerFetch<User>('/users/' + data.Id)
  return { jwt: data.jwt, user }
}

/* ------------------------------ endpoints -------------------------------- */

export function getEndpoints(): Promise<Endpoint[]> {
  if (isDemo()) return demoDelay(demoGet<Endpoint[]>('endpoints'))
  return portainerFetch<Endpoint[]>('/endpoints', undefined, { limit: 100, start: 0 })
}

export async function getEndpoint(id: number): Promise<Endpoint> {
  if (isDemo()) return demoDelay(demoGet<Endpoint[]>('endpoints').find((e) => e.Id === id)!)
  const key = cacheKey(`/endpoints/${id}/docker/info`)
  const cached = getCache<Endpoint>(key)
  if (cached) return cached
  const ep = await portainerFetch<Endpoint>('/endpoints/' + id)
  return setCache(key, ep, 10000)
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
    for (const ep of eps.filter((e) => e.Status === 1)) {
      try {
        const [containers, images, volumes, networks] = await Promise.all([
          getContainers(ep.Id, true),
          getImages(ep.Id),
          getVolumes(ep.Id),
          getNetworks(ep.Id),
        ])
        total.containersRunning += containers.filter((c) => c.State === 'running').length
        total.containersStopped += containers.filter((c) => c.State !== 'running').length
        total.images += images.length
        total.volumes += volumes.length
        total.networks += networks.length
        total.stacks += 0
      } catch {
        // skip unreachable endpoint
      }
    }
    return total
  })()
}

/* ------------------------------ containers -------------------------------- */

export function getContainers(endpointId: number, all = true): Promise<Container[]> {
  if (isDemo()) return demoDelay(demoGet<Container[]>('containers'))
  const key = cacheKey(dockerPath(endpointId, '/containers/json'), { all })
  const cached = getCache<Container[]>(key)
  if (cached) return Promise.resolve(cached)
  return portainerFetch<Container[]>(dockerPath(endpointId, '/containers/json'), undefined, { all, size: 0 }).then((d) =>
    setCache(key, d),
  )
}

export function getContainer(endpointId: number, id: string): Promise<Container> {
  if (isDemo()) return demoDelay(demoGet<Container[]>('containers').find((c) => c.Id === id)!)
  const key = cacheKey(dockerPath(endpointId, `/containers/${id}/json`))
  const cached = getCache<Container>(key)
  if (cached) return Promise.resolve(cached)
  return portainerFetch<Container>(dockerPath(endpointId, `/containers/${id}/json`)).then((d) => setCache(key, d, 8000))
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

export function createContainer(endpointId: number, body: any): Promise<{ Id: string }> {
  if (isDemo()) {
    demoCreateContainer(body.Name || body.Image, body.Image)
    return demoDelay({ Id: 'demo-' + Date.now() })
  }
  return portainerFetch<{ Id: string }>(dockerPath(endpointId, '/containers/create'), { method: 'POST', body: JSON.stringify(body) })
}

export function getContainerLogs(endpointId: number, id: string, tail = 100): Promise<LogLine[]> {
  if (isDemo()) return demoDelay(demoLogs(id, tail))
  return (async () => {
    const raw = await portainerFetch<string>(
      dockerPath(endpointId, `/containers/${id}/logs`),
      {},
      { stdout: 1, stderr: 1, timestamps: 1, tail },
    )
    return parseDockerLogs(raw)
  })()
}

export function parseDockerLogs(raw: string): LogLine[] {
  // Docker multiplexed stream: 8-byte header per frame
  const lines: LogLine[] = []
  let i = 0
  const buf = new Uint8Array(raw.length)
  for (let j = 0; j < raw.length; j++) buf[j] = raw.charCodeAt(j)
  while (i + 8 <= buf.length) {
    const stream = buf[i]
    const size = (buf[i + 4] << 24) | (buf[i + 5] << 16) | (buf[i + 6] << 8) | buf[i + 7]
    i += 8
    if (i + size > buf.length) break
    let text = new TextDecoder().decode(buf.slice(i, i + size)).replace(/\n$/, '')
    const ts = text.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s?(.*)$/)
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
    const raw = await portainerFetch<any>(dockerPath(endpointId, `/containers/${id}/stats`), {}, { stream: 0, 'one-shot': 1 })
    const cpuDelta = raw.cpu_stats.cpu_usage.total_usage - raw.precpu_stats.cpu_usage.total_usage
    const sysDelta = raw.cpu_stats.system_cpu_usage - raw.precpu_stats.system_cpu_usage
    const cpus = raw.cpu_stats.online_cpus || 1
    const cpuPercent = sysDelta > 0 ? (cpuDelta / sysDelta) * cpus * 100 : 0
    const memUsage = raw.memory_stats.usage ?? 0
    const memLimit = raw.memory_stats.limit ?? 0
    const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0
    return {
      cpuPercent,
      memPercent,
      memUsage,
      memLimit,
      netRx: raw.networks?.eth0?.rx_bytes ?? 0,
      netTx: raw.networks?.eth0?.tx_bytes ?? 0,
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

export function removeImage(endpointId: number, id: string, force = false): Promise<void> {
  if (isDemo()) {
    demoRemoveImage(id)
    return demoDelay(undefined)
  }
  return portainerFetch<void>(dockerPath(endpointId, `/images/${id}`), { method: 'DELETE' }, { force, noprune: 0 })
}

export function pullImage(endpointId: number, fromImage: string, tag = 'latest'): Promise<void> {
  if (isDemo()) {
    demoPullImage(tag === 'latest' ? fromImage : `${fromImage}:${tag}`)
    return demoDelay(undefined, 700)
  }
  return portainerFetch<void>('/endpoints/' + endpointId + '/docker/images/create', { method: 'POST' }, { fromImage, tag })
}

/* -------------------------------- volumes -------------------------------- */

export function getVolumes(endpointId: number): Promise<Volume[]> {
  if (isDemo()) return demoDelay(demoGet<Volume[]>('volumes'))
  const key = cacheKey(dockerPath(endpointId, '/volumes'))
  const cached = getCache<Volume[]>(key)
  if (cached) return Promise.resolve(cached)
  return portainerFetch<any>(dockerPath(endpointId, '/volumes')).then((d) => {
    const list: Volume[] = (d.Volumes || d || []).map((v: any) => ({
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
  return portainerFetch<Network[]>(dockerPath(endpointId, '/networks')).then((d) => setCache(key, d, 5000))
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
  return portainerFetch<string>(`/stacks/${id}/file`)
}

export function deployStack(name: string, file: string, env: { name: string; value: string }[] = []): Promise<void> {
  if (isDemo()) {
    demoDeployStack(name, file, env)
    return demoDelay(undefined, 500)
  }
  return portainerFetch<void>('/stacks?method=string&type=2&endpointId=1', {
    method: 'POST',
    body: JSON.stringify({ name, stackFileContent: file, env }),
  })
}

export function updateStack(id: number, file: string, env: { name: string; value: string }[] = []): Promise<void> {
  if (isDemo()) {
    const s = demoState.stacks.find((x) => x.Id === id)
    if (s) {
      s.File = file
      s.Env = env
      s.CreationDate = Math.floor(Date.now() / 1000)
    }
    return demoDelay(undefined, 400)
  }
  return portainerFetch<void>(`/stacks/${id}?endpointId=1`, {
    method: 'PUT',
    body: JSON.stringify({ stackFileContent: file, env }),
  })
}

export function removeStack(id: number): Promise<void> {
  if (isDemo()) {
    demoRemoveStack(id)
    return demoDelay(undefined)
  }
  return portainerFetch<void>(`/stacks/${id}`, { method: 'DELETE' })
}

export function stackAction(id: number, action: 'start' | 'stop'): Promise<void> {
  if (isDemo()) return demoDelay(undefined)
  return portainerFetch<void>(`/stacks/${id}/${action}`, { method: 'POST' })
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
