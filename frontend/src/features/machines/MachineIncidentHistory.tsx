import { useState } from 'react'
import { Link } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { DEFAULT_PAGE_SIZE } from '../../shared/api/types'
import { Empty, ErrorMessage, Loading } from '../../shared/components/AsyncStatus'
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
    <section aria-labelledby="machine-history-title">
      <div className="page-header">
        <h2 id="machine-history-title">Historial de averías</h2>
        {actor && machine.admin_status !== 'de_baja' && (
          <Link className="button" to={`/averias/nueva?machine_id=${String(machine.id)}`}>
            Registrar avería en esta máquina
          </Link>
        )}
      </div>
      {state.kind === 'loading' && <Loading />}
      {state.kind === 'error' && <ErrorMessage message={state.message} onRetry={reload} />}
      {state.kind === 'ready' && state.data.items.length === 0 && (
        <Empty>Esta máquina no tiene averías registradas.</Empty>
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
