import { useApp } from '../store'
import { IconBox, IconHome, IconNetwork, IconSettings, IconStack } from './Icons'

const tabs = [
  { name: 'home', title: 'Dashboard', label: 'Home', icon: IconHome },
  { name: 'containers', title: 'Containers', label: 'Containers', icon: IconBox },
  { name: 'stacks', title: 'Stacks', label: 'Stacks', icon: IconStack },
  { name: 'networks', title: 'Networks', label: 'Networks', icon: IconNetwork },
  { name: 'settings', title: 'Settings', label: 'Settings', icon: IconSettings },
]

export function TabBar() {
  const screen = useApp((s) => s.screen)
  const navigate = useApp((s) => s.navigate)
  const ready = useApp((s) => s.ready)

  if (!ready) return null

  const active = tabs.find((t) => t.name === screen.name)?.name || 'home'

  return (
    <nav className="tabbar">
      <div className="tabbar-inner">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.name}
              className={`tab ${active === t.name ? 'active' : ''}`}
              onClick={() => navigate({ name: t.name, title: t.title })}
            >
              <Icon size={22} strokeWidth={active === t.name ? 2.1 : 1.8} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
