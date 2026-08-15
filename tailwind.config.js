/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0f14',
        surface: '#131a22',
        surface2: '#1b2430',
        surface3: '#232f3e',
        edge: '#263240',
        'edge-soft': '#1d2733',
        accent: '#2f9bff',
        'accent-2': '#1b6fce',
        ink: '#e7edf3',
        muted: '#8b98a5',
        ok: '#22c55e',
        warn: '#f59e0b',
        danger: '#ef4444',
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px rgba(47,155,255,0.35), 0 8px 30px -10px rgba(47,155,255,0.45)',
      },
    },
  },
  plugins: [],
}
