import { useEffect } from 'react'
import { useApp } from '../store'
import { IconDrive } from '../components/Icons'
import { Empty, SectionTitle, Skeleton } from '../components/ui'
import { bytes, groupByDisk } from '../lib/utils'
import type { DiskGroup, HostDevice, HostMount, HostStorage } from '../lib/types'

// Colour a system by how full it is: comfortable, getting tight, or nearly full.
function usageColor(pct: number): string {
  if (pct >= 90) return 'var(--red)'
  if (pct >= 75) return 'var(--amber)'
  return 'var(--green)'
}

/**
 * One row of the screen: either a physical disk (with every filesystem mounted
 * from it, and the unmounted space it still has) or a device-less grouping such
 * as tmpfs.
 */
interface DriveEntry {
  key: string
  /** Kernel device name when the entry maps to a real disk. */
  device: HostDevice | null
  group: DiskGroup
}

/**
 * Join the two lists the entrypoint reports: `devices` (every block device, from
 * /sys) and `mounts` (every filesystem, from df). The union is what makes the
 * screen complete — a disk nobody has mounted yet only exists in `devices`, and
 * a mount on a device sysfs cannot map only exists in `mounts`.
 */
function buildEntries(storage: HostStorage | null): { disks: DriveEntry[]; virtual: DiskGroup[] } {
  const groups = groupByDisk(storage?.mounts ?? [])
  const devices = storage?.devices ?? []
  const disks: DriveEntry[] = []
  const used = new Set<DiskGroup>()

  for (const dev of devices) {
    // A group belongs to a disk when its mount reports it, or when the disk is
    // one member of a multi-disk array (`sda+sdb`).
    const group = groups.find((g) => !used.has(g) && g.mounts.some((m) => m.disk.split('+').includes(dev.name)))
    if (!group) {
      // No filesystem anywhere on it: report its raw capacity, which is exactly
      // the "spare drive" case that was missing before.
      disks.push({
        key: dev.name,
        device: dev,
        group: {
          id: dev.name,
          mounts: [],
          totalBytes: dev.sizeBytes,
          usedBytes: 0,
          availBytes: dev.sizeBytes,
          usedPercent: 0,
        },
      })
      continue
    }
    used.add(group)
    disks.push({ key: group.id, device: dev, group })
  }

  // Groups backed by a device sysfs did not list (a device-mapper root on a
  // host where /sys is partial) still deserve a card.
  for (const g of groups) {
    if (used.has(g)) continue
    const hasDevice = g.mounts.some((m) => !!m.disk)
    if (!hasDevice) continue
    disks.push({ key: g.id, device: null, group: g })
  }

  const virtual = groups.filter((g) => !disks.some((d) => d.group === g))
  return { disks, virtual }
}

export function DrivesScreen() {
  const storage = useApp((s) => s.storage)
  const storageLoading = useApp((s) => s.storageLoading)
  const refreshStorage = useApp((s) => s.refreshStorage)
  const diskUsage = useApp((s) => s.diskUsage)
  const loadDiskUsage = useApp((s) => s.loadDiskUsage)
  const demo = useApp((s) => s.demo)

  useEffect(() => {
    void refreshStorage()
    void loadDiskUsage()
    // The snapshot is regenerated every 15s by the container entrypoint; polling
    // at the same cadence keeps a long-open screen from going stale.
    const timer = window.setInterval(() => void refreshStorage(), 15000)
    return () => window.clearInterval(timer)
  }, [refreshStorage, loadDiskUsage])

  const { disks, virtual } = buildEntries(storage)
  const totalCapacity = disks.reduce((s, d) => s + d.group.totalBytes, 0)
  const totalUsed = disks.reduce((s, d) => s + d.group.usedBytes, 0)
  const unmounted = disks.filter((d) => d.group.mounts.length === 0).length

  return (
    <div className="page">
      {storage && (
        <div
          className="card"
          style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>Host</div>
            <div className="mono" style={{ fontSize: 12.5, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {storage.host || 'unknown'}
            </div>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>
              {disks.length} {disks.length === 1 ? 'disk' : 'disks'}
            </div>
            <div style={{ fontSize: 12.5, marginTop: 1 }}>{bytes(totalCapacity)} total</div>
          </div>
        </div>
      )}

      <SectionTitle
        link={storageLoading ? undefined : 'Refresh'}
        onLink={() => {
          void refreshStorage()
          void loadDiskUsage()
        }}
      >
        Drives & partitions
      </SectionTitle>

      {!storage && storageLoading && (
        <div className="card-list">
          <Skeleton h={112} />
          <Skeleton h={112} />
        </div>
      )}

      {!storage && !storageLoading && (
        <Empty
          icon={<IconDrive size={36} />}
          title="No disk data"
          sub="The host disk snapshot isn't available. It is generated by the container's entrypoint on a host with access to df."
        />
      )}

      {storage && !disks.length && !virtual.length && (
        <Empty icon={<IconDrive size={36} />} title="No filesystems reported" />
      )}

      {disks.length > 0 && (
        <div className="card-list">
          {disks.map((d) => (
            <DiskCard key={d.key} device={d.device} group={d.group} />
          ))}
        </div>
      )}

      {virtual.length > 0 && (
        <>
          <SectionTitle>Virtual filesystems</SectionTitle>
          <div className="card-list">
            {virtual.map((g) => (
              <DiskCard key={g.id} group={g} virtual />
            ))}
          </div>
        </>
      )}

      {diskUsage && (
        <>
          <SectionTitle>Docker storage</SectionTitle>
          <div className="card">
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 8 }}>
              {bytes(diskUsage.totalSize)} total · {bytes(diskUsage.totalReclaimable)} reclaimable
            </div>
            <DockerRow label="Images" size={diskUsage.imagesSize} reclaimable={diskUsage.imagesReclaimable} total={diskUsage.totalSize} color="var(--blue)" />
            <DockerRow label="Containers" size={diskUsage.containersSize} reclaimable={0} total={diskUsage.totalSize} color="var(--green)" />
            <DockerRow label="Volumes" size={diskUsage.volumesSize} reclaimable={diskUsage.volumesReclaimable} total={diskUsage.totalSize} color="var(--purple)" />
            <DockerRow label="Build cache" size={diskUsage.buildCacheSize} reclaimable={diskUsage.buildCacheReclaimable} total={diskUsage.totalSize} color="var(--amber)" />
          </div>
        </>
      )}

      {!demo && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', margin: '12px 2px 0', lineHeight: 1.5 }}>
          Usage is read from the host running this app (and Portainer): every mounted filesystem through
          <span className="mono"> df</span>, plus every attached disk through
          <span className="mono"> /sys/class/block</span> — which is how a drive with nothing mounted from it still
          appears here. {unmounted > 0 && `${unmounted} disk${unmounted === 1 ? ' has' : 's have'} no filesystem mounted. `}
          Partitions, LVM volumes and RAID members are grouped under the physical disk they live on. Docker storage is
          summed from the active endpoint's images, containers, volumes and build cache.
        </div>
      )}
    </div>
  )
}

