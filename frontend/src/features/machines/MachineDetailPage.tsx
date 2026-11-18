import { useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { ErrorMessage, Loading, SuccessMessage } from '../../shared/components/AsyncStatus'
import { ConfirmButton } from '../../shared/components/ConfirmButton'
import { Icon } from '../../shared/components/Icon'
import { PageHeader } from '../../shared/components/PageHeader'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { useSubmit } from '../../shared/hooks/useSubmit'
import { formatDate, formatHours, orDash } from '../../shared/utils/format'
import { getMachine, retireMachine, updateMachine } from './api'
import { ADMIN_STATUS_LABELS, CRITICALITY_LABELS } from './labels'
import { MachineForm } from './MachineForm'
import { MachineIncidentHistory } from './MachineIncidentHistory'
import { CriticalityBadge, MachineStatusBadge } from './MachineStatusBadge'

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

  if (state.kind === 'loading') return <Loading rows={8} />
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
      <PageHeader
        titleId="machine-title"
        back={{ to: '/maquinas', label: 'Máquinas' }}
        eyebrow={machine.code}
        title={machine.name}
        meta={
          <>
            <MachineStatusBadge status={machine.status} />
            <CriticalityBadge criticality={machine.criticality} />
          </>
        }
        actions={
          canManage &&
          !editing && (
            <>
              <button
                type="button"
                onClick={() => {
                  setNotice(null)
                  setEditing(true)
                }}
              >
                <Icon name="edit" size={16} />
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
            </>
          )
        }
      />
      {notice && (
        <SuccessMessage
          onDismiss={() => {
            setNotice(null)
          }}
        >
          {notice}
        </SuccessMessage>
      )}
      {retire.state.error && <ErrorMessage message={retire.state.error} />}
      {canManage && !editing && machine.open_incidents > 0 && (
        <p className="alert alert--info">
          <Icon name="info" />
          <span className="alert__body">
            Solo se puede dar de baja cuando todas sus averías estén cerradas.
          </span>
        </p>
      )}
      {retired && (
        <p className="alert alert--info">
          <Icon name="archive" />
          <span className="alert__body">Máquina de baja: se conserva para consulta.</span>
        </p>
      )}

      {editing ? (
        <div className="card">
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
        </div>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <span className="stat__label">
                <Icon name="clock" size={16} />
                Horas de trabajo acumuladas
              </span>
              <span className="stat__value">{formatHours(machine.worked_minutes)}</span>
            </div>
            <div className={`stat${machine.open_incidents > 0 ? ' stat--warning' : ''}`}>
              <span className="stat__label">
                <Icon name="wrench" size={16} />
                Averías sin cerrar
              </span>
              <span className="stat__value">{machine.open_incidents}</span>
            </div>
          </div>
          <section className="card" aria-labelledby="machine-data-title">
            <h2 id="machine-data-title" className="card__title">
              <Icon name="factory" />
              Ficha técnica
            </h2>
            <dl className="details details--columns">
              <div>
                <dt>Tipo o familia</dt>
                <dd>{machine.type}</dd>
              </div>
              <div>
                <dt>Ubicación</dt>
                <dd>{machine.location}</dd>
              </div>
              <div>
                <dt>Criticidad</dt>
                <dd>{CRITICALITY_LABELS[machine.criticality]}</dd>
              </div>
              <div>
                <dt>Condición administrativa</dt>
                <dd>
                  {machine.admin_status === 'de_baja'
                    ? 'De baja'
                    : ADMIN_STATUS_LABELS[machine.admin_status]}
                </dd>
              </div>
              <div>
                <dt>Fabricante</dt>
                <dd>{orDash(machine.manufacturer)}</dd>
              </div>
              <div>
                <dt>Modelo</dt>
                <dd>{orDash(machine.model)}</dd>
              </div>
              <div>
                <dt>Número de serie</dt>
                <dd>{orDash(machine.serial_number)}</dd>
              </div>
              <div>
                <dt>Puesta en marcha</dt>
                <dd>{formatDate(machine.commissioning_date)}</dd>
              </div>
            </dl>
          </section>
          <MachineIncidentHistory machine={machine} />
        </>
      )}
    </section>
  )
}
