import { IconBox } from '../components/Icons'

export function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 18,
          background: 'linear-gradient(135deg, var(--accent), var(--purple))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 16px 40px rgba(61,123,253,0.35)',
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
      >
        <IconBox size={30} />
      </div>
      <div style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Loading Portainer…</div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}`}</style>
    </div>
  )
}
