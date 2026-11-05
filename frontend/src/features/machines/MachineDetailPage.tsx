import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { ErrorMessage, Loading, SuccessMessage } from '../../shared/components/AsyncStatus'
import { ConfirmButton } from '../../shared/components/ConfirmButton'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { useSubmit } from '../../shared/hooks/useSubmit'
import { formatDate, formatHours, orDash } from '../../shared/utils/format'
import { getMachine, retireMachine, updateMachine } from './api'
import { ADMIN_STATUS_LABELS, CRITICALITY_LABELS } from './labels'
import { MachineForm } from './MachineForm'
import { MachineStatusBadge } from './MachineStatusBadge'

export function MachineDetailPage() {
  const id = Number(useParams().id)
  const location = useLocation()
  const initialNotice = (location.state as { notice?: string } | null)?.notice ?? null
  const { isManager } = useActor()
  const { state, reload } = useAsyncData(`machine-${String(id)}`, (signal) =>
    getMachine(id, signal),
  )
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<string | null>(initialNotice)
  const edit = useSubmit()
  const retire = useSubmit()

  if (state.kind === 'loading') return <Loading />
  if (state.kind === 'error') {
    return (
      <ErrorMessage
        message={state.status === 404 ? 'La máquina no existe' : state.message}
        onRetry={state.status === 404 ? undefined : reload}
      />
    )
  }
  const machine = state.data
  const retired = machine.admin_status === 'de_baja'
  const canManage = isManager && !retired

  return (
    <section aria-labelledby="machine-title">
      <p>
        <Link to="/maquinas">← Máquinas</Link>
      </p>
      <div className="page-header">
        <h1 id="machine-title">
          {machine.code} · {machine.name}
        </h1>
        <MachineStatusBadge status={machine.status} />
      </div>
      {notice && <SuccessMessage>{notice}</SuccessMessage>}

      {editing ? (
        <MachineForm
          machine={machine}
          submitLabel="Guardar cambios"
          submitState={edit.state}
          onCancel={() => {
            edit.reset()
            setEditing(false)
          }}
          onSubmit={(input) => {
            void edit.submit(() => updateMachine(machine.id, input)).then((result) => {
              if (!result) return
              setEditing(false)
              setNotice('Cambios guardados')
              reload()
            })
          }}
        />
      ) : (
        <>
          <dl className="details">
            <dt>Tipo o familia</dt>
            <dd>{machine.type}</dd>
            <dt>Ubicación</dt>
            <dd>{machine.location}</dd>
            <dt>Criticidad</dt>
            <dd>{CRITICALITY_LABELS[machine.criticality]}</dd>
            <dt>Condición administrativa</dt>
            <dd>
              {machine.admin_status === 'de_baja'
                ? 'De baja'
                : ADMIN_STATUS_LABELS[machine.admin_status]}
            </dd>
            <dt>Fabricante</dt>
            <dd>{orDash(machine.manufacturer)}</dd>
            <dt>Modelo</dt>
            <dd>{orDash(machine.model)}</dd>
            <dt>Número de serie</dt>
            <dd>{orDash(machine.serial_number)}</dd>
            <dt>Puesta en marcha</dt>
            <dd>{formatDate(machine.commissioning_date)}</dd>
            <dt>Horas de trabajo acumuladas</dt>
            <dd>{formatHours(machine.worked_minutes)}</dd>
            <dt>Averías sin cerrar</dt>
            <dd>{machine.open_incidents}</dd>
          </dl>
          {retire.state.error && <ErrorMessage message={retire.state.error} />}
          {canManage && (
            <div className="actions">
              <button
                type="button"
                onClick={() => {
                  setNotice(null)
                  setEditing(true)
                }}
              >
                Editar
              </button>
              <ConfirmButton
                label="Dar de baja"
                confirmLabel="Confirmar baja"
                question="La máquina quedará solo para consulta."
                danger
                disabled={machine.open_incidents > 0}
                pending={retire.state.pending}
                onConfirm={() => {
                  void retire.submit(() => retireMachine(machine.id)).then((result) => {
                    if (result === undefined) return
                    setNotice('Máquina dada de baja')
                    reload()
                  })
                }}
              />
            </div>
          )}
          {canManage && machine.open_incidents > 0 && (
            <p className="muted">Solo se puede dar de baja cuando todas sus averías estén cerradas.</p>
          )}
          {retired && <p className="muted">Máquina de baja: se conserva para consulta.</p>}
          <h2>Historial de averías</h2>
          <p className="muted">El listado de averías de la máquina se añade con la Fase 3.</p>
        </>
      )}
    </section>
  )
}
