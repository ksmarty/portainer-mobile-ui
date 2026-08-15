import { parse, stringify } from 'yaml'
import { sanitizeName } from './utils'

// Opinionated compose schema. The first keys are emitted in this exact order
// per service, then any remaining keys follow in their original order.
export const SERVICE_KEY_ORDER = [
  'image',
  'container_name',
  'environment',
  'restart',
  'command',
  'entrypoint',
  'ports',
  'volumes',
  'networks',
  'depends_on',
  'labels',
  'env_file',
  'logging',
  'healthcheck',
  'mem_limit',
  'cpus',
  'user',
  'working_dir',
  'hostname',
  'links',
  'devices',
  'cap_add',
  'privileged',
  'read_only',
] as const

const TOP_LEVEL_ORDER = ['services', 'version', 'volumes', 'networks', 'configs', 'secrets']

export interface FormatResult {
  yaml: string
  warnings: string[]
  changed: boolean
}

/**
 * Normalize a docker-compose file to the house schema:
 * - `services` first, then version/volumes/networks
 * - per service: image, container_name, environment, restart first
 * - environment always uses `KEY: value` (colon) notation
 * - every service gets a container_name (derived from the service name)
 */
export function formatCompose(text: string): FormatResult {
  const warnings: string[] = []
  if (!text.trim()) return { yaml: text, warnings: ['Nothing to format'], changed: false }

  let data: any
  try {
    data = parse(text)
  } catch (e) {
    return { yaml: text, warnings: ['Invalid YAML: ' + (e as Error).message], changed: false }
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { yaml: text, warnings: ['Expected a compose document with a `services:` map'], changed: false }
  }

  const root: Record<string, any> = {}

  if (data.services && typeof data.services === 'object' && !Array.isArray(data.services)) {
    root.services = {}
    for (const [svc, svcVal] of Object.entries(data.services)) {
      if (!svcVal || typeof svcVal !== 'object' || Array.isArray(svcVal)) {
        root.services[svc] = svcVal
        continue
      }
      const src = svcVal as Record<string, any>
      const out: Record<string, any> = {}

      // Rule: environment must be colon notation (a map, not a list of KEY=value).
      if ('environment' in src && src.environment != null) {
        const env = src.environment
        if (Array.isArray(env)) {
          const map: Record<string, any> = {}
          let fromList = false
          for (const item of env) {
            if (typeof item === 'string') {
              fromList = true
              const eq = item.indexOf('=')
              if (eq >= 0) map[item.slice(0, eq)] = item.slice(eq + 1)
              else map[item] = ''
            } else if (item && typeof item === 'object') {
              fromList = true
              Object.assign(map, item)
            }
          }
          src.environment = map
          if (fromList) warnings.push(`environment → colon notation in "${svc}"`)
        } else if (typeof env === 'string') {
          const eq = env.indexOf('=')
          if (eq >= 0) {
            src.environment = { [env.slice(0, eq)]: env.slice(eq + 1) }
            warnings.push(`environment → colon notation in "${svc}"`)
          } else {
            src.environment = { [env]: '' }
          }
        }
      }

      // Rule: every service must have a container_name.
      if (!src.container_name) {
        const generated = sanitizeName(svc)
        out.container_name = generated
        warnings.push(`added container_name: ${generated}`)
      }

      // Emit keys in opinionated order, then any unknown keys.
      const seen = new Set<string>()
      for (const key of SERVICE_KEY_ORDER) {
        if (key in src) {
          out[key] = src[key]
          seen.add(key)
        }
      }
      for (const key of Object.keys(src)) {
        if (!seen.has(key)) {
          out[key] = src[key]
          seen.add(key)
        }
      }

      root.services[svc] = out
    }
  } else {
    warnings.push('No `services:` map found')
  }

  for (const key of TOP_LEVEL_ORDER) {
    if (key in data && key !== 'services') root[key] = data[key]
  }
  for (const key of Object.keys(data)) {
    if (!(key in root)) root[key] = data[key]
  }

  let yaml: string
  try {
    yaml = stringify(root, { indent: 2, lineWidth: 0 })
  } catch (e) {
    return { yaml: text, warnings: ['Could not serialize YAML: ' + (e as Error).message], changed: false }
  }

  return { yaml, warnings, changed: yaml !== text }
}

/** Small standalone validation used by the editor UI. */
export function validateCompose(text: string): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!text.trim()) return { ok: false, errors: ['Compose file is empty'] }
  let data: any
  try {
    data = parse(text)
  } catch (e) {
    return { ok: false, errors: ['Invalid YAML: ' + (e as Error).message] }
  }
  if (!data || typeof data !== 'object') return { ok: false, errors: ['Invalid compose document'] }
  if (!data.services || typeof data.services !== 'object') {
    return { ok: false, errors: ['Missing `services:` map'] }
  }
  for (const [svc, val] of Object.entries(data.services)) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      errors.push(`Service "${svc}" must be a mapping`)
      continue
    }
    if (!(val as any).image) errors.push(`Service "${svc}" has no image`)
  }
  return { ok: errors.length === 0, errors }
}
