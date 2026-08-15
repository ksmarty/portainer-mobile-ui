import { useApp } from '../store'
import { IconBox, IconHome, IconNetwork, IconSettings, IconStack } from './Icons'

const tabs = [
  { name: 'home', title: 'Dashboard', label: 'Home', icon: IconHome },
  { name: 'containers', title: 'Containers', label: 'Containers', icon: IconBox },
  { name: 'stacks', title: 'Stacks', label: 'Stacks', icon: IconStack },
  { name: 'networks', title: 'Networks', label: 'Networks', icon: IconNetwork },
  { name: 'settings', title: 'Settings', label: 'Settings', icon: IconSettings },
]

// Map every screen to the tab that should appear active for it.
const tabOf: Record<string, string> = {
  home: 'home',
  containers: 'containers',
  'container-detail': 'containers',
  'container-logs': 'containers',
  'container-stats': 'containers',
  'create-container': 'containers',
  images: 'containers',
  stacks: 'stacks',
  'stack-detail': 'stacks',
  'stack-edit': 'stacks',
  'stack-file': 'stacks',
  'deploy-stack': 'stacks',
  networks: 'networks',
  settings: 'settings',
  'schema-settings': 'settings',
}

export function TabBar() {
  const screen = useApp((s) => s.screen)
  const navigate = useApp((s) => s.navigate)
  const ready = useApp((s) => s.ready)

  if (!ready) return null

  const active = tabOf[screen.name] || 'home'

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
