import { Link } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { DEFAULT_PAGE_SIZE } from '../../shared/api/types'
import { Empty, ErrorMessage, Loading } from '../../shared/components/AsyncStatus'
import { SelectField } from '../../shared/components/Field'
import { Pagination } from '../../shared/components/Pagination'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { useUrlFilters } from '../../shared/hooks/useUrlFilters'
import { optionsFrom } from '../../shared/utils/options'
import { useMachineOptions } from '../machines/useMachineOptions'
import { listIncidents } from './api'
import { IncidentTable } from './IncidentTable'
import { INCIDENT_STATUS_LABELS, PRIORITY_LABELS } from './labels'

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

  return (
    <section aria-labelledby="incidents-title">
      <div className="page-header">
        <h1 id="incidents-title">Averías</h1>
        {actor && (
          <Link className="button button--primary" to="/averias/nueva">
            Registrar avería
          </Link>
        )}
      </div>
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
        <SelectField
          label="Máquina"
          value={filters.machine_id}
          options={machineOptions}
          onChange={(value) => {
            setFilter('machine_id', value)
          }}
          emptyLabel={machines.state.kind === 'loading' ? 'Cargando…' : 'Todas'}
        />
        <button type="button" onClick={clear}>
          Limpiar filtros
        </button>
      </form>

      {state.kind === 'loading' && <Loading />}
      {state.kind === 'error' && <ErrorMessage message={state.message} onRetry={reload} />}
      {state.kind === 'ready' && state.data.items.length === 0 && (
        <Empty>No hay averías con estos filtros.</Empty>
      )}
      {state.kind === 'ready' && state.data.items.length > 0 && (
        <>
          <p className="muted">{state.data.total} avería(s)</p>
          <IncidentTable incidents={state.data.items} />
          <Pagination
            page={state.data.page}
            pageSize={state.data.page_size}
            total={state.data.total}
            onChange={setPage}
          />
        </>
      )}
    </section>
  )
}
