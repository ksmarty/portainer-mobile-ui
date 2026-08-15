import { parse } from 'yaml'

export interface Suggestion {
  label: string
  insert: string
  hint?: string
}

export interface SuggestionResult {
  items: Suggestion[]
  replaceFrom: number
  filterText: string
}

const TOP_LEVEL_KEYS: Suggestion[] = [
  { label: 'services:', insert: 'services:', hint: 'top level' },
  { label: 'version:', insert: 'version: "3.8"', hint: 'top level' },
  { label: 'networks:', insert: 'networks:', hint: 'top level' },
  { label: 'volumes:', insert: 'volumes:', hint: 'top level' },
  { label: 'secrets:', insert: 'secrets:', hint: 'top level' },
  { label: 'configs:', insert: 'configs:', hint: 'top level' },
  { label: 'name:', insert: 'name:', hint: 'top level' },
  { label: 'include:', insert: 'include:', hint: 'top level' },
]

const SERVICE_KEYS: Suggestion[] = [
  { label: 'image', insert: 'image: ', hint: 'string' },
  { label: 'container_name', insert: 'container_name: ', hint: 'string' },
  { label: 'environment', insert: 'environment:', hint: 'map' },
  { label: 'restart', insert: 'restart: unless-stopped', hint: 'no | always | on-failure | unless-stopped' },
  { label: 'ports', insert: 'ports:', hint: 'list' },
  { label: 'expose', insert: 'expose:', hint: 'list' },
  { label: 'volumes', insert: 'volumes:', hint: 'list' },
  { label: 'networks', insert: 'networks:', hint: 'list | map' },
  { label: 'depends_on', insert: 'depends_on:', hint: 'list' },
  { label: 'env_file', insert: 'env_file:', hint: 'list' },
  { label: 'labels', insert: 'labels:', hint: 'map | list' },
  { label: 'command', insert: 'command: ', hint: 'string | list' },
  { label: 'entrypoint', insert: 'entrypoint: ', hint: 'string | list' },
  { label: 'working_dir', insert: 'working_dir: /app', hint: 'string' },
  { label: 'user', insert: 'user: ', hint: 'string' },
  { label: 'hostname', insert: 'hostname: ', hint: 'string' },
  { label: 'network_mode', insert: 'network_mode: bridge', hint: 'bridge | host | none' },
  { label: 'healthcheck', insert: 'healthcheck:', hint: 'map' },
  { label: 'build', insert: 'build:', hint: 'map' },
  { label: 'cap_add', insert: 'cap_add:', hint: 'list' },
  { label: 'cap_drop', insert: 'cap_drop:', hint: 'list' },
  { label: 'devices', insert: 'devices:', hint: 'list' },
  { label: 'privileged', insert: 'privileged: true', hint: 'bool' },
  { label: 'read_only', insert: 'read_only: true', hint: 'bool' },
  { label: 'init', insert: 'init: true', hint: 'bool' },
  { label: 'tty', insert: 'tty: true', hint: 'bool' },
  { label: 'stdin_open', insert: 'stdin_open: true', hint: 'bool' },
  { label: 'mem_limit', insert: 'mem_limit: ', hint: 'bytes' },
  { label: 'cpus', insert: 'cpus: 1.0', hint: 'number' },
  { label: 'extra_hosts', insert: 'extra_hosts:', hint: 'list' },
  { label: 'dns', insert: 'dns:', hint: 'list' },
  { label: 'logging', insert: 'logging:', hint: 'map' },
  { label: 'deploy', insert: 'deploy:', hint: 'map (swarm)' },
  { label: 'platform', insert: 'platform: linux/amd64', hint: 'string' },
  { label: 'pull_policy', insert: 'pull_policy: always', hint: 'always | missing | never' },
]

const COMMON_SERVICE_NAMES = ['web', 'api', 'app', 'db', 'database', 'cache', 'redis', 'postgres', 'mysql', 'mongo', 'nginx', 'worker', 'cron', 'frontend', 'backend', 'proxy', 'mail']

export const ENV_VAR_NAMES = [
  'DOMAIN', 'TZ', 'NODE_ENV', 'PORT', 'DATABASE_URL', 'API_URL', 'LOG_LEVEL',
  'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'POSTGRES_HOST', 'POSTGRES_PORT',
  'MYSQL_ROOT_PASSWORD', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD',
  'REDIS_PASSWORD', 'REDIS_HOST', 'REDIS_PORT', 'MONGO_INITDB_ROOT_USERNAME',
  'MONGO_INITDB_ROOT_PASSWORD', 'MONGO_INITDB_DATABASE', 'NGINX_HOST', 'NGINX_PORT',
  'VIRTUAL_HOST', 'LETSENCRYPT_HOST', 'LETSENCRYPT_EMAIL', 'SMTP_HOST', 'SMTP_PORT',
  'SECRET_KEY', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'APP_ENV', 'APP_DEBUG', 'APP_URL',
  'JWT_SECRET', 'OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET', 'GRAFANA_ADMIN_USER',
  'GRAFANA_ADMIN_PASSWORD', 'GF_SECURITY_ADMIN_USER', 'GF_SECURITY_ADMIN_PASSWORD',
]

