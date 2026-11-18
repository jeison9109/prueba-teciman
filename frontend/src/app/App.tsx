import { useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes } from 'react-router'
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
import { Empty, ErrorMessage, Loading } from '../shared/components/AsyncStatus'
import { Icon, type IconName } from '../shared/components/Icon'
import { ActorProvider, useActor } from './ActorContext'
import { ActorSelector } from './ActorSelector'
import { SettingsProvider } from './SettingsContext'
import { SetupPage } from './SetupPage'
import { SystemStatusPage } from './SystemStatusPage'

function NotFound() {
  return (
    <Empty icon="search" action={<Link className="button" to="/averias">Ir a averías</Link>}>
      Página no encontrada
    </Empty>
  )
}

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
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function ModeNotice() {
  const { state, actor, isManager } = useActor()
  if (isManager || state.kind !== 'ready' || state.data.totalPeople === 0) return null
  return (
    <p className="mode-notice" role="note">
      <Icon name="info" />
      <span>
        {actor
          ? 'Tu rol permite registrar averías y, si eres técnico, trabajar las tuyas. Máquinas y personas solo se consultan.'
          : 'Modo consulta. Elige una persona activa para registrar o gestionar averías.'}
      </span>
    </p>
  )
}

const NAV_GROUPS: { label: string; items: { to: string; label: string; icon: IconName }[] }[] = [
  {
    label: 'Operación',
    items: [
      { to: '/averias', label: 'Averías', icon: 'wrench' },
      { to: '/historico', label: 'Histórico', icon: 'book' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { to: '/maquinas', label: 'Máquinas', icon: 'factory' },
      { to: '/personas', label: 'Personas', icon: 'users' },
    ],
  },
  {
    label: 'Sistema',
    items: [{ to: '/estado', label: 'Estado', icon: 'activity' }],
  },
]

function Sidebar() {
  const [open, setOpen] = useState(false)
  const close = () => {
    setOpen(false)
  }
  return (
    <header className={`sidebar${open ? ' sidebar--open' : ''}`}>
      <div className="sidebar__top">
        <Link to="/averias" className="brand" onClick={close}>
          <span className="brand__logo">
            <Icon name="wrench" size={18} />
          </span>
          <span className="brand__text">
            <strong>Mantenimiento</strong>
            <small>correctivo</small>
          </span>
        </Link>
        <button
          type="button"
          className="icon-button sidebar__toggle"
          aria-expanded={open}
          aria-controls="sidebar-panel"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => {
            setOpen((value) => !value)
          }}
        >
          <Icon name={open ? 'close' : 'menu'} size={20} />
        </button>
      </div>
      <div className="sidebar__panel" id="sidebar-panel">
        <nav aria-label="Principal" className="nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="nav__group">
              <span className="nav__label" aria-hidden="true">
                {group.label}
              </span>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} className="nav__link" onClick={close}>
                  <Icon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <ActorSelector />
      </div>
    </header>
  )
}

/** Composición global. El router lo aporta `main.tsx` (o la prueba). */
export function App() {
  return (
    <SettingsProvider>
      <ActorProvider>
        <div className="shell">
          <a className="skip-link" href="#contenido">
            Saltar al contenido
          </a>
          <Sidebar />
          <main className="layout" id="contenido" tabIndex={-1}>
            <ModeNotice />
            <Content />
          </main>
        </div>
      </ActorProvider>
    </SettingsProvider>
  )
}
