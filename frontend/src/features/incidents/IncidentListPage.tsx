import { Link } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { DEFAULT_PAGE_SIZE } from '../../shared/api/types'
import { Empty, ErrorMessage, Loading } from '../../shared/components/AsyncStatus'
import { SelectField } from '../../shared/components/Field'
import { Icon, type IconName } from '../../shared/components/Icon'
import { PageHeader } from '../../shared/components/PageHeader'
import { Pagination } from '../../shared/components/Pagination'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { useUrlFilters } from '../../shared/hooks/useUrlFilters'
import { optionsFrom } from '../../shared/utils/options'
import { useMachineOptions } from '../machines/useMachineOptions'
import { listIncidents } from './api'
import { IncidentTable } from './IncidentTable'
import { INCIDENT_STATUS_LABELS, PRIORITY_LABELS } from './labels'
import { useIncidentSummary, type IncidentSummary } from './useIncidentSummary'

const FILTERS = ['status', 'priority', 'machine_id'] as const

export function IncidentListPage() {
  const { actor } = useActor()
  const { filters, page, setFilter, setPage, clear } = useUrlFilters(FILTERS)
  const query = { ...filters, page, page_size: DEFAULT_PAGE_SIZE }
  const { state, reload } = useAsyncData(JSON.stringify(query), (signal) =>
    listIncidents(query, signal),
  )
  const machines = useMachineOptions({ includeRetired: true })
  const machineOptions = machines.state.kind === 'ready' ? machines.state.data : []
  const filtered = FILTERS.some((key) => filters[key])

  return (
    <section aria-labelledby="incidents-title">
      <PageHeader
        titleId="incidents-title"
        title="Averías"
        description="Bandeja de averías de la planta, de la detección al cierre validado."
        actions={
          actor && (
            <Link className="button button--primary" to="/averias/nueva">
              <Icon name="plus" />
              Registrar avería
            </Link>
          )
        }
      />

      <SummaryCards currentStatus={filters.status} />

      <form
        className="filters"
        role="search"
        aria-label="Filtrar averías"
        onSubmit={(event) => {
          event.preventDefault()
        }}
      >
        <SelectField
          label="Estado"
          value={filters.status}
          options={optionsFrom(INCIDENT_STATUS_LABELS)}
          onChange={(value) => {
            setFilter('status', value)
          }}
          emptyLabel="Todos"
        />
        <SelectField
          label="Prioridad"
          value={filters.priority}
          options={optionsFrom(PRIORITY_LABELS)}
          onChange={(value) => {
            setFilter('priority', value)
          }}
          emptyLabel="Todas"
        />
        <div className="filters__wide">
          <SelectField
            label="Máquina"
            value={filters.machine_id}
            options={machineOptions}
            onChange={(value) => {
              setFilter('machine_id', value)
            }}
            emptyLabel={machines.state.kind === 'loading' ? 'Cargando…' : 'Todas'}
          />
        </div>
        <div className="filters__actions">
          <button type="button" onClick={clear} disabled={!filtered}>
            Limpiar filtros
          </button>
        </div>
      </form>

      {state.kind === 'loading' && <Loading rows={6} />}
      {state.kind === 'error' && <ErrorMessage message={state.message} onRetry={reload} />}
      {state.kind === 'ready' && state.data.items.length === 0 && (
        <Empty
          icon={filtered ? 'search' : 'inbox'}
          action={
            filtered && (
              <button type="button" onClick={clear}>
                Limpiar filtros
              </button>
            )
          }
        >
          {filtered ? 'No hay averías con estos filtros.' : 'Todavía no hay averías registradas.'}
        </Empty>
      )}
      {state.kind === 'ready' && state.data.items.length > 0 && (
        <div className="stack">
          <p className="result-count">
            {state.data.total} {state.data.total === 1 ? 'avería' : 'averías'}
          </p>
          <IncidentTable incidents={state.data.items} />
          <Pagination
            page={state.data.page}
            pageSize={state.data.page_size}
            total={state.data.total}
            onChange={setPage}
          />
        </div>
      )}
    </section>
  )
}

interface SummaryCard {
  key: keyof IncidentSummary['byStatus'] | 'stopped'
  label: string
  hint: string
  icon: IconName
  tone: 'danger' | 'warning' | 'info' | 'ok'
}

const SUMMARY_CARDS: SummaryCard[] = [
  { key: 'abierta', label: 'Sin asignar', hint: 'Esperan técnico', icon: 'inbox', tone: 'danger' },
  { key: 'asignada', label: 'Asignadas', hint: 'Pendientes de iniciar', icon: 'user', tone: 'warning' },
  { key: 'en_curso', label: 'En curso', hint: 'Con trabajo activo', icon: 'wrench', tone: 'info' },
  { key: 'resuelta', label: 'Por validar', hint: 'Resueltas sin cerrar', icon: 'shield', tone: 'ok' },
  { key: 'stopped', label: 'Máquinas paradas', hint: 'Producción afectada', icon: 'pause', tone: 'danger' },
]

/** Resumen de la carga pendiente. Cada tarjeta filtra la bandeja (o lleva a las máquinas paradas). */
function SummaryCards({ currentStatus }: { currentStatus: string }) {
  const { state } = useIncidentSummary()
  // El resumen es orientativo: si falla, la bandeja sigue siendo utilizable sin él.
  if (state.kind === 'error') return null
  return (
    <nav className="stats" aria-label="Resumen de averías pendientes">
      {SUMMARY_CARDS.map((card) => {
        const value =
          state.kind !== 'ready'
            ? '…'
            : card.key === 'stopped'
              ? state.data.stoppedMachines
              : state.data.byStatus[card.key]
        const to = card.key === 'stopped' ? '/maquinas?status=en_averia' : `/averias?status=${card.key}`
        return (
          <Link
            key={card.key}
            to={to}
            className={`stat stat--${card.tone}`}
            aria-current={card.key === currentStatus ? 'true' : undefined}
          >
            <span className="stat__label">
              <Icon name={card.icon} size={16} />
              {card.label}
            </span>
            <span className="stat__value">{value}</span>
            <span className="stat__hint">{card.hint}</span>
          </Link>
        )
      })}
    </nav>
  )
}
