import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { DEFAULT_PAGE_SIZE } from '../../shared/api/types'
import { Empty, ErrorMessage, Loading } from '../../shared/components/AsyncStatus'
import { SelectField, TextField } from '../../shared/components/Field'
import { optionsFrom } from '../../shared/utils/options'
import { Pagination } from '../../shared/components/Pagination'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { useUrlFilters } from '../../shared/hooks/useUrlFilters'
import { listMachines } from './api'
import { CRITICALITY_LABELS, STATUS_LABELS } from './labels'
import { MachineStatusBadge } from './MachineStatusBadge'

const FILTERS = ['status', 'location', 'type'] as const

export function MachineListPage() {
  const { isManager } = useActor()
  const { filters, page, setFilter, setPage, clear } = useUrlFilters(FILTERS)
  const query = { ...filters, page, page_size: DEFAULT_PAGE_SIZE }
  const { state, reload } = useAsyncData(JSON.stringify(query), (signal) =>
    listMachines(query, signal),
  )
  // Los textos se aplican al enviar para no consultar en cada pulsación.
  const [draft, setDraft] = useState({ location: filters.location, type: filters.type })

  function applyText(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilter('location', draft.location.trim())
    setFilter('type', draft.type.trim())
  }

  return (
    <section aria-labelledby="machines-title">
      <div className="page-header">
        <h1 id="machines-title">Máquinas</h1>
        {isManager && (
          <Link className="button button--primary" to="/maquinas/nueva">
            Nueva máquina
          </Link>
        )}
      </div>
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
        <button type="submit">Buscar</button>
        <button
          type="button"
          onClick={() => {
            setDraft({ location: '', type: '' })
            clear()
          }}
        >
          Limpiar filtros
        </button>
      </form>

      {state.kind === 'loading' && <Loading />}
      {state.kind === 'error' && <ErrorMessage message={state.message} onRetry={reload} />}
      {state.kind === 'ready' && state.data.items.length === 0 && (
        <Empty>No hay máquinas con estos filtros.</Empty>
      )}
      {state.kind === 'ready' && state.data.items.length > 0 && (
        <>
          <p className="muted">{state.data.total} máquina(s)</p>
          <table>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Nombre</th>
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
                  <td>
                    <Link to={`/maquinas/${String(machine.id)}`}>{machine.code}</Link>
                  </td>
                  <td>{machine.name}</td>
                  <td>{machine.type}</td>
                  <td>{machine.location}</td>
                  <td>{CRITICALITY_LABELS[machine.criticality]}</td>
                  <td>
                    <MachineStatusBadge status={machine.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
