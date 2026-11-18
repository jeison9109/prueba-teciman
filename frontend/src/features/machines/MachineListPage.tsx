import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { DEFAULT_PAGE_SIZE } from '../../shared/api/types'
import { Empty, ErrorMessage, Loading } from '../../shared/components/AsyncStatus'
import { SelectField, TextField } from '../../shared/components/Field'
import { optionsFrom } from '../../shared/utils/options'
import { Icon } from '../../shared/components/Icon'
import { PageHeader } from '../../shared/components/PageHeader'
import { Pagination } from '../../shared/components/Pagination'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { useUrlFilters } from '../../shared/hooks/useUrlFilters'
import { listMachines } from './api'
import { STATUS_LABELS } from './labels'
import { CriticalityBadge, MachineStatusBadge } from './MachineStatusBadge'

const FILTERS = ['status', 'location', 'type'] as const

export function MachineListPage() {
  const { isManager } = useActor()
  const { filters, page, setFilter, setFilters, setPage, clear } = useUrlFilters(FILTERS)
  const query = { ...filters, page, page_size: DEFAULT_PAGE_SIZE }
  const { state, reload } = useAsyncData(JSON.stringify(query), (signal) =>
    listMachines(query, signal),
  )
  // Los textos se aplican al enviar para no consultar en cada pulsación.
  const [draft, setDraft] = useState({ location: filters.location, type: filters.type })

  const filtered = FILTERS.some((key) => filters[key])

  function applyText(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters({ location: draft.location.trim(), type: draft.type.trim() })
  }

  return (
    <section aria-labelledby="machines-title">
      <PageHeader
        titleId="machines-title"
        title="Máquinas"
        description="Parque de máquinas con su estado efectivo. Abre una ficha para ver su historial de averías."
        actions={
          isManager && (
            <Link className="button button--primary" to="/maquinas/nueva">
              <Icon name="plus" />
              Nueva máquina
            </Link>
          )
        }
      />
      <form className="filters" role="search" aria-label="Filtrar máquinas" onSubmit={applyText}>
        <SelectField
          label="Estado"
          value={filters.status}
          options={optionsFrom(STATUS_LABELS)}
          onChange={(value) => {
            setFilter('status', value)
          }}
          emptyLabel="Todos"
        />
        <TextField
          label="Tipo"
          type="search"
          value={draft.type}
          onChange={(value) => {
            setDraft((previous) => ({ ...previous, type: value }))
          }}
          maxLength={80}
        />
        <TextField
          label="Ubicación"
          type="search"
          value={draft.location}
          onChange={(value) => {
            setDraft((previous) => ({ ...previous, location: value }))
          }}
          maxLength={120}
        />
        <div className="filters__actions">
          <button type="submit" className="button--primary">
            <Icon name="search" size={16} />
            Buscar
          </button>
          <button
            type="button"
            disabled={!filtered && !draft.location && !draft.type}
            onClick={() => {
              setDraft({ location: '', type: '' })
              clear()
            }}
          >
            Limpiar
          </button>
        </div>
      </form>

      {state.kind === 'loading' && <Loading rows={6} />}
      {state.kind === 'error' && <ErrorMessage message={state.message} onRetry={reload} />}
      {state.kind === 'ready' && state.data.items.length === 0 && (
        <Empty icon={filtered ? 'search' : 'factory'}>
          {filtered ? 'No hay máquinas con estos filtros.' : 'Todavía no hay máquinas registradas.'}
        </Empty>
      )}
      {state.kind === 'ready' && state.data.items.length > 0 && (
        <div className="stack">
          <p className="result-count">
            {state.data.total} {state.data.total === 1 ? 'máquina' : 'máquinas'}
          </p>
          <div className="table-wrap">
            <table className="table--stack">
              <thead>
                <tr>
                  <th scope="col">Máquina</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Ubicación</th>
                  <th scope="col">Criticidad</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((machine) => (
                  <tr
                    key={machine.id}
                    className={machine.status === 'de_baja' ? 'row--retired' : undefined}
                  >
                    <td className="cell--wide" data-label="Máquina">
                      <Link className="cell-link" to={`/maquinas/${String(machine.id)}`}>
                        {machine.code}
                      </Link>
                      <span className="cell-title">{machine.name}</span>
                    </td>
                    <td data-label="Tipo">{machine.type}</td>
                    <td data-label="Ubicación">{machine.location}</td>
                    <td data-label="Criticidad">
                      <span>
                        <CriticalityBadge criticality={machine.criticality} />
                      </span>
                    </td>
                    <td data-label="Estado">
                      <span>
                        <MachineStatusBadge status={machine.status} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
