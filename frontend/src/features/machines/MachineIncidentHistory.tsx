import { useState } from 'react'
import { Link } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { DEFAULT_PAGE_SIZE } from '../../shared/api/types'
import { Empty, ErrorMessage, Loading } from '../../shared/components/AsyncStatus'
import { Icon } from '../../shared/components/Icon'
import { Pagination } from '../../shared/components/Pagination'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { listIncidents } from '../incidents/api'
import { IncidentTable } from '../incidents/IncidentTable'
import type { MachineDetail } from './api'

/** Averías de la máquina en todos sus estados (GET /incidents?machine_id=…). */
export function MachineIncidentHistory({ machine }: { machine: MachineDetail }) {
  const { actor } = useActor()
  const [page, setPage] = useState(1)
  const query = { machine_id: machine.id, page, page_size: DEFAULT_PAGE_SIZE }
  const { state, reload } = useAsyncData(JSON.stringify(query), (signal) =>
    listIncidents(query, signal),
  )

  return (
    <section className="stack" aria-labelledby="machine-history-title">
      <div className="section-header">
        <div>
          <h2 id="machine-history-title">Historial de averías</h2>
          <p>Todas sus averías, abiertas y cerradas, de la más reciente a la más antigua.</p>
        </div>
        <div className="actions">
          <Link className="button" to={`/historico?machine_id=${String(machine.id)}`}>
            <Icon name="book" size={16} />
            Ver reparaciones documentadas
          </Link>
          {actor && machine.admin_status !== 'de_baja' && (
            <Link
              className="button button--primary"
              to={`/averias/nueva?machine_id=${String(machine.id)}`}
            >
              <Icon name="plus" size={16} />
              Registrar avería en esta máquina
            </Link>
          )}
        </div>
      </div>
      {state.kind === 'loading' && <Loading rows={3} />}
      {state.kind === 'error' && <ErrorMessage message={state.message} onRetry={reload} />}
      {state.kind === 'ready' && state.data.items.length === 0 && (
        <Empty icon="checkCircle">Esta máquina no tiene averías registradas.</Empty>
      )}
      {state.kind === 'ready' && state.data.items.length > 0 && (
        <>
          <IncidentTable incidents={state.data.items} showMachine={false} />
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
