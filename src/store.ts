import { create } from 'zustand'
import {
  apiLogin,
  clearConfig,
  clearCache,
  containerAction,
  createContainer,
  deployStack,
  getConfig,
  getContainers,
  getContainerLogs,
  getDashboard,
  getEndpoints,
  getImages,
  getNetworks,
  getRegistries,
  getSettings,
  getStacks,
  getStackFile,
  getTeams,
  getUsers,
  getVolumes,
  isDemo,
  pullImage,
  recreateContainer,
  removeContainer,
  removeImage,
  removeNetwork,
  removeStack,
  removeVolume,
  setConfig,
  setDemoMode,
  stackAction,
  testConnection,
} from './lib/api'
import { demoAddEndpoint, demoAddTeam, demoAddUser, demoRemoveTeam, demoRemoveUser } from './lib/demo'
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
} from './lib/types'
import { bytes, uid } from './lib/utils'

export interface Screen {
  name: string
  title: string
  props?: Record<string, any>
}

interface Toast {
  id: string
  message: string
  kind: 'success' | 'error' | 'info'
}

interface AppState {
  ready: boolean
  booting: boolean
  demo: boolean
  user: User | null
  activeEndpoint: number
  screen: Screen
  history: Screen[]
  sidebarOpen: boolean
  endpoints: Endpoint[]
  containers: Container[]
  images: Image[]
  volumes: Volume[]
  networks: Network[]
  stacks: Stack[]
  users: User[]
  teams: Team[]
  registries: Registry[]
  settings: Settings | null
  dashboard: DashboardStats | null
  loading: boolean
  error: string | null
  toasts: Toast[]
  logs: LogLine[]
  stats: Stats | null
  statsTimer: number | null

  boot: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  connect: (url: string, token: string, isJwt: boolean) => Promise<void>
  logout: () => void
  toggleDemo: () => void
  selectEndpoint: (id: number) => void
  navigate: (screen: Screen) => void
  back: () => void
  refresh: () => Promise<void>
  toast: (message: string, kind?: Toast['kind']) => void
  dismissToast: (id: string) => void

  doContainerAction: (id: string, action: string) => Promise<void>
  doRemoveContainer: (id: string) => Promise<void>
  doFetchNewImage: (id: string) => Promise<void>
  doCreateContainer: (name: string, image: string) => Promise<void>
  doPullImage: (image: string) => Promise<void>
  doRemoveImage: (id: string) => Promise<void>
  doPruneImages: () => Promise<void>
  doRemoveVolume: (name: string) => Promise<void>
  doRemoveNetwork: (id: string) => Promise<void>
  doDeployStack: (name: string, file: string, env?: { name: string; value: string }[]) => Promise<void>
  doUpdateStack: (id: number, file: string, env?: { name: string; value: string }[]) => Promise<void>
  doRemoveStack: (id: number) => Promise<void>
  doStackAction: (id: number, action: 'start' | 'stop') => Promise<void>
  loadLogs: (id: string, tail?: number) => Promise<void>
  startStats: (id: string) => void
  stopStats: () => void
  openStackFile: (id: number) => Promise<void>
  doAddEndpoint: (name: string, url: string) => Promise<void>
  doAddUser: (username: string, password: string, role: number) => Promise<void>
  doRemoveUser: (id: number) => Promise<void>
  doAddTeam: (name: string) => Promise<void>
  doRemoveTeam: (id: number) => Promise<void>
}

const HOME: Screen = { name: 'home', title: 'Dashboard' }

