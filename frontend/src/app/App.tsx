import { NavLink, Navigate, Route, Routes } from 'react-router'
import { HistoryPage } from '../features/history/HistoryPage'
import { IncidentCreatePage } from '../features/incidents/IncidentCreatePage'
import { IncidentDetailPage } from '../features/incidents/IncidentDetailPage'
import { IncidentListPage } from '../features/incidents/IncidentListPage'
import { MachineCreatePage } from '../features/machines/MachineCreatePage'
import { MachineDetailPage } from '../features/machines/MachineDetailPage'
import { MachineListPage } from '../features/machines/MachineListPage'
import { PeopleListPage } from '../features/people/PeopleListPage'
import { PersonCreatePage } from '../features/people/PersonCreatePage'
import { PersonDetailPage } from '../features/people/PersonDetailPage'
import { ErrorMessage, Loading } from '../shared/components/AsyncStatus'
import { ActorProvider, useActor } from './ActorContext'
import { ActorSelector } from './ActorSelector'
import { SettingsProvider } from './SettingsContext'
import { SetupPage } from './SetupPage'
import { SystemStatusPage } from './SystemStatusPage'

function Content() {
  const { state, refresh } = useActor()
  if (state.kind === 'loading') return <Loading />
  if (state.kind === 'error') {
    return (
      <>
        <ErrorMessage message={state.message} onRetry={refresh} />
        <SystemStatusPage />
      </>
    )
  }
  if (state.data.totalPeople === 0) return <SetupPage />
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/averias" replace />} />
      <Route path="/averias" element={<IncidentListPage />} />
      <Route path="/averias/nueva" element={<IncidentCreatePage />} />
      <Route path="/averias/:id" element={<IncidentDetailPage />} />
      <Route path="/historico" element={<HistoryPage />} />
      <Route path="/maquinas" element={<MachineListPage />} />
      <Route path="/maquinas/nueva" element={<MachineCreatePage />} />
      <Route path="/maquinas/:id" element={<MachineDetailPage />} />
      <Route path="/personas" element={<PeopleListPage />} />
      <Route path="/personas/nueva" element={<PersonCreatePage />} />
      <Route path="/personas/:id" element={<PersonDetailPage />} />
      <Route path="/estado" element={<SystemStatusPage />} />
      <Route path="*" element={<ErrorMessage message="Página no encontrada" />} />
    </Routes>
  )
}

function ModeNotice() {
  const { state, actor, isManager } = useActor()
  if (isManager || state.kind !== 'ready' || state.data.totalPeople === 0) return null
  return (
    <p className="mode-notice" role="note">
      {actor
        ? 'Tu rol permite registrar averías y, si eres técnico, trabajar las tuyas. Máquinas y personas solo se consultan.'
        : 'Modo consulta. Elige una persona activa para registrar o gestionar averías.'}
    </p>
  )
}

/** Composición global. El router lo aporta `main.tsx` (o la prueba). */
export function App() {
  return (
    <SettingsProvider>
      <ActorProvider>
        <header className="topbar">
          <strong className="brand">Mantenimiento correctivo</strong>
          <nav aria-label="Principal">
            <NavLink to="/averias">Averías</NavLink>
            <NavLink to="/historico">Histórico</NavLink>
            <NavLink to="/maquinas">Máquinas</NavLink>
            <NavLink to="/personas">Personas</NavLink>
            <NavLink to="/estado">Estado</NavLink>
          </nav>
          <ActorSelector />
        </header>
        <main className="layout">
          <ModeNotice />
          <Content />
        </main>
      </ActorProvider>
    </SettingsProvider>
  )
}
