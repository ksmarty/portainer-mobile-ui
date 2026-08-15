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
import { jsonClone, uid } from './utils'

const now = Math.floor(Date.now() / 1000)
const min = (n: number) => now - n * 60
const mb = (n: number) => n * 1024 * 1024
const gb = (n: number) => n * 1024 * 1024 * 1024

interface DB {
  containers: Container[]
  images: Image[]
  networks: Network[]
  volumes: Volume[]
  stacks: Stack[]
  endpoints: Endpoint[]
  users: User[]
  teams: Team[]
  registries: Registry[]
  settings: Settings
}

export const demoState: DB = {
  containers: [
    {
      Id: 'a1b2c3d4e5f6',
      Names: ['/nginx-proxy'],
      Image: 'nginx:1.27-alpine',
      ImageID: 'sha256:9d8a...e2f1',
      Command: '/docker-entrypoint.sh nginx -g "daemon off;"',
      Created: min(4320),
      Ports: [
        { IP: '0.0.0.0', PrivatePort: 80, PublicPort: 8080, Type: 'tcp' },
        { IP: '0.0.0.0', PrivatePort: 443, PublicPort: 8443, Type: 'tcp' },
      ],
      State: 'running',
      Status: 'Up 3 days',
      Labels: { 'com.docker.compose.project': 'edge', role: 'proxy' },
      NetworkMode: 'bridge',
      Networks: ['edge_default'],
      IPs: ['172.18.0.2'],
      RestartPolicy: 'unless-stopped',
      Platform: 'linux/amd64',
    },
    {
      Id: 'b2c3d4e5f6a7',
      Names: ['/postgres-db'],
      Image: 'postgres:16-alpine',
      ImageID: 'sha256:1c2f...a8b3',
      Command: 'postgres',
      Created: min(10080),
      Ports: [{ IP: '127.0.0.1', PrivatePort: 5432, PublicPort: 5432, Type: 'tcp' }],
      State: 'running',
      Status: 'Up 1 week (healthy)',
      Labels: { 'com.docker.compose.project': 'edge', role: 'database' },
      Mounts: [{ Type: 'volume', Name: 'pg_data', Source: '/var/lib/docker/volumes/pg_data/_data', Destination: '/var/lib/postgresql/data' }],
      NetworkMode: 'bridge',
      Networks: ['edge_default'],
      IPs: ['172.18.0.3'],
      RestartPolicy: 'always',
      Platform: 'linux/amd64',
    },
    {
      Id: 'c3d4e5f6a7b8',
      Names: ['/redis-cache'],
      Image: 'redis:7-alpine',
      ImageID: 'sha256:5b3a...c91d',
      Command: 'redis-server --appendonly yes',
      Created: min(7200),
      Ports: [{ IP: '0.0.0.0', PrivatePort: 6379, PublicPort: 6379, Type: 'tcp' }],
      State: 'running',
      Status: 'Up 5 days',
      Labels: { 'com.docker.compose.project': 'edge', role: 'cache' },
      NetworkMode: 'bridge',
      Networks: ['edge_default'],
      IPs: ['172.18.0.4'],
      RestartPolicy: 'always',
      Platform: 'linux/amd64',
    },
    {
      Id: 'd4e5f6a7b8c9',
      Names: ['/api-backend'],
      Image: 'node:20-alpine',
      ImageID: 'sha256:7f01...4c2e',
      Command: 'npm run start:prod',
      Created: min(300),
      Ports: [{ IP: '0.0.0.0', PrivatePort: 3000, PublicPort: 3000, Type: 'tcp' }],
      State: 'running',
      Status: 'Up 5 hours',
      Labels: { 'com.docker.compose.project': 'edge', role: 'api' },
      Mounts: [{ Type: 'bind', Source: '/srv/app', Destination: '/app', RW: true }],
      NetworkMode: 'bridge',
      Networks: ['edge_default'],
      IPs: ['172.18.0.5'],
      RestartPolicy: 'on-failure:5',
      Platform: 'linux/amd64',
    },
    {
      Id: 'e5f6a7b8c9d0',
      Names: ['/worker-cron'],
      Image: 'python:3.12-slim',
      ImageID: 'sha256:2aa8...f7c0',
      Command: 'python -m celery -A tasks worker',
      Created: min(160),
      Ports: [],
      State: 'exited',
      Status: 'Exited (137) 2 hours ago',
      Labels: { 'com.docker.compose.project': 'edge', role: 'worker' },
      NetworkMode: 'bridge',
      Networks: ['edge_default'],
      IPs: ['172.18.0.6'],
      RestartPolicy: 'no',
      Platform: 'linux/amd64',
    },
    {
      Id: 'f6a7b8c9d0e1',
      Names: ['/monitoring-grafana'],
      Image: 'grafana/grafana:latest',
      ImageID: 'sha256:4e77...19ab',
      Command: '/run.sh',
      Created: min(20160),
      Ports: [{ IP: '0.0.0.0', PrivatePort: 3000, PublicPort: 3001, Type: 'tcp' }],
      State: 'running',
      Status: 'Up 2 weeks',
      Labels: { 'com.docker.compose.project': 'monitoring' },
      Mounts: [{ Type: 'volume', Name: 'grafana_data', Source: '/var/lib/docker/volumes/grafana_data/_data', Destination: '/var/lib/grafana' }],
      NetworkMode: 'bridge',
      Networks: ['monitoring_default'],
      IPs: ['172.19.0.2'],
      RestartPolicy: 'always',
      Platform: 'linux/amd64',
    },
    {
      Id: 'a7b8c9d0e1f2',
      Names: ['/demo-paused'],
      Image: 'busybox:1.36',
      ImageID: 'sha256:8c9d...02fe',
      Command: 'sleep 3600',
      Created: min(40),
      Ports: [],
      State: 'paused',
      Status: 'Up 40 minutes (Paused)',
      Labels: { demo: 'true' },
      NetworkMode: 'none',
      Networks: [],
      IPs: [],
      RestartPolicy: 'no',
      Platform: 'linux/amd64',
    },
  ],

  images: [
    {
      Id: 'sha256:9d8a...e2f1',
      RepoTags: ['nginx:1.27-alpine'],
      Created: min(345600),
      Size: mb(43),
      Containers: 1,
      Architecture: 'amd64',
      Os: 'linux',
    },
    {
      Id: 'sha256:1c2f...a8b3',
      RepoTags: ['postgres:16-alpine'],
      Created: min(432000),
      Size: mb(238),
      Containers: 1,
      Architecture: 'amd64',
      Os: 'linux',
    },
    {
      Id: 'sha256:5b3a...c91d',
      RepoTags: ['redis:7-alpine', 'redis:latest'],
      Created: min(259200),
      Size: mb(38),
      Containers: 1,
      Architecture: 'amd64',
      Os: 'linux',
    },
    {
      Id: 'sha256:7f01...4c2e',
      RepoTags: ['node:20-alpine'],
      Created: min(129600),
      Size: mb(182),
      Containers: 1,
      Architecture: 'amd64',
      Os: 'linux',
    },
    {
      Id: 'sha256:2aa8...f7c0',
      RepoTags: ['python:3.12-slim'],
      Created: min(172800),
      Size: mb(121),
      Containers: 1,
      Architecture: 'amd64',
      Os: 'linux',
    },
    {
      Id: 'sha256:4e77...19ab',
      RepoTags: ['grafana/grafana:latest'],
      Created: min(86400),
      Size: mb(430),
      Containers: 1,
      Architecture: 'amd64',
      Os: 'linux',
    },
    {
      Id: 'sha256:8c9d...02fe',
      RepoTags: ['busybox:1.36'],
      Created: min(518400),
      Size: mb(2.4),
      Containers: 1,
      Architecture: 'amd64',
      Os: 'linux',
    },
    {
      Id: 'sha256:3b12...77d9',
      RepoTags: ['traefik:v3.1'],
      Created: min(604800),
      Size: mb(96),
      Containers: 0,
      Architecture: 'amd64',
      Os: 'linux',
    },
    {
      Id: 'sha256:dangling-9f2a',
      RepoTags: [],
      Created: min(720),
      Size: mb(184),
      Containers: 0,
      Architecture: 'amd64',
      Os: 'linux',
    },
    {
      Id: 'sha256:dangling-c4d8',
      RepoTags: [],
      Created: min(1440),
      Size: mb(97),
      Containers: 0,
      Architecture: 'amd64',
      Os: 'linux',
    },
  ],

  networks: [
    {
      Id: 'net-edge-default',
      Name: 'edge_default',
      Driver: 'bridge',
      Scope: 'local',
      Internal: false,
      Attachable: true,
      Created: min(10080),
      Containers: [
        { Id: 'a1b2c3d4e5f6', Name: 'nginx-proxy', IPv4: '172.18.0.2/16' },
        { Id: 'b2c3d4e5f6a7', Name: 'postgres-db', IPv4: '172.18.0.3/16' },
        { Id: 'c3d4e5f6a7b8', Name: 'redis-cache', IPv4: '172.18.0.4/16' },
        { Id: 'd4e5f6a7b8c9', Name: 'api-backend', IPv4: '172.18.0.5/16' },
      ],
    },
    {
      Id: 'net-monitoring',
      Name: 'monitoring_default',
      Driver: 'bridge',
      Scope: 'local',
      Internal: false,
      Attachable: true,
      Created: min(20160),
      Containers: [{ Id: 'f6a7b8c9d0e1', Name: 'monitoring-grafana', IPv4: '172.19.0.2/16' }],
    },
    {
      Id: 'net-bridge',
      Name: 'bridge',
      Driver: 'bridge',
      Scope: 'local',
      Internal: false,
      Attachable: false,
      Created: min(900000),
      Containers: [],
    },
    {
      Id: 'net-host',
      Name: 'host',
      Driver: 'host',
      Scope: 'local',
      Internal: false,
      Attachable: false,
      Created: min(900000),
      Containers: [],
    },
    {
      Id: 'net-none',
      Name: 'none',
      Driver: 'null',
      Scope: 'local',
      Internal: false,
      Attachable: false,
      Created: min(900000),
      Containers: [],
    },
  ],

  volumes: [
    { Name: 'pg_data', Driver: 'local', Mountpoint: '/var/lib/docker/volumes/pg_data/_data', CreatedAt: new Date(min(10080) * 1000).toISOString(), Size: gb(2.4), RefCount: 1 },
    { Name: 'grafana_data', Driver: 'local', Mountpoint: '/var/lib/docker/volumes/grafana_data/_data', CreatedAt: new Date(min(20160) * 1000).toISOString(), Size: gb(0.8), RefCount: 1 },
    { Name: 'redis_data', Driver: 'local', Mountpoint: '/var/lib/docker/volumes/redis_data/_data', CreatedAt: new Date(min(7200) * 1000).toISOString(), Size: mb(140), RefCount: 1 },
    { Name: 'unused_backup', Driver: 'local', Mountpoint: '/var/lib/docker/volumes/unused_backup/_data', CreatedAt: new Date(min(120960) * 1000).toISOString(), Size: gb(5.1), RefCount: 0 },
  ],

  stacks: [
    {
      Id: 1,
      Name: 'edge',
      Type: 2,
      EndpointId: 1,
      Status: 1,
      CreationDate: min(10080),
      CreatedBy: 'admin',
      EntryPoint: 'docker-compose.yml',
      Env: [{ name: 'DOMAIN', value: 'edge.example.com' }],
      File: 'version: "3.8"\nservices:\n  nginx-proxy:\n    image: nginx:1.27-alpine\n    ports:\n      - "8080:80"\n  postgres-db:\n    image: postgres:16-alpine\n    volumes:\n      - pg_data:/var/lib/postgresql/data\n  redis-cache:\n    image: redis:7-alpine\n  api-backend:\n    image: node:20-alpine\n    command: npm run start:prod\nvolumes:\n  pg_data: {}\n',
    },
    {
      Id: 2,
      Name: 'monitoring',
      Type: 2,
      EndpointId: 1,
      Status: 1,
      CreationDate: min(20160),
      CreatedBy: 'admin',
      EntryPoint: 'docker-compose.yml',
      File: 'version: "3.8"\nservices:\n  grafana:\n    image: grafana/grafana:latest\n    ports:\n      - "3001:3000"\n    volumes:\n      - grafana_data:/var/lib/grafana\nvolumes:\n  grafana_data: {}\n',
    },
    {
      Id: 3,
      Name: 'staging-wordpress',
      Type: 1,
      EndpointId: 2,
      Status: 2,
      CreationDate: min(120),
      CreatedBy: 'admin',
      EntryPoint: 'docker-compose.yml',
      File: 'version: "3.8"\nservices:\n  wp:\n    image: wordpress:latest\n    ports:\n      - "8080:80"\n  db:\n    image: mysql:8\n    environment:\n      MYSQL_ROOT_PASSWORD: change-me\n',
    },
  ],

  endpoints: [
    {
      Id: 1,
      Name: 'primary',
      Type: 1,
      URL: 'unix:///var/run/docker.sock',
      PublicURL: 'https://docker.example.com',
      GroupId: 1,
      Status: 1,
      Snapshot: {
        DockerVersion: '27.3.1',
        TotalCPU: 8,
        TotalMemory: gb(16),
        RunningContainerCount: 5,
        StoppedContainerCount: 1,
        ImageCount: 8,
        VolumeCount: 4,
        ServiceCount: 0,
        StackCount: 2,
        NodeCount: 1,
      },
    },
    {
      Id: 2,
      Name: 'staging',
      Type: 4,
      URL: 'tcp://10.0.4.12:2375',
      PublicURL: 'http://10.0.4.12:2375',
      GroupId: 1,
      Status: 1,
      Snapshot: {
        DockerVersion: '26.1.4',
        TotalCPU: 4,
        TotalMemory: gb(8),
        RunningContainerCount: 2,
        StoppedContainerCount: 0,
        ImageCount: 12,
        VolumeCount: 2,
        ServiceCount: 0,
        StackCount: 1,
        NodeCount: 1,
      },
    },
    {
      Id: 3,
      Name: 'edge-warehouse',
      Type: 7,
      URL: 'tcp://tasks.edge-warehouse:8001',
      GroupId: 2,
      Status: 1,
      EdgeKey: 'aHR0cHM6Ly9leGFtcGxlLmNvbXx...',
      UserTrusted: true,
      Snapshot: {
        DockerVersion: '25.0.3',
        TotalCPU: 2,
        TotalMemory: gb(4),
        RunningContainerCount: 1,
        StoppedContainerCount: 0,
        ImageCount: 3,
        VolumeCount: 1,
        ServiceCount: 0,
        StackCount: 0,
        NodeCount: 1,
      },
    },
  ],

  users: [
    { Id: 1, Username: 'admin', Role: 1, AuthenticationMethod: 1, EndpointAuthorizations: { '1': 1, '2': 1 } },
    { Id: 2, Username: 'devops', Role: 2, AuthenticationMethod: 1, EndpointAuthorizations: { '1': 2, '2': 2 } },
    { Id: 3, Username: 'jane', Role: 2, AuthenticationMethod: 1, EndpointAuthorizations: { '1': 2 } },
    { Id: 4, Username: 'readonly', Role: 3, AuthenticationMethod: 1, EndpointAuthorizations: { '1': 3 } },
  ],

  teams: [
    { Id: 1, Name: 'developers' },
    { Id: 2, Name: 'operations' },
  ],

  registries: [
    { Id: 1, Name: 'Docker Hub', Type: 1, URL: 'docker.io', Authentication: false },
    { Id: 2, Name: 'GHCR', Type: 3, URL: 'ghcr.io', Authentication: true, Username: 'admin' },
    { Id: 3, Name: 'Private Harbor', Type: 4, URL: 'harbor.example.com', Authentication: true, Username: 'svc-portainer' },
  ],

  settings: {
    LogoURL: '',
    BlackListedLabels: [],
    AuthenticationMethod: 1,
    AllowBindMountsForRegularUsers: false,
    AllowPrivilegedModeForRegularUsers: false,
    EnableTelemetry: false,
    SnapshotInterval: '5m',
    TemplatesURL: 'https://raw.githubusercontent.com/portainer/templates/master/templates-2.0.json',
    EnableEdgeComputeFeatures: true,
    AllowVolumeBrowserForRegularUsers: false,
    TrustOnFirstConnect: false,
    EnableHostManagementFeatures: true,
    EdgePortainerUrl: '',
    ShowKomposeBuildOption: false,
    UserSessionTimeout: '8h',
  },
}