function endpointId(state: AppState): number {
  return state.activeEndpoint || state.endpoints[0]?.Id || 1
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  booting: false,
  demo: true,
  user: null,
  activeEndpoint: 0,
  screen: HOME,
  history: [],
  sidebarOpen: false,
  endpoints: [],
  containers: [],
  images: [],
  volumes: [],
  networks: [],
  stacks: [],
  users: [],
  teams: [],
  registries: [],
  settings: null,
  dashboard: null,
  loading: false,
  error: null,
  toasts: [],
  logs: [],
  stats: null,
  statsTimer: null,

  boot: async () => {
    if (get().booting || get().ready) return
    set({ booting: true, demo: isDemo() })
    try {
      if (isDemo()) {
        const [endpoints, stacks, users, teams, registries, settings, dashboard] = await Promise.all([
          getEndpoints(),
          getStacks(),
          getUsers(),
          getTeams(),
          getRegistries(),
          getSettings(),
          getDashboard(),
        ])
        const active = endpoints[0]?.Id || 1
        const [containers, images, volumes, networks] = await Promise.all([
          getContainers(active),
          getImages(active),
          getVolumes(active),
          getNetworks(active),
        ])
        set({
          demo: true,
          user: { Id: 1, Username: 'admin', Role: 1 },
          endpoints,
          stacks,
          users,
          teams,
          registries,
          settings,
          dashboard,
          activeEndpoint: active,
          containers,
          images,
          volumes,
          networks,
          ready: true,
          booting: false,
        })
      } else {
        const cfg = getConfig()
        if (cfg.url && cfg.token) {
          const endpoints = await getEndpoints()
          const active = endpoints[0]?.Id || 1
          const [containers, images, volumes, networks, stacks, settings, users, teams, registries, dashboard] =
            await Promise.all([
              getContainers(active),
              getImages(active),
              getVolumes(active),
              getNetworks(active),
              getStacks(),
              getSettings(),
              getUsers(),
              getTeams(),
              getRegistries(),
              getDashboard(),
            ])
          set({
            demo: false,
            user: { Id: 0, Username: 'connected', Role: 1 },
            endpoints,
            activeEndpoint: active,
            containers,
            images,
            volumes,
            networks,
            stacks,
            settings,
            users,
            teams,
            registries,
            dashboard,
            ready: true,
            booting: false,
          })
        } else {
          set({ demo: false, ready: true, booting: false })
        }
      }
    } catch (e) {
      // Never force demo mode back on: if a real connection fails, keep the
      // user's choice (demo off) and show the Connect screen instead.
      const demo = get().demo
      set({ demo, ready: true, booting: false })
      get().toast('Failed to load: ' + (e as Error).message, 'error')
    }
  },

  login: async (username, password) => {
    set({ loading: true, error: null })
    try {
      const res = await apiLogin(username, password)
      const cfg = getConfig()
      setConfig({ ...cfg, token: res.jwt, isJwt: true })
      set({ user: res.user, loading: false })
      await get().refresh()
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
      throw e
    }
  },

  connect: async (url, token, isJwt) => {
    set({ loading: true, error: null })
    setConfig({ url, token, isJwt })
    try {
      await testConnection()
      const endpoints = await getEndpoints()
      const active = endpoints[0]?.Id || 1
      const [containers, images, volumes, networks, stacks, settings, dashboard] = await Promise.all([
        getContainers(active),
        getImages(active),
        getVolumes(active),
        getNetworks(active),
        getStacks(),
        getSettings(),
        getDashboard(),
      ])
      set({
        demo: false,
        endpoints,
        activeEndpoint: active,
        containers,
        images,
        volumes,
        networks,
        stacks,
        settings,
        dashboard,
        loading: false,
        ready: true,
      })
      get().toast('Connected to Portainer', 'success')
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
      throw e
    }
  },

  logout: () => {
    clearConfig()
    clearCache()
    set({ ready: true, user: null, endpoints: [], containers: [], images: [], volumes: [], networks: [], stacks: [], screen: HOME, history: [] })
  },

  toggleDemo: () => {
    const next = !get().demo
    setDemoMode(next)
    if (next) {
      set({ ready: false, demo: true, screen: HOME, history: [] })
      get().boot()
    } else {
      // Leaving demo: disconnect immediately (keep saved config so the
      // Connect screen can prefill, but drop the live session).
      clearCache()
      set({
        demo: false,
        ready: true,
        user: null,
        activeEndpoint: 0,
        endpoints: [],
        containers: [],
        images: [],
        volumes: [],
        networks: [],
        stacks: [],
        users: [],
        teams: [],
        registries: [],
        settings: null,
        dashboard: null,
        screen: HOME,
        history: [],
      })
      get().toast('Demo mode off — connect to a Portainer instance', 'info')
    }
  },

  selectEndpoint: (id) => {
    if (id === get().activeEndpoint) return
    set({ activeEndpoint: id, loading: true, error: null })
    Promise.all([getContainers(id), getImages(id), getVolumes(id), getNetworks(id)])
      .then(([containers, images, volumes, networks]) => {
        set({ containers, images, volumes, networks, loading: false, screen: { name: 'containers', title: 'Containers' } })
      })
      .catch((e) => {
        set({ loading: false, error: (e as Error).message })
        get().toast('Could not switch endpoint: ' + (e as Error).message, 'error')
      })
  },

  navigate: (screen) => {
    set((s) => ({ screen, history: [...s.history.slice(-24), s.screen], sidebarOpen: false }))
    window.scrollTo(0, 0)
  },

  back: () => {
    set((s) => {
      const history = [...s.history]
      const prev = history.pop() || HOME
      return { screen: prev, history }
    })
    window.scrollTo(0, 0)
  },

  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const id = endpointId(get())
      const [endpoints, containers, images, volumes, networks, stacks, settings, dashboard] = await Promise.all([
        getEndpoints(),
        getContainers(id),
        getImages(id),
        getVolumes(id),
        getNetworks(id),
        getStacks(),
        getSettings(),
        getDashboard(),
      ])
      set({ endpoints, containers, images, volumes, networks, stacks, settings, dashboard, loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
      get().toast('Refresh failed: ' + (e as Error).message, 'error')
    }
  },

  toast: (message, kind = 'info') => {
    const id = uid('toast')
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
    setTimeout(() => get().dismissToast(id), 3200)
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  doContainerAction: async (id, action) => {
    const ep = endpointId(get())
    try {
      await containerAction(ep, id, action)
      get().toast(`Container ${action}`, 'success')
      await get().refresh()
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  doRemoveContainer: async (id) => {
    const ep = endpointId(get())
    try {
      await removeContainer(ep, id, true)
      get().toast('Container removed', 'success')
      get().back()
      await get().refresh()
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  doFetchNewImage: async (id) => {
    const ep = endpointId(get())
    const c = get().containers.find((x) => x.Id === id)
    const name = (c?.Names?.[0] || 'container').replace(/^\//, '')
    try {
      await recreateContainer(ep, id, name)
      get().toast('Image fetched — container recreated', 'success')
      get().back()
      await get().refresh()
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  doCreateContainer: async (name, image) => {
    const ep = endpointId(get())
    try {
      await createContainer(ep, { Name: name, Image: image })
      get().toast('Container created', 'success')
      await get().refresh()
    } catch (e) {
      get().toast((e as Error).message, 'error')
      throw e
    }
  },

  doPullImage: async (image) => {
    const ep = endpointId(get())
    try {
      await pullImage(ep, image)
      get().toast('Image pulled', 'success')
      await get().refresh()
    } catch (e) {
      get().toast((e as Error).message, 'error')
      throw e
    }
  },

  doRemoveImage: async (id) => {
    const ep = endpointId(get())
    try {
      await removeImage(ep, id, true)
      get().toast('Image removed', 'success')
      await get().refresh()
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  doPruneImages: async () => {
    const ep = endpointId(get())
    try {
      const { pruneImages } = await import('./lib/api')
      const res = await pruneImages(ep)
      if (res.deleted === 0) {
        get().toast('Nothing to clean up', 'info')
      } else {
        get().toast(`Freed ${bytes(res.reclaimed)} (${res.deleted} image${res.deleted === 1 ? '' : 's'})`, 'success')
      }
      await get().refresh()
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  doRemoveVolume: async (name) => {
    const ep = endpointId(get())
    try {
      await removeVolume(ep, name)
      get().toast('Volume removed', 'success')
      await get().refresh()
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  doRemoveNetwork: async (id) => {
    const ep = endpointId(get())
    try {
      await removeNetwork(ep, id)
      get().toast('Network removed', 'success')
      await get().refresh()
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  doDeployStack: async (name, file, env = []) => {
    try {
      await deployStack(name, file, env)
      get().toast('Stack deployed', 'success')
      await get().refresh()
    } catch (e) {
      get().toast((e as Error).message, 'error')
      throw e
    }
  },

  doUpdateStack: async (id, file, env = []) => {
    try {
      const { updateStack } = await import('./lib/api')
      await updateStack(id, file, env)
      get().toast('Stack updated', 'success')
      await get().refresh()
    } catch (e) {
      get().toast((e as Error).message, 'error')
      throw e
    }
  },

  doRemoveStack: async (id) => {
    try {
      await removeStack(id)
      get().toast('Stack removed', 'success')
      await get().refresh()
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  doStackAction: async (id, action) => {
    try {
      await stackAction(id, action)
      get().toast(`Stack ${action === 'start' ? 'started' : 'stopped'}`, 'success')
      await get().refresh()
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  loadLogs: async (id, tail = 120) => {
    const ep = endpointId(get())
    set({ logs: [] })
    try {
      const logs = await getContainerLogs(ep, id, tail)
      set({ logs })
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  startStats: (id) => {
    const ep = endpointId(get())
    const { statsTimer } = get()
    if (statsTimer) window.clearInterval(statsTimer)
    const tick = async () => {
      try {
        const { getContainerStats } = await import('./lib/api')
        const stats = await getContainerStats(ep, id)
        set({ stats })
      } catch {
        /* ignore */
      }
    }
    tick()
    const timer = window.setInterval(tick, 2500)
    set({ statsTimer: timer })
  },

  stopStats: () => {
    const t = get().statsTimer
    if (t) window.clearInterval(t)
    set({ statsTimer: null, stats: null })
  },

  openStackFile: async (id) => {
    try {
      const file = await getStackFile(id)
      get().navigate({ name: 'stack-file', title: 'Stack file', props: { id, file } })
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  doAddEndpoint: async (name, url) => {
    if (get().demo) {
      demoAddEndpoint(name, url)
      await get().refresh()
      get().toast('Endpoint added', 'success')
      return
    }
    const { createEndpoint } = await import('./lib/api')
    try {
      await createEndpoint(name, url)
      await get().refresh()
      get().toast('Endpoint added', 'success')
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  doAddUser: async (username, password, role) => {
    if (get().demo) {
      demoAddUser(username, role)
      get().toast('User created', 'success')
      return
    }
    const { createUser } = await import('./lib/api')
    try {
      await createUser(username, password, role)
      await get().refresh()
      get().toast('User created', 'success')
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  doRemoveUser: async (id) => {
    if (get().demo) {
      demoRemoveUser(id)
      await get().refresh()
      get().toast('User removed', 'success')
      return
    }
    const { removeUser } = await import('./lib/api')
    try {
      await removeUser(id)
      await get().refresh()
      get().toast('User removed', 'success')
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  doAddTeam: async (name) => {
    if (get().demo) {
      demoAddTeam(name)
      get().toast('Team created', 'success')
      return
    }
    const { createTeam } = await import('./lib/api')
    try {
      await createTeam(name)
      await get().refresh()
      get().toast('Team created', 'success')
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },

  doRemoveTeam: async (id) => {
    if (get().demo) {
      demoRemoveTeam(id)
      get().toast('Team removed', 'success')
      return
    }
    const { removeTeam } = await import('./lib/api')
    try {
      await removeTeam(id)
      await get().refresh()
      get().toast('Team removed', 'success')
    } catch (e) {
      get().toast((e as Error).message, 'error')
    }
  },
}))

export function isAdmin(state: AppState): boolean {
  return state.demo || (state.user?.Role ?? 1) === 1
}
