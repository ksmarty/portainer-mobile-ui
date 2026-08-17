import { useEffect, useRef } from 'react'
import { useApp } from './store'
import { TopBar } from './components/TopBar'
import { TabBar } from './components/TabBar'
import { Toasts } from './components/Toasts'
import { HomeScreen } from './screens/Home'
import { ContainersScreen } from './screens/Containers'
import { ContainerDetailScreen } from './screens/ContainerDetail'
import { ContainerLogsScreen } from './screens/ContainerLogs'
import { ContainerStatsScreen } from './screens/ContainerStats'
import { CreateContainerScreen } from './screens/CreateContainer'
import { ImagesScreen, ImageActions } from './screens/Images'
import { StacksScreen } from './screens/Stacks'
import { StackDetailScreen } from './screens/StackDetail'
import { StackEditorScreen } from './screens/StackEditor'
import { VolumesScreen } from './screens/Volumes'
import { NetworksScreen } from './screens/Networks'
import { NetworkDetailScreen } from './screens/NetworkDetail'
import { EndpointsScreen } from './screens/Endpoints'
import { UsersScreen } from './screens/Users'
import { TeamsScreen } from './screens/Teams'
import { RegistriesScreen } from './screens/Registries'
import { SettingsScreen } from './screens/Settings'
import { SchemaSettingsScreen } from './screens/SchemaSettings'
import { ConnectScreen } from './screens/Connect'
import { LoginScreen } from './screens/Login'
import { LoadingScreen } from './screens/Loading'

export default function App() {
  const ready = useApp((s) => s.ready)
  const booting = useApp((s) => s.booting)
  const boot = useApp((s) => s.boot)
  const back = useApp((s) => s.back)
  const history = useApp((s) => s.history)
  const screen = useApp((s) => s.screen)
  const demo = useApp((s) => s.demo)
  const user = useApp((s) => s.user)
  const endpoints = useApp((s) => s.endpoints)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void boot()
  }, [boot])

  // Scroll to the top whenever the route changes (e.g. tapping a container in
  // a stack shouldn't inherit the stack page's scroll position).
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [screen.name])

  // Swipe right to go back (mobile): system gestures like iOS's edge swipe
  // close the tab instead, so handle it in-app. Ignored when the touch starts
  // on an interactive/scrollable element.
  useEffect(() => {
    let x0 = 0
    let y0 = 0
    let armed = false
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      x0 = t.clientX
      y0 = t.clientY
      const el = e.target as HTMLElement
      armed = !el.closest('button, a, input, textarea, select, [contenteditable], .chip-row, .segmented, .code-block, .editor-suggest')
    }
    const onEnd = (e: TouchEvent) => {
      if (!armed || history.length === 0) return
      const t = e.changedTouches[0]
      const dx = t.clientX - x0
      const dy = t.clientY - y0
      if (dx > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) back()
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [back, history.length])

  if (!ready || booting) return <LoadingScreen />

  const authed = demo || !!user || endpoints.length > 0
  const showTopBar = authed && screen.name !== 'login'

  return (
    <div className="app-shell">
      {showTopBar && (
        <TopBar back={screen.name !== 'home'} right={screen.name === 'images' ? <ImageActions /> : undefined} />
      )}
      <div className="app-scroll" ref={scrollRef}>
        <Router />
      </div>
      <TabBar />
      <Toasts />
    </div>
  )
}

function Router() {
  const screen = useApp((s) => s.screen)
  const demo = useApp((s) => s.demo)
  const user = useApp((s) => s.user)
  const endpoints = useApp((s) => s.endpoints)

  const authed = demo || !!user || endpoints.length > 0

  if (!authed) return <ConnectScreen />

  switch (screen.name) {
    case 'home':
      return <HomeScreen />
    case 'containers':
      return <ContainersScreen />
    case 'container-detail':
      return <ContainerDetailScreen id={screen.props?.id} />
    case 'container-logs':
      return <ContainerLogsScreen id={screen.props?.id} />
    case 'container-stats':
      return <ContainerStatsScreen id={screen.props?.id} />
    case 'create-container':
      return <CreateContainerScreen />
    case 'images':
      return <ImagesScreen />
    case 'stacks':
      return <StacksScreen />
    case 'stack-detail':
      return <StackDetailScreen id={screen.props?.id} />
    case 'stack-file':
      return <StackDetailScreen id={screen.props?.id} fileOverride={screen.props?.file} />
    case 'deploy-stack':
      return <StackEditorScreen />
    case 'stack-edit':
      return <StackEditorScreen stackId={screen.props?.id} />
    case 'volumes':
      return <VolumesScreen />
    case 'networks':
      return <NetworksScreen />
    case 'network-detail':
      return <NetworkDetailScreen id={screen.props?.id} />
    case 'endpoints':
      return <EndpointsScreen />
    case 'users':
      return <UsersScreen />
    case 'teams':
      return <TeamsScreen />
    case 'registries':
      return <RegistriesScreen />
    case 'settings':
      return <SettingsScreen />
    case 'schema-settings':
      return <SchemaSettingsScreen />
    case 'connect':
      return <ConnectScreen />
    case 'login':
      return <LoginScreen />
    default:
      return <HomeScreen />
  }
}