/* ------------------------------- getters -------------------------------- */

export function demoGet<T>(key: keyof DB): T {
  return jsonClone(demoState[key]) as T
}

export function demoDashboard(): DashboardStats {
  const eps = demoState.endpoints
  const running = demoState.containers.filter((c) => c.State === 'running').length
  const stopped = demoState.containers.filter((c) => c.State !== 'running').length
  const cpu = 34 + Math.floor(Math.random() * 25)
  const memUsed = gb(5.6) + Math.floor(Math.random() * 2) * gb(1)
  const memTotal = gb(16)
  return {
    endpoints: eps.length,
    stacks: demoState.stacks.length,
    containersRunning: running,
    containersStopped: stopped,
    images: demoState.images.length,
    volumes: demoState.volumes.length,
    networks: demoState.networks.length,
    cpu,
    memory: Math.round((memUsed / memTotal) * 100),
    memoryUsed: memUsed,
    memoryTotal: memTotal,
  }
}

export function demoLogs(containerId: string, lines = 80): LogLine[] {
  const c = demoState.containers.find((x) => x.Id === containerId)
  const name = (c?.Names[0] || 'container').replace('/', '')
  const out: LogLine[] = []
  const templates = [
    `[${name}] server listening on 0.0.0.0:80`,
    `[${name}] GET /health 200 1.2ms`,
    `[${name}] GET /api/v1 200 18.4ms`,
    `[${name}] POST /api/v1/events 201 33.1ms`,
    `[${name}] worker pool: 4 idle / 2 busy`,
    `[${name}] cache hit ratio 87.3%`,
    `[${name}] connection established from 172.18.0.1`,
    `[${name}] GC cycle completed in 9ms`,
    `[${name}] slow query detected (>100ms)`,
    `[${name}] heartbeat ok`,
  ]
  for (let i = 0; i < lines; i++) {
    const t = templates[Math.floor(Math.random() * templates.length)]
    const ts = new Date(Date.now() - (lines - i) * 900).toISOString().slice(11, 19)
    out.push({
      id: uid('log'),
      text: `${ts} ${t}`,
      stream: i % 7 === 0 ? 'stderr' : 'stdout',
    })
  }
  return out
}