const ENV_VARS: Suggestion[] = ENV_VAR_NAMES.map((k) => ({ label: k, insert: `${k}: `, hint: 'env' }))

function envItems(extraEnv: string[], mode: 'map' | 'interp'): Suggestion[] {
  const names = [...new Set([...extraEnv.filter(Boolean), ...ENV_VAR_NAMES])]
  return names.map((n) =>
    mode === 'map'
      ? { label: n, insert: `${n}: `, hint: 'env' }
      : { label: n, insert: '${' + n + '}', hint: 'interp' },
  )
}

const HEALTHCHECK_KEYS: Suggestion[] = [
  { label: 'test', insert: 'test: ["CMD", "curl", "-f", "http://localhost"]', hint: 'list' },
  { label: 'interval', insert: 'interval: 30s', hint: 'duration' },
  { label: 'timeout', insert: 'timeout: 10s', hint: 'duration' },
  { label: 'retries', insert: 'retries: 3', hint: 'number' },
  { label: 'start_period', insert: 'start_period: 5s', hint: 'duration' },
]

const LOGGING_KEYS: Suggestion[] = [
  { label: 'driver', insert: 'driver: json-file', hint: 'json-file | syslog | journald | gelf | fluentd | awslogs | splunk' },
  { label: 'options', insert: 'options:', hint: 'map' },
]

const BUILD_KEYS: Suggestion[] = [
  { label: 'context', insert: 'context: .', hint: 'string' },
  { label: 'dockerfile', insert: 'dockerfile: Dockerfile', hint: 'string' },
  { label: 'target', insert: 'target: ', hint: 'string' },
  { label: 'args', insert: 'args:', hint: 'map' },
  { label: 'cache_from', insert: 'cache_from:', hint: 'list' },
  { label: 'network', insert: 'network: ', hint: 'string' },
  { label: 'pull', insert: 'pull: true', hint: 'bool' },
]

const DEPLOY_KEYS: Suggestion[] = [
  { label: 'replicas', insert: 'replicas: 1', hint: 'number' },
  { label: 'mode', insert: 'mode: replicated', hint: 'replicated | global' },
  { label: 'resources', insert: 'resources:', hint: 'map' },
  { label: 'restart_policy', insert: 'restart_policy:', hint: 'map' },
  { label: 'update_config', insert: 'update_config:', hint: 'map' },
  { label: 'placement', insert: 'placement:', hint: 'map' },
  { label: 'labels', insert: 'labels:', hint: 'map' },
]

const NETWORK_SUBKEYS: Suggestion[] = [
  { label: 'driver', insert: 'driver: bridge', hint: 'bridge | overlay | host | macvlan' },
  { label: 'driver_opts', insert: 'driver_opts:', hint: 'map' },
  { label: 'external', insert: 'external: true', hint: 'bool' },
  { label: 'name', insert: 'name: ', hint: 'string' },
  { label: 'attachable', insert: 'attachable: true', hint: 'bool' },
  { label: 'internal', insert: 'internal: true', hint: 'bool' },
  { label: 'enable_ipv6', insert: 'enable_ipv6: true', hint: 'bool' },
  { label: 'ipam', insert: 'ipam:', hint: 'map' },
]

const VOLUME_SUBKEYS: Suggestion[] = [
  { label: 'driver', insert: 'driver: local', hint: 'string' },
  { label: 'driver_opts', insert: 'driver_opts:', hint: 'map' },
  { label: 'external', insert: 'external: true', hint: 'bool' },
  { label: 'name', insert: 'name: ', hint: 'string' },
  { label: 'labels', insert: 'labels:', hint: 'map' },
]

const IPAM_SUBKEYS: Suggestion[] = [
  { label: 'driver', insert: 'driver: default', hint: 'string' },
  { label: 'config', insert: 'config:', hint: 'list' },
  { label: 'options', insert: 'options:', hint: 'map' },
]

const RESTART_VALUES: Suggestion[] = [
  { label: 'no', insert: 'no', hint: 'restart' },
  { label: 'always', insert: 'always', hint: 'restart' },
  { label: 'on-failure', insert: 'on-failure', hint: 'restart' },
  { label: 'unless-stopped', insert: 'unless-stopped', hint: 'restart' },
]

