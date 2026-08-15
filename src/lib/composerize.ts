// Convert a `docker run ...` command into a docker-compose service YAML.
// Supports the most common flags used on mobile: -d, --name, -p/--publish,
// -v/--volume, -e/--env, --env-file, --restart, --network, --link, --hostname,
// --label, -m/--memory, --cpus, --user, -w/--workdir, --entrypoint, --cap-add,
// --device, --privileged, --read-only, --log-driver, --log-opt and trailing CMD.

export interface ComposeResult {
  yaml: string
  serviceName: string
  warnings: string[]
}

function tokens(input: string): string[] {
  // split on whitespace while respecting single/double quotes
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      if (cur) {
        out.push(cur)
        cur = ''
      }
      continue
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

function yamlString(v: string): string {
  if (/^[a-zA-Z0-9_.\/:+=@-]+$/.test(v) && !/^\d/.test(v) && v !== 'true' && v !== 'false') return v
  return JSON.stringify(v)
}

function listItem(v: string): string {
  return `      - ${yamlString(v)}`
}

export function dockerRunToCompose(cmd: string): ComposeResult {
  const warnings: string[] = []
  const t = tokens(cmd.trim())
  if (t[0] === 'docker') t.shift()
  if (t[0] === 'run') t.shift()

  let name = ''
  let image = ''
  const ports: string[] = []
  const volumes: string[] = []
  const environment: string[] = []
  const envFiles: string[] = []
  const labels: string[] = []
  const links: string[] = []
  const devices: string[] = []
  const capAdd: string[] = []
  const logOpts: string[] = []
  const command: string[] = []
  const flags: Record<string, string | boolean> = {
    restart: 'no',
    network: '',
    hostname: '',
    user: '',
    workdir: '',
    entrypoint: '',
    memory: '',
    cpus: '',
    log_driver: '',
    privileged: false,
    read_only: false,
    detach: false,
  }

  for (let i = 0; i < t.length; i++) {
    const tok = t[i]
    const next = () => t[++i]
    const val = (flag: string): string => {
      const v = next()
      if (v === undefined) warnings.push(`Missing value for ${flag}`)
      return v ?? ''
    }

    if (tok === '-d' || tok === '--detach') flags.detach = true
    else if (tok === '--name') name = val(tok)
    else if (tok === '-p' || tok === '--publish' || tok === '-P' || tok === '--publish-all') {
      if (tok === '-P' || tok === '--publish-all') ports.push('')
      else ports.push(val(tok))
    } else if (tok === '-v' || tok === '--volume') volumes.push(val(tok))
    else if (tok === '-e' || tok === '--env') environment.push(val(tok))
    else if (tok === '--env-file') envFiles.push(val(tok))
    else if (tok === '-l' || tok === '--label') labels.push(val(tok))
    else if (tok === '--link') links.push(val(tok))
    else if (tok === '--device') devices.push(val(tok))
    else if (tok === '--cap-add') capAdd.push(val(tok))
    else if (tok === '--restart') flags.restart = val(tok)
    else if (tok === '--network' || tok === '--net') flags.network = val(tok)
    else if (tok === '-h' || tok === '--hostname') flags.hostname = val(tok)
    else if (tok === '-u' || tok === '--user') flags.user = val(tok)
    else if (tok === '-w' || tok === '--workdir') flags.workdir = val(tok)
    else if (tok === '--entrypoint') flags.entrypoint = val(tok)
    else if (tok === '-m' || tok === '--memory') flags.memory = val(tok)
    else if (tok === '--cpus') flags.cpus = val(tok)
    else if (tok === '--log-driver') flags.log_driver = val(tok)
    else if (tok === '--log-opt') logOpts.push(val(tok))
    else if (tok === '--privileged') flags.privileged = true
    else if (tok === '--read-only') flags.read_only = true
    else if (tok === '--rm') warnings.push('--rm has no equivalent in compose (use `docker compose run`)')
    else if (tok.startsWith('-') && !tok.startsWith('--env') && tok !== '--name') {
      // combined short flags like -it
      if (/^-[a-z]+$/i.test(tok)) {
        warnings.push(`Ignored flag ${tok}`)
      } else {
        warnings.push(`Ignored flag ${tok}`)
      }
    } else if (!image) {
      image = tok
    } else {
      command.push(tok)
    }
  }

  if (!image) {
    return { yaml: '', serviceName: name, warnings: [...warnings, 'No image found in command'] }
  }

  const serviceName = (name || image.replace(/[:@/]/g, '-')).replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/^-+/, '') || 'app'

  const lines: string[] = []
  lines.push('services:')
  lines.push(`  ${serviceName}:`)
  lines.push(`    image: ${yamlString(image)}`)

  if (ports.length) {
    lines.push('    ports:')
    for (const p of ports) lines.push(p === '' ? '      - "80"' : `      - "${p.replace(/^["']|["']$/g, '')}"`)
  }
  if (volumes.length) {
    lines.push('    volumes:')
    for (const v of volumes) lines.push(`      - ${yamlString(v.replace(/^["']|["']$/g, ''))}`)
  }
  if (environment.length) {
    lines.push('    environment:')
    for (const e of environment) {
      const m = e.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (m) lines.push(`      ${m[1]}: ${yamlString(m[2])}`)
      else lines.push(`      - ${yamlString(e)}`)
    }
  }
  if (envFiles.length) {
    lines.push('    env_file:')
    for (const f of envFiles) lines.push(listItem(f))
  }
  if (labels.length) {
    lines.push('    labels:')
    for (const l of labels) lines.push(listItem(l))
  }
  if (links.length) {
    lines.push('    links:')
    for (const l of links) lines.push(listItem(l))
  }
  if (devices.length) {
    lines.push('    devices:')
    for (const d of devices) lines.push(listItem(d))
  }
  if (capAdd.length) {
    lines.push('    cap_add:')
    for (const c of capAdd) lines.push(listItem(c))
  }
  if (flags.restart && flags.restart !== 'no') {
    lines.push(`    restart: ${yamlString(String(flags.restart))}`)
  }
  if (flags.network) lines.push(`    network_mode: ${yamlString(String(flags.network))}`)
  if (flags.hostname) lines.push(`    hostname: ${yamlString(String(flags.hostname))}`)
  if (flags.user) lines.push(`    user: ${yamlString(String(flags.user))}`)
  if (flags.workdir) lines.push(`    working_dir: ${yamlString(String(flags.workdir))}`)
  if (flags.entrypoint) lines.push(`    entrypoint: ${yamlString(String(flags.entrypoint))}`)
  if (flags.memory) lines.push(`    mem_limit: ${yamlString(String(flags.memory))}`)
  if (flags.cpus) lines.push(`    cpus: ${yamlString(String(flags.cpus))}`)
  if (flags.log_driver) {
    lines.push('    logging:')
    lines.push(`      driver: ${yamlString(String(flags.log_driver))}`)
    if (logOpts.length) {
      lines.push('      options:')
      for (const o of logOpts) {
        const m = o.match(/^([^=]+)=(.*)$/)
        if (m) lines.push(`        ${m[1]}: ${yamlString(m[2])}`)
      }
    }
  }
  if (flags.privileged) lines.push('    privileged: true')
  if (flags.read_only) lines.push('    read_only: true')
  if (command.length) {
    lines.push('    command:')
    for (const c of command) lines.push(listItem(c))
  }

  return { yaml: lines.join('\n') + '\n', serviceName, warnings }
}

export function isValidDockerRun(cmd: string): boolean {
  const t = tokens(cmd.trim())
  return t[0] === 'docker' && t[1] === 'run'
}
