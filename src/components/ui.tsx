import type { ReactNode } from 'react'
import { IconChevronRight } from './Icons'

export function Skeleton({ h = 60, r = 16, style }: { h?: number; r?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height: h, borderRadius: r, ...style }} />
}

export function Empty({ icon, title, sub }: { icon?: ReactNode; title: string; sub?: string }) {
  return (
    <div className="empty">
      {icon}
      <div style={{ fontWeight: 650, color: 'var(--text-dim)', fontSize: 15 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export function SectionTitle({ children, link, onLink }: { children: ReactNode; link?: string; onLink?: () => void }) {
  return (
    <div className="section-title">
      <span>{children}</span>
      {link && (
        <button className="link" onClick={onLink}>
          {link}
        </button>
      )}
    </div>
  )
}

export function ListItem({
  icon,
  title,
  sub,
  right,
  onClick,
  danger,
  style,
}: {
  icon?: ReactNode
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  onClick?: () => void
  danger?: boolean
  style?: React.CSSProperties
}) {
  const content = (
    <>
      {icon && <div className="item-icon">{icon}</div>}
      <div className="item-main">
        <div className="item-title">{title}</div>
        {sub && <div className="item-sub">{sub}</div>}
      </div>
      {right}
      {onClick && (
        <span className="chev">
          <IconChevronRight size={18} />
        </span>
      )}
    </>
  )

  return (
    <div
      className={`list-item ${danger ? 'danger' : ''}`}
      style={style}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {content}
    </div>
  )
}

export function Pill({ color, children, dot = true }: { color: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className="pill" style={{ color, background: `${color}1f` }}>
      {dot && <span className="dot" />}
      {children}
    </span>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>
}

export function Ring({
  value,
  size = 88,
  stroke = 8,
  color = 'var(--accent)',
  label,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  label?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          strokeLinecap="round"
        />
      </svg>
      <div className="pct">{label ?? `${Math.round(pct)}%`}</div>
    </div>
  )
}

export function KV({ k, v, mono = false }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className={`v ${mono ? 'mono' : ''}`}>{v}</span>
    </div>
  )
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <style>{`.spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  )
}