export function demoStats(): Stats {
  const rand = (n: number, spread: number) => Math.max(0, n + (Math.random() - 0.5) * spread)
  return {
    cpuPercent: rand(14, 20),
    memPercent: rand(48, 12),
    memUsage: rand(mb(512), mb(60)),
    memLimit: gb(1),
    netRx: rand(120_000, 40_000),
    netTx: rand(48_000, 18_000),
    blockRead: rand(2_000_000, 800_000),
    blockWrite: rand(900_000, 300_000),
    pids: Math.floor(rand(28, 8)),
  }
}

/* ------------------------------- mutations ------------------------------ */

export function demoContainerAction(id: string, action: string) {
  const c = demoState.containers.find((x) => x.Id === id)
  if (!c) return
  switch (action) {
    case 'start':
      c.State = 'running'
      c.Status = 'Up Less than a second'
      break
    case 'stop':
      c.State = 'exited'
      c.Status = 'Exited (0) Less than a second ago'
      break
    case 'restart':
      c.State = 'running'
      c.Status = 'Up Less than a second'
      break
    case 'kill':
      c.State = 'exited'
      c.Status = 'Exited (137) Less than a second ago'
      break
    case 'pause':
      c.State = 'paused'
      c.Status = 'Up (Paused)'
      break
    case 'unpause':
      c.State = 'running'
      c.Status = 'Up Less than a second'
      break
  }
}

