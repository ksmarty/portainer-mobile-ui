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

/**
 * Every distinct `image:` reference declared in a compose file, with stack env
 * variables interpolated the same way `docker compose` would (e.g.
 * `${REGISTRY}/app:${TAG}`). Used by "pull latest images for this stack".
 */
export function extractComposeImages(
  input: string,
  env: { name: string; value: string }[] = [],
): string[] {
  const vars = new Map(env.map((e) => [e.name, e.value]))
  const interpolate = (value: string) =>
    value
      // ${VAR:-default} / ${VAR-default} / ${VAR:?err} / ${VAR?err}
      .replace(
        /\$\{([A-Za-z_][A-Za-z0-9_]*)(:?[-?])([^}]*)\}/g,
        (_, key: string, op: string, arg: string) => {
          const v = vars.get(key)
          if (v !== undefined && v !== '') return v
          return op === ':-' || op === '-' ? arg : ''
        },
      )
      .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, key: string) => vars.get(key) ?? '')
      .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, key: string) => vars.get(key) ?? '')

  let doc: unknown
  try {
    doc = parse(input)
  } catch {
    return []
  }
  if (!isPlainObject(doc) || !isPlainObject(doc.services)) return []

  const seen = new Set<string>()
  for (const svc of Object.values(doc.services)) {
    if (!isPlainObject(svc) || typeof svc.image !== 'string') continue
    const image = interpolate(svc.image).trim()
    if (image) seen.add(image)
  }
  return [...seen]
}

/**
 * Merge the services (and top-level volumes/networks/etc.) from `addition`
 * into `base`, so "run → compose" adds to the stack instead of replacing it.
 * Name collisions get a numeric suffix rather than clobbering an existing
 * service.
 */
export function mergeCompose(base: string, addition: string): ComposeFormatResult {
  const add = addition.trim()
  if (!add) return { yaml: base, warnings: [] }

  let addDoc: unknown
  try {
    addDoc = parse(add)
  } catch (e) {
    return { yaml: base, warnings: [], error: (e as Error).message }
  }
  if (!isPlainObject(addDoc)) return { yaml: base, warnings: [] }

  const baseYaml = base.trim()
  if (!baseYaml) return { yaml: stringifyDoc(addDoc), warnings: [] }

  let baseDoc: unknown
  try {
    baseDoc = parse(baseYaml)
  } catch {
    // Base is not valid YAML — keep the addition so the user doesn't lose it.
    return { yaml: add, warnings: ['Existing compose file could not be parsed — replaced with the new service'] }
  }
  if (!isPlainObject(baseDoc)) return { yaml: add, warnings: [] }

  const warnings: string[] = []
  const addServices = isPlainObject(addDoc.services) ? addDoc.services : {}
  const mergedServices: Record<string, unknown> = isPlainObject(baseDoc.services) ? { ...baseDoc.services } : {}
  for (const [name, svc] of Object.entries(addServices)) {
    let key = name
    let n = 2
    while (key in mergedServices) key = `${name}-${n++}`
    if (key !== name) warnings.push(`Service "${name}" already exists — added as "${key}"`)
    mergedServices[key] = svc
  }

  const out: Record<string, unknown> = {}
  if ('version' in baseDoc) out.version = baseDoc.version
  out.services = mergedServices
  for (const [k, v] of Object.entries(baseDoc)) {
    if (k !== 'version' && k !== 'services') out[k] = v
  }
  for (const k of ['volumes', 'networks', 'configs', 'secrets']) {
    const extra = (addDoc as Record<string, unknown>)[k]
    if (isPlainObject(extra)) {
      out[k] = { ...(isPlainObject(out[k]) ? (out[k] as Record<string, unknown>) : {}), ...extra }
    }
  }
  return { yaml: stringifyDoc(out), warnings }
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