function DiskCard({ group, device, virtual }: { group: DiskGroup; device?: HostDevice | null; virtual?: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(100, group.usedPercent)))
  const color = usageColor(pct)
  const root = group.mounts.find((m) => m.mountpoint === '/')
  const mounted = group.mounts.length > 0
  const label = device?.name || group.id
  const free = Math.max(0, group.totalBytes - group.usedBytes)
  const inUse = group.usedBytes > 0

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <IconDrive size={16} style={{ color, flex: 'none' }} />
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
          {root && (
            <span className="chip" style={{ padding: '1px 6px' }}>
              main
            </span>
          )}
          {!mounted && !virtual && (
            <span className="chip" style={{ padding: '1px 6px', color: 'var(--amber)', borderColor: 'var(--amber)' }}>
              unmounted
            </span>
          )}
          {virtual && (
            <span className="chip" style={{ padding: '1px 6px', opacity: 0.75 }}>
              virtual
            </span>
          )}
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, color, flex: 'none' }}>
          {mounted || inUse ? `${pct}%` : bytes(group.totalBytes)}
        </span>
      </div>

      {device?.model && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {device.model} · {device.rotational ? 'HDD' : 'SSD'}
        </div>
      )}

      <div className="bar" style={{ marginTop: 8 }}>
        <div style={{ width: `${mounted ? pct : 0}%`, background: color }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginTop: 7 }}>
        <span style={{ color: 'var(--text-dim)' }}>
          {mounted ? `${bytes(group.usedBytes)} used of ${bytes(group.totalBytes)}` : `${bytes(group.totalBytes)} capacity`}
        </span>
        <span style={{ color: 'var(--text-faint)' }}>{bytes(free)} free</span>
      </div>

      {/* The individual filesystems on this disk, so a LVM root and its /boot
          are still identifiable without their capacities fighting for space. */}
      {group.mounts.length > 1 && (
        <div style={{ marginTop: 9, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {group.mounts.map((m) => (
            <SubMount key={m.filesystem + m.mountpoint} mount={m} />
          ))}
        </div>
      )}
    </div>
  )
}

function SubMount({ mount }: { mount: HostMount }) {
  const pct = Math.round(Math.max(0, Math.min(100, mount.usedPercent)))
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '3px 0' }}>
      <span
        className="mono"
        style={{ fontSize: 11.5, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {mount.mountpoint}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-faint)', flex: 'none' }}>
        {bytes(mount.usedBytes)} / {bytes(mount.totalBytes)} · {pct}%
      </span>
    </div>
  )
}

function DockerRow({
  label,
  size,
  reclaimable,
  total,
  color,
}: {
  label: string
  size: number
  reclaimable: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (size / total) * 100)) : 0
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text-faint)' }}>
          {bytes(size)}
          {reclaimable > 0 ? ` · ${bytes(reclaimable)} reclaimable` : ''}
        </span>
      </div>
      <div className="bar">
        <div style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