export function demoRemoveContainer(id: string) {
  demoState.containers = demoState.containers.filter((c) => c.Id !== id)
}

export function demoCreateContainer(name: string, image: string) {
  demoState.containers.unshift({
    Id: uid('c'),
    Names: [`/${name}`],
    Image: image,
    ImageID: 'sha256:new...image',
    Command: '',
    Created: now,
    Ports: [],
    State: 'created',
    Status: 'Created Less than a second ago',
    Labels: { 'io.portainer.mobile': 'true' },
    NetworkMode: 'bridge',
    Networks: ['bridge'],
    IPs: [],
    RestartPolicy: 'no',
    Platform: 'linux/amd64',
  })
}

export function demoDanglingImages(): Image[] {
  return demoState.images.filter((i) => !i.RepoTags || i.RepoTags.length === 0 || i.RepoTags.includes('<none>:<none>'))
}

export function demoPruneImages(): { deleted: number; reclaimed: number } {
  const dangling = demoDanglingImages()
  const reclaimed = dangling.reduce((s, i) => s + (i.Size || 0), 0)
  const ids = new Set(dangling.map((i) => i.Id))
  demoState.images = demoState.images.filter((i) => !ids.has(i.Id))
  return { deleted: dangling.length, reclaimed }
}

export function demoPullImage(name: string) {
  demoState.images.unshift({
    Id: uid('img'),
    RepoTags: [name],
    Created: now,
    Size: mb(Math.floor(20 + Math.random() * 400)),
    Containers: 0,
    Architecture: 'amd64',
    Os: 'linux',
  })
}

