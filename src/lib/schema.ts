import { create } from 'zustand'

export interface ComposeSchemaConfig {
  keyOrder: string[]
  requireContainerName: boolean
  colonEnvironment: boolean
}

export const DEFAULT_KEY_ORDER = [
  'image',
  'container_name',
  'environment',
  'restart',
  'ports',
  'expose',
  'volumes',
  'networks',
  'depends_on',
  'env_file',
  'labels',
  'command',
  'entrypoint',
  'working_dir',
  'user',
  'healthcheck',
  'cap_add',
  'cap_drop',
  'devices',
  'privileged',
  'read_only',
  'network_mode',
  'hostname',
  'domainname',
  'mem_limit',
  'cpus',
  'logging',
  'build',
  'pull_policy',
  'platform',
  'init',
  'stdin_open',
  'tty',
  'extra_hosts',
  'dns',
]

export const DEFAULT_SCHEMA: ComposeSchemaConfig = {
  keyOrder: [...DEFAULT_KEY_ORDER],
  requireContainerName: true,
  colonEnvironment: true,
}

const STORAGE_KEY = 'portainerComposeSchema'

function load(): ComposeSchemaConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ComposeSchemaConfig>
      const keyOrder =
        Array.isArray(parsed.keyOrder) && parsed.keyOrder.length
          ? parsed.keyOrder.filter((k) => typeof k === 'string' && k.trim())
          : [...DEFAULT_KEY_ORDER]
      return {
        keyOrder,
        requireContainerName: parsed.requireContainerName !== false,
        colonEnvironment: parsed.colonEnvironment !== false,
      }
    }
  } catch {
    /* fall through to defaults */
  }
  return { keyOrder: [...DEFAULT_KEY_ORDER], requireContainerName: true, colonEnvironment: true }
}

function save(cfg: ComposeSchemaConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    /* ignore quota errors */
  }
}

interface SchemaState extends ComposeSchemaConfig {
  setKeyOrder: (order: string[]) => void
  setRequireContainerName: (v: boolean) => void
  setColonEnvironment: (v: boolean) => void
  resetSchema: () => void
}

export const useSchema = create<SchemaState>((set, get) => {
  const initial = load()
  return {
    ...initial,
    setKeyOrder: (order) => {
      const clean = order.map((k) => k.trim()).filter(Boolean)
      set({ keyOrder: clean })
      save({ ...get(), keyOrder: clean })
    },
    setRequireContainerName: (v) => {
      set({ requireContainerName: v })
      save({ ...get(), requireContainerName: v })
    },
    setColonEnvironment: (v) => {
      set({ colonEnvironment: v })
      save({ ...get(), colonEnvironment: v })
    },
    resetSchema: () => {
      const d = { keyOrder: [...DEFAULT_KEY_ORDER], requireContainerName: true, colonEnvironment: true }
      set(d)
      save(d)
    },
  }
})

export function getSchemaConfig(): ComposeSchemaConfig {
  const s = useSchema.getState()
  return { keyOrder: [...s.keyOrder], requireContainerName: s.requireContainerName, colonEnvironment: s.colonEnvironment }
}
