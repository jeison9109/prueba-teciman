import { Icon, type IconName } from '../shared/components/Icon'
import { PageHeader } from '../shared/components/PageHeader'
import { useHealth, type HealthState } from './useHealth'

const ICONS: Record<'ok' | 'error' | 'pending', IconName> = {
  ok: 'checkCircle',
  error: 'alert',
  pending: 'clock',
}

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

export function SystemStatusPage() {
  const { state, reload } = useHealth()
  const { label, tone } = describe(state)
  const migration = state.kind === 'ready' ? state.health.migration : null

  return (
    <section className="stack" aria-labelledby="health-title">
      <PageHeader
        titleId="health-title"
        title="Estado del sistema"
        description="Conexión de la interfaz con la API y la base de datos."
      />
      <div className="card stack">
        <p role="status" className={`status status--${tone}`}>
          <Icon name={ICONS[tone]} />
          {label}
        </p>
        <dl className="details">
          <dt>Revisión del esquema</dt>
          <dd className="mono">{migration ?? '—'}</dd>
        </dl>
        <div className="actions">
          <button type="button" onClick={reload} disabled={state.kind === 'loading'}>
            <Icon name="refresh" size={16} />
            Volver a comprobar
          </button>
        </div>
      </div>
    </section>
  )
}