export function demoRemoveImage(id: string) {
  demoState.images = demoState.images.filter((i) => i.Id !== id)
}

export function demoRemoveNetwork(id: string) {
  demoState.networks = demoState.networks.filter((n) => n.Id !== id)
}

export function demoRemoveVolume(name: string) {
  demoState.volumes = demoState.volumes.filter((v) => v.Name !== name)
}

export function demoDeployStack(name: string, file: string, env: { name: string; value: string }[] = []) {
  demoState.stacks.unshift({
    Id: demoState.stacks.length + 100,
    Name: name,
    Type: 2,
    EndpointId: 1,
    Status: 1,
    CreationDate: now,
    CreatedBy: 'admin',
    EntryPoint: 'docker-compose.yml',
    File: file,
    Env: env,
  })
}

export function demoRemoveStack(id: number) {
  demoState.stacks = demoState.stacks.filter((s) => s.Id !== id)
}

export function demoAddEndpoint(name: string, url: string) {
  demoState.endpoints.push({
    Id: demoState.endpoints.length + 1,
    Name: name,
    Type: 4,
    URL: url,
    PublicURL: url,
    GroupId: 1,
    Status: 1,
    Snapshot: {
      DockerVersion: '27.3.1',
      TotalCPU: 2,
      TotalMemory: gb(4),
      RunningContainerCount: 0,
      StoppedContainerCount: 0,
      ImageCount: 0,
      VolumeCount: 0,
      ServiceCount: 0,
      StackCount: 0,
      NodeCount: 1,
    },
  })
}

export function demoAddUser(username: string, role: number) {
  demoState.users.push({
    Id: demoState.users.length + 1,
    Username: username,
    Role: role,
    AuthenticationMethod: 1,
    EndpointAuthorizations: { '1': role },
  })
}

export function demoRemoveUser(id: number) {
  demoState.users = demoState.users.filter((u) => u.Id !== id)
}

export function demoAddTeam(name: string) {
  demoState.teams.push({ Id: demoState.teams.length + 1, Name: name })
}

export function demoRemoveTeam(id: number) {
  demoState.teams = demoState.teams.filter((t) => t.Id !== id)
}
