import { NavLink, Navigate, Route, Routes } from 'react-router'
import { MachineCreatePage } from '../features/machines/MachineCreatePage'
import { MachineDetailPage } from '../features/machines/MachineDetailPage'
import { MachineListPage } from '../features/machines/MachineListPage'
import { PeopleListPage } from '../features/people/PeopleListPage'
import { PersonCreatePage } from '../features/people/PersonCreatePage'
import { PersonDetailPage } from '../features/people/PersonDetailPage'
import { ErrorMessage, Loading } from '../shared/components/AsyncStatus'
import { ActorProvider, useActor } from './ActorContext'
import { ActorSelector } from './ActorSelector'
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
      <Route path="/" element={<Navigate to="/maquinas" replace />} />
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
        ? 'Tu rol solo permite consultar máquinas y personas.'
        : 'Modo consulta. Elige una persona activa responsable para hacer cambios.'}
    </p>
  )
}

/** Composición global. El router lo aporta `main.tsx` (o la prueba). */
export function App() {
  return (
    <ActorProvider>
      <header className="topbar">
        <strong className="brand">Mantenimiento correctivo</strong>
        <nav aria-label="Principal">
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
  )
}