const LIST_ITEM_INSERTS: Record<string, Suggestion[]> = {
  ports: [{ label: '- "8080:80"', insert: '- "8080:80"', hint: 'host:container' }],
  expose: [{ label: '- "3000"', insert: '- "3000"', hint: 'port' }],
  volumes: [{ label: '- ./data:/data', insert: '- ./data:/data', hint: 'source:target' }],
  env_file: [{ label: '- .env', insert: '- .env', hint: 'path' }],
  depends_on: [],
  links: [{ label: '- db', insert: '- db', hint: 'service' }],
  cap_add: [{ label: '- NET_ADMIN', insert: '- NET_ADMIN', hint: 'capability' }],
  cap_drop: [{ label: '- ALL', insert: '- ALL', hint: 'capability' }],
  devices: [{ label: '- /dev/ttyUSB0:/dev/ttyUSB0', insert: '- /dev/ttyUSB0:/dev/ttyUSB0', hint: 'host:container' }],
  dns: [{ label: '- 1.1.1.1', insert: '- 1.1.1.1', hint: 'ip' }],
  extra_hosts: [{ label: '- "host.docker.internal:host-gateway"', insert: '- "host.docker.internal:host-gateway"', hint: 'host:ip' }],
  labels: [{ label: '- com.example.key=value', insert: '- com.example.key=value', hint: 'key=value' }],
  configs: [{ label: '- source: myconfig', insert: '- source: myconfig', hint: 'config' }],
  secrets: [{ label: '- source: mysecret', insert: '- source: mysecret', hint: 'secret' }],
}

const MAP_SUBKEYS: Record<string, Suggestion[]> = {
  healthcheck: HEALTHCHECK_KEYS,
  logging: LOGGING_KEYS,
  build: BUILD_KEYS,
  deploy: DEPLOY_KEYS,
  networks: NETWORK_SUBKEYS,
  ipam: IPAM_SUBKEYS,
}

interface LineInfo {
  indent: number
  text: string // trimmed
  raw: string
  key: string | null
}

function lineInfo(line: string): LineInfo {
  const raw = line.replace(/\t/g, '  ')
  const indent = raw.match(/^\s*/)?.[0].length ?? 0
  const text = raw.trim()
  const stripped = text.replace(/^-\s*/, '')
  const keyMatch = stripped.match(/^[\w.-]+(?=\s*:)/)
  return { indent, text, raw, key: keyMatch ? keyMatch[0] : null }
}

function indentOf(line: string): number {
  return line.replace(/\t/g, '  ').match(/^\s*/)?.[0].length ?? 0
}

function serviceNames(text: string): string[] {
  try {
    const doc = parse(text) as any
    if (doc && typeof doc === 'object' && doc.services) {
      return Object.keys(doc.services)
    }
  } catch {
    /* fall through */
  }
  const names: string[] = []
  const re = /^\s{2}([\w.-]+):\s*$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) names.push(m[1])
  return names
}

function findParent(lines: string[], currentIndex: number, currentIndent: number): LineInfo | null {
  for (let i = currentIndex - 1; i >= 0; i--) {
    const info = lineInfo(lines[i])
    if (!info.text || info.text.startsWith('#')) continue
    if (info.indent < currentIndent) return info
  }
  return null
}

function findKeyAtIndent(lines: string[], currentIndex: number, indent: number): LineInfo | null {
  for (let i = currentIndex - 1; i >= 0; i--) {
    const info = lineInfo(lines[i])
    if (!info.text || info.text.startsWith('#')) continue
    if (info.indent === indent) return info
    if (info.indent < indent) return null
  }
  return null
}

