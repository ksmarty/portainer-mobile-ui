import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { IconNetwork } from '../components/Icons'
import { Empty, KV, Pill, SectionTitle, Skeleton } from '../components/ui'
import { timeAgo } from '../lib/utils'
import { getNetworkInfo } from '../lib/api'
import type { NetworkDetail } from '../lib/types'

export function NetworkDetailScreen({ id }: { id: string }) {
  const ep = useApp((s) => s.activeEndpoint || s.endpoints[0]?.Id || 1)
  const [info, setInfo] = useState<NetworkDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    getNetworkInfo(ep, id)
      .then((d) => alive && setInfo(d))
      .catch((e) => alive && setError((e as Error).message))
    return () => {
      alive = false
    }
  }, [ep, id])

  if (error) return <div className="page"><div className="card" style={{ color: 'var(--danger)' }}>{error}</div></div>
  if (!info)
    return (
      <div className="page">
        <div className="card-list" style={{ marginTop: 8 }}>
          <Skeleton h={64} />
          <Skeleton h={64} />
          <Skeleton h={64} />
        </div>
      </div>
    )

  return (
    <div className="page">
      <div className="card" style={{ padding: 12, marginTop: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="item-icon" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
            <IconNetwork size={19} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, overflowWrap: 'anywhere' }}>{info.Name}</div>
            <div style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>{info.Driver} · {info.Scope}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <KV k="Driver" v={info.Driver} />
        <KV k="Scope" v={info.Scope} />
        <KV k="Created" v={timeAgo(info.Created)} />
        <KV k="Internal" v={info.Internal ? 'Yes' : 'No'} />
        <KV k="Attachable" v={info.Attachable ? 'Yes' : 'No'} />
        <KV k="IPv6" v={info.EnableIPv6 ? 'Enabled' : 'Disabled'} />
        {info.IPAM.Driver && <KV k="IPAM driver" v={info.IPAM.Driver} />}
        {info.IPAM.Config.map((c, i) => (
          <KV key={i} k={`Subnet ${i + 1}`} v={[c.Subnet, c.Gateway ? `gateway ${c.Gateway}` : '', c.IPRange ? `range ${c.IPRange}` : ''].filter(Boolean).join(' · ') || '—'} mono />
        ))}
      </div>

      {Object.keys(info.Labels).length > 0 && (
        <>
          <SectionTitle>Labels</SectionTitle>
          <div className="card">
            {Object.entries(info.Labels).map(([k, v]) => (
              <KV key={k} k={k} v={v} mono />
            ))}
          </div>
        </>
      )}

      <SectionTitle>Containers ({info.Containers.length})</SectionTitle>
      <div className="card-list">
        {info.Containers.map((c) => (
          <div key={c.Id} className="list-item">
            <div className="item-title" style={{ fontSize: 14 }}>{c.Name}</div>
            <div className="item-sub mono">{c.IPv4 || '—'}</div>
          </div>
        ))}
        {!info.Containers.length && <Empty icon={<IconNetwork size={36} />} title="No containers" sub="Nothing is attached to this network" />}
      </div>
    </div>
  )
}
