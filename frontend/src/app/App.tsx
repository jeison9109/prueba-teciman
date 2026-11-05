import { useHealth, type HealthState } from './useHealth'

function describe(state: HealthState): { label: string; tone: 'ok' | 'error' | 'pending' } {
  switch (state.kind) {
    case 'loading':
      return { label: 'Comprobando…', tone: 'pending' }
    case 'unreachable':
      return { label: state.message, tone: 'error' }
    case 'ready':
      if (state.health.status === 'ok') return { label: 'API y base de datos operativas', tone: 'ok' }
      if (state.health.database === 'ok') return { label: 'Base de datos sin migraciones aplicadas', tone: 'error' }
      return { label: 'La API no puede conectar con la base de datos', tone: 'error' }
  }
}

export function App() {
  const { state, reload } = useHealth()
  const { label, tone } = describe(state)
  const migration = state.kind === 'ready' ? state.health.migration : null

  return (
    <main className="layout">
      <header>
        <h1>Mantenimiento correctivo</h1>
        <p>Base ejecutable. Las pantallas de máquinas, personas y averías llegan en las siguientes fases.</p>
      </header>
      <section className="card" aria-labelledby="health-title">
        <h2 id="health-title">Estado del sistema</h2>
        <p role="status" className={`status status--${tone}`}>
          {label}
        </p>
        <dl>
          <dt>Revisión del esquema</dt>
          <dd>{migration ?? '—'}</dd>
        </dl>
        <button type="button" onClick={reload} disabled={state.kind === 'loading'}>
          Volver a comprobar
        </button>
      </section>
    </main>
  )
}