export function getSuggestions(text: string, caret: number, extraEnv: string[] = []): SuggestionResult {
  const before = text.slice(0, caret)
  const lines = before.split('\n')
  const currentIndex = lines.length - 1
  const currentRaw = lines[currentIndex]
  const currentIndent = indentOf(currentRaw)
  const body = currentRaw.slice(currentIndent)
  const wordMatch = body.match(/([\w.-]*)$/)
  const word = wordMatch ? wordMatch[1] : ''
  const beforeWord = body.slice(0, body.length - word.length)
  const replaceFrom = caret - word.length

  // $ / ${...} interpolation — suggest env vars as soon as "$" (or "${") is typed
  let triggerLen = 0
  if (beforeWord.endsWith('${')) triggerLen = 2
  else if (beforeWord.endsWith('$')) triggerLen = 1
  if (triggerLen) {
    const prev = beforeWord[beforeWord.length - triggerLen - 1]
    // avoid false triggers inside values like abc$def
    if (!prev || !/[\w.-]/.test(prev)) {
      const start = caret - word.length - triggerLen
      return { items: envItems(extraEnv, 'interp'), replaceFrom: start, filterText: word }
    }
  }

  // Only trigger once the user has actually typed a character (spaces don't count).
  if (!word) return { items: [], replaceFrom, filterText: '' }

  // If there is a colon before the word, we are typing a value — no key suggestions.
  if (/:/.test(beforeWord)) {
    // Except: value completions for restart: (list values)
    const parent = findParent(lines, currentIndex, currentIndent)
    if (parent?.key === 'restart') {
      return { items: RESTART_VALUES, replaceFrom, filterText: word }
    }
    return { items: [], replaceFrom, filterText: word }
  }

  const services = serviceNames(text)
  const parent = findParent(lines, currentIndex, currentIndent)
  const parentKey = parent?.key || null

  // Service names under services:
  if (parentKey === 'services' && currentIndent === 2) {
    const names = [...new Set([...COMMON_SERVICE_NAMES, ...services])]
    return {
      items: names.map((n) => ({ label: `${n}:`, insert: `${n}:`, hint: 'service' })),
      replaceFrom,
      filterText: word,
    }
  }

  // Service sub-keys (indent 4 under a service name inside services)
  if (currentIndent === 4 && parentKey) {
    const great = findKeyAtIndent(lines, currentIndex, 0)
    if (great?.key === 'services') {
      return { items: SERVICE_KEYS, replaceFrom, filterText: word }
    }
  }

  // Inside a map sub-key of a service (indent 6+) — parent key decides
  if (currentIndent >= 6 && parentKey) {
    if (parentKey === 'environment') {
      return { items: envItems(extraEnv, 'map'), replaceFrom, filterText: word }
    }
    if (parentKey === 'depends_on') {
      return { items: services.map((n) => ({ label: n, insert: n, hint: 'service' })), replaceFrom, filterText: word }
    }
    if (parentKey === 'restart') {
      return { items: RESTART_VALUES, replaceFrom, filterText: word }
    }
    if (parentKey in LIST_ITEM_INSERTS) {
      const base = LIST_ITEM_INSERTS[parentKey]
      if (base.length === 0 && parentKey === 'depends_on') {
        return { items: services.map((n) => ({ label: n, insert: n, hint: 'service' })), replaceFrom, filterText: word }
      }
      return { items: base, replaceFrom, filterText: word }
    }
    if (parentKey === 'networks') {
      const names = [...new Set(['default', ...services])]
      return { items: names.map((n) => ({ label: `- ${n}`, insert: `- ${n}`, hint: 'network' })), replaceFrom, filterText: word }
    }
  }

  // Inside a service-level networks: map (indent 6)
  if (currentIndent >= 6 && parentKey) {
    const grand = findParent(lines, currentIndex, parent!.indent)
    if (grand?.key === 'networks') {
      const names = [...new Set(['default', ...services])]
      return { items: names.map((n) => ({ label: n, insert: `${n}:`, hint: 'network' })), replaceFrom, filterText: word }
    }
  }

  // Map sub-keys like healthcheck:, logging:, build:, deploy:, ipam:
  if (parentKey && parentKey in MAP_SUBKEYS && currentIndent >= 6) {
    return { items: MAP_SUBKEYS[parentKey], replaceFrom, filterText: word }
  }

  // Top-level networks/volumes entries (indent 2 under networks:/volumes:)
  if (currentIndent === 2 && parentKey === 'networks') {
    const names = [...new Set(['default', ...services])]
    return { items: names.map((n) => ({ label: n, insert: `${n}:`, hint: 'network' })), replaceFrom, filterText: word }
  }
  if (currentIndent === 2 && parentKey === 'volumes') {
    return {
      items: ['db_data', 'data', 'uploads', 'storage', 'cache'].map((n) => ({ label: n, insert: `${n}:`, hint: 'volume' })),
      replaceFrom,
      filterText: word,
    }
  }

  // Network/volume sub-keys (indent 4 under a named entry)
  if (currentIndent === 4 && parentKey) {
    const grand = findParent(lines, currentIndex, parent!.indent)
    if (grand?.key === 'networks' || grand?.key === 'volumes') {
      return { items: grand.key === 'networks' ? NETWORK_SUBKEYS : VOLUME_SUBKEYS, replaceFrom, filterText: word }
    }
  }

  // Top level
  if (currentIndent === 0) {
    return { items: TOP_LEVEL_KEYS, replaceFrom, filterText: word }
  }

  // Service sub-keys fallback: any indent ≥ 2 under services
  if (parentKey && parentKey !== 'services') {
    return { items: SERVICE_KEYS, replaceFrom, filterText: word }
  }

  return { items: [], replaceFrom, filterText: word }
}
