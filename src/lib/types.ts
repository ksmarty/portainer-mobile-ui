export interface PortMapping {
  IP?: string
  PrivatePort: number
  PublicPort?: number
  Type: string
}

export interface ContainerMount {
  Type: string
  Name?: string
  Source: string
  Destination: string
  Driver?: string
  Mode?: string
  RW?: boolean
}

export interface Container {
  Id: string
  Names: string[]
  Image: string
  ImageID: string
  Command: string
  Created: number
  Ports: PortMapping[]
  State: string
  Status: string
  Labels?: Record<string, string>
  Mounts?: ContainerMount[]
  NetworkMode?: string
  Networks?: string[]
  IPs?: string[]
  RestartPolicy?: string
  Platform?: string
}

export interface Image {
  Id: string
  RepoTags?: string[]
  RepoDigests?: string[]
  Created: number
  Size: number
  Labels?: Record<string, string>
  Containers: number
  DockerVersion?: string
  Architecture?: string
  Os?: string
}

export interface ImageInfo {
  Id: string
  RepoTags: string[]
  RepoDigests: string[]
  Created: number
  Size: number
  Architecture?: string
  Os?: string
  DockerVersion?: string
  Author?: string
  Labels?: Record<string, string>
  Env?: string[]
  ExposedPorts?: string[]
}

export interface Network {
  Id: string
  Name: string
  Driver: string
  Scope: string
  Internal: boolean
  Attachable: boolean
  Created: number
  Containers: { Id: string; Name: string; IPv4: string }[]
}

export interface NetworkDetail {
  Id: string
  Name: string
  Driver: string
  Scope: string
  Internal: boolean
  Attachable: boolean
  EnableIPv6: boolean
  IPAM: { Driver?: string; Config: { Subnet?: string; Gateway?: string; IPRange?: string }[] }
  Options: Record<string, string>
  Labels: Record<string, string>
  Created: number
  Containers: { Id: string; Name: string; IPv4: string }[]
}

export interface Volume {
  Name: string
  Driver: string
  Mountpoint: string
  CreatedAt?: string
  Labels?: Record<string, string>
  Size?: number
  RefCount?: number
}

export interface Stack {
  Id: number
  Name: string
  Type: number
  EndpointId: number
  Status: number
  CreationDate: number
  CreatedBy: string
  EntryPoint?: string
  Env?: { name: string; value: string }[]
  File?: string
}

export interface Endpoint {
  Id: number
  Name: string
  Type: number
  URL: string
  PublicURL?: string
  GroupId: number
  Status: number
  Snapshot?: {
    DockerVersion: string
    TotalCPU: number
    TotalMemory: number
    RunningContainerCount: number
    StoppedContainerCount: number
    ImageCount: number
    VolumeCount: number
    ServiceCount: number
    StackCount: number
    NodeCount: number
  }
  TLSConfig?: { TLS: boolean }
  EdgeKey?: string
  UserTrusted?: boolean
}

export interface User {
  Id: number
  Username: string
  Role: number
  AuthenticationMethod?: number
  ThemeSettings?: any
  EndpointAuthorizations?: Record<string, number>
}

export interface Team {
  Id: number
  Name: string
}

export interface Registry {
  Id: number
  Name: string
  Type: number
  URL: string
  Authentication: boolean
  Username?: string
}

export interface Settings {
  LogoURL: string
  BlackListedLabels: any[]
  AuthenticationMethod: number
  AllowBindMountsForRegularUsers: boolean
  AllowPrivilegedModeForRegularUsers: boolean
  EnableTelemetry: boolean
  SnapshotInterval: string
  TemplatesURL: string
  EnableEdgeComputeFeatures: boolean
  [key: string]: any
}

export interface LogLine {
  id: string
  text: string
  stream: 'stdout' | 'stderr' | 'system'
}

export interface Stats {
  cpuPercent: number
  memPercent: number
  memUsage: number
  memLimit: number
  netRx: number
  netTx: number
  blockRead: number
  blockWrite: number
  pids: number
}

export interface DashboardStats {
  endpoints: number
  stacks: number
  containersRunning: number
  containersStopped: number
  images: number
  volumes: number
  networks: number
  cpu: number
  memory: number
  memoryUsed: number
  memoryTotal: number
}
