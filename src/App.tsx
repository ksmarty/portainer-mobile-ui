import { useEffect } from 'react'
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
import { ImagesScreen } from './screens/Images'
import { StacksScreen } from './screens/Stacks'
import { StackDetailScreen } from './screens/StackDetail'
import { StackEditorScreen } from './screens/StackEditor'
import { VolumesScreen } from './screens/Volumes'
import { NetworksScreen } from './screens/Networks'
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

  useEffect(() => {
    void boot()
  }, [boot])

  if (!ready || booting) return <LoadingScreen />

  return (
    <div className="app-shell">
      <Router />
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

  if (!authed) {
    return <ConnectScreen />
  }

  switch (screen.name) {
    case 'home':
      return (
        <>
          <TopBar />
          <HomeScreen />
        </>
      )
    case 'containers':
      return (
        <>
          <TopBar back />
          <ContainersScreen />
        </>
      )
    case 'container-detail':
      return (
        <>
          <TopBar back />
          <ContainerDetailScreen id={screen.props?.id} />
        </>
      )
    case 'container-logs':
      return (
        <>
          <TopBar back />
          <ContainerLogsScreen id={screen.props?.id} />
        </>
      )
    case 'container-stats':
      return (
        <>
          <TopBar back />
          <ContainerStatsScreen id={screen.props?.id} />
        </>
      )
    case 'create-container':
      return (
        <>
          <TopBar back />
          <CreateContainerScreen />
        </>
      )
    case 'images':
      return (
        <>
          <TopBar back />
          <ImagesScreen />
        </>
      )
    case 'stacks':
      return (
        <>
          <TopBar back />
          <StacksScreen />
        </>
      )
    case 'stack-detail':
      return (
        <>
          <TopBar back />
          <StackDetailScreen id={screen.props?.id} />
        </>
      )
    case 'stack-file':
      return (
        <>
          <TopBar back />
          <StackDetailScreen id={screen.props?.id} fileOverride={screen.props?.file} />
        </>
      )
    case 'deploy-stack':
      return (
        <>
          <TopBar back />
          <StackEditorScreen />
        </>
      )
    case 'stack-edit':
      return (
        <>
          <TopBar back />
          <StackEditorScreen stackId={screen.props?.id} />
        </>
      )
    case 'volumes':
      return (
        <>
          <TopBar back />
          <VolumesScreen />
        </>
      )
    case 'networks':
      return (
        <>
          <TopBar back />
          <NetworksScreen />
        </>
      )
    case 'endpoints':
      return (
        <>
          <TopBar back />
          <EndpointsScreen />
        </>
      )
    case 'users':
      return (
        <>
          <TopBar back />
          <UsersScreen />
        </>
      )
    case 'teams':
      return (
        <>
          <TopBar back />
          <TeamsScreen />
        </>
      )
    case 'registries':
      return (
        <>
          <TopBar back />
          <RegistriesScreen />
        </>
      )
    case 'settings':
      return (
        <>
          <TopBar back />
          <SettingsScreen />
        </>
      )
    case 'schema-settings':
      return (
        <>
          <TopBar back />
          <SchemaSettingsScreen />
        </>
      )
    case 'connect':
      return (
        <>
          <TopBar back />
          <ConnectScreen />
        </>
      )
    case 'login':
      return <LoginScreen />
    default:
      return (
        <>
          <TopBar />
          <HomeScreen />
        </>
      )
  }
}
