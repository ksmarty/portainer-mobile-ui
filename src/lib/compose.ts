import { parse, stringify, YAMLParseError } from 'yaml'
import { getSchemaConfig, type ComposeSchemaConfig } from './schema'

export interface ComposeFormatResult {
  yaml: string
  warnings: string[]
  error?: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function reorderKeys(obj: Record<string, unknown>, order: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const seen = new Set<string>()
  for (const key of order) {
    if (key in obj && !seen.has(key)) {
      out[key] = obj[key]
      seen.add(key)
    }
  }
  for (const key of Object.keys(obj)) {
    if (!seen.has(key)) {
      out[key] = obj[key]
      seen.add(key)
    }
  }
  return out
}

function normalizeEnvironment(env: unknown, warnings: string[]): unknown {
  if (!Array.isArray(env)) return env
  const map: Record<string, unknown> = {}
  for (const item of env) {
    if (isPlainObject(item)) {
      for (const [k, v] of Object.entries(item)) map[k] = v
    } else if (typeof item === 'string') {
      const eq = item.indexOf('=')
      if (eq === -1) {
        map[item] = ''
        warnings.push(`environment: "${item}" had no value, set to empty string`)
      } else {
        map[item.slice(0, eq)] = item.slice(eq + 1)
      }
    }
  }
  warnings.push('environment converted from list to map (colon) notation')
  return map
}

function normalizeService(name: string, svc: unknown, warnings: string[], cfg: ComposeSchemaConfig): unknown {
  if (!isPlainObject(svc)) return svc

  const service = { ...svc }

  if (cfg.requireContainerName && !service.container_name) {
    service.container_name = name
    warnings.push(`service "${name}": added container_name: ${name}`)
  }
  if (!service.image && !service.build) {
    warnings.push(`service "${name}": missing image (and build)`)
  }
  if (cfg.colonEnvironment && 'environment' in service) {
    service.environment = normalizeEnvironment(service.environment, warnings)
  }

  return reorderKeys(service, cfg.keyOrder)
}

function stringifyDoc(doc: unknown): string {
  return stringify(doc, { indent: 2, lineWidth: 0, defaultStringType: 'PLAIN', defaultKeyType: 'PLAIN' })
}

/** Pure prettify: parse and re-stringify with consistent indentation. */
export function formatCompose(input: string): ComposeFormatResult {
  const trimmed = input.trim()
  if (!trimmed) return { yaml: '', warnings: [] }
  try {
    const doc = parse(trimmed)
    return { yaml: stringifyDoc(doc), warnings: [] }
  } catch (e) {
    if (e instanceof YAMLParseError) {
      return { yaml: input, warnings: [], error: `${e.message} (line ${e.linePos?.[0]?.line ?? '?'})` }
    }
    return { yaml: input, warnings: [], error: (e as Error).message }
  }
}

/** Opinionated schema: configurable key order + rules from settings. */
export function normalizeCompose(input: string, cfg?: ComposeSchemaConfig): ComposeFormatResult {
  const config = cfg ?? getSchemaConfig()
  const trimmed = input.trim()
  if (!trimmed) return { yaml: '', warnings: ['Empty file'] }

  let doc: unknown
  try {
    doc = parse(trimmed)
  } catch (e) {
    if (e instanceof YAMLParseError) {
      return { yaml: input, warnings: [], error: `${e.message} (line ${e.linePos?.[0]?.line ?? '?'})` }
    }
    return { yaml: input, warnings: [], error: (e as Error).message }
  }

  const warnings: string[] = []

  if (isPlainObject(doc) && isPlainObject(doc.services)) {
    const services: Record<string, unknown> = {}
    for (const [name, svc] of Object.entries(doc.services)) {
      services[name] = normalizeService(name, svc, warnings, config)
    }
    const top: Record<string, unknown> = { services }
    for (const [k, v] of Object.entries(doc)) {
      if (k !== 'services') top[k] = v
    }
    const ordered: Record<string, unknown> = {}
    if ('version' in top) ordered.version = top.version
    ordered.services = top.services
    for (const [k, v] of Object.entries(top)) {
      if (k !== 'version' && k !== 'services') ordered[k] = v
    }
    return { yaml: stringifyDoc(ordered), warnings }
  }

  if (isPlainObject(doc)) {
    return { yaml: stringifyDoc(doc), warnings: ['No top-level "services" key found'] }
  }

  return { yaml: stringifyDoc(doc), warnings: ['Expected a compose file with a "services" map'] }
}
