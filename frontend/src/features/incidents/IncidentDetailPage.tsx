import { useCallback, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { useTimezone } from '../../app/SettingsContext'
import { ErrorMessage, Loading, SuccessMessage } from '../../shared/components/AsyncStatus'
import { ConfirmButton } from '../../shared/components/ConfirmButton'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { formatDateTime } from '../../shared/utils/datetime'
import { formatHours, orDash } from '../../shared/utils/format'
import { MachineStatusBadge } from '../machines/MachineStatusBadge'
import { availableActions } from './actions'
import { getIncident, type IncidentDetail } from './api'
import { formatDowntime } from './format'
import { IncidentStatusBadge, PriorityBadge } from './IncidentBadges'
import { FAILURE_TYPE_LABELS, SOLUTION_TYPE_LABELS } from './labels'
import { ResolveForm } from './ResolveForm'
import { TechnicianPicker } from './TechnicianPicker'
import { useIncidentActions } from './useIncidentActions'
import { WorkLogSection } from './WorkLogSection'

export function IncidentDetailPage() {
  const id = Number(useParams().id)
  const location = useLocation()
  const initialNotice = (location.state as { notice?: string } | null)?.notice ?? null
  const { state, reload } = useAsyncData(`incident-${String(id)}`, (signal) =>
    getIncident(id, signal),
  )
  const [notice, setNotice] = useState<string | null>(initialNotice)

  const onDone = useCallback(
    (message: string) => {
      setNotice(message)
      reload()
    },
    [reload],
  )

  if (state.kind === 'loading') return <Loading />
  if (state.kind === 'error') {
    return (
      <ErrorMessage
        message={state.status === 404 ? 'La avería no existe' : state.message}
        onRetry={state.status === 404 ? undefined : reload}
      />
    )
  }
  return (
    <IncidentView
      incident={state.data}
      notice={notice}
      onDone={onDone}
    />
  )
}

interface IncidentViewProps {
  incident: IncidentDetail
  notice: string | null
  /** Muestra el aviso y recarga el detalle (y con él, formularios e imputaciones). */
  onDone: (notice: string) => void
}

function IncidentView({ incident, notice, onDone }: IncidentViewProps) {
  const { actor } = useActor()
  const timeZone = useTimezone()
  const actions = useIncidentActions(incident.id, onDone)
  const [resolving, setResolving] = useState(false)
  const allowed = availableActions(incident, actor)
  const can = (action: (typeof allowed)[number]) => allowed.includes(action)
  // Las imputaciones van en su sección y, con el formulario abierto, «Resolver» se oculta.
  const hasButtons = allowed.some(
    (action) => action !== 'log' && !(action === 'resolve' && resolving),
  )
  const pending = actions.state.pending
  const technicianError = actions.state.fieldErrors.technician_id

  return (
    <section aria-labelledby="incident-title">
      <p>
        <Link to="/averias">← Averías</Link>
      </p>
      <div className="page-header">
        <h1 id="incident-title">
          {incident.number} · {incident.title}
        </h1>
        <span className="badges">
          <PriorityBadge priority={incident.priority} />
          <IncidentStatusBadge status={incident.status} />
        </span>
      </div>
      {notice && <SuccessMessage>{notice}</SuccessMessage>}
      {actions.state.error && !resolving && <ErrorMessage message={actions.state.error} />}

      {hasButtons && (
        <div className="actions card" role="group" aria-label="Acciones">
          {can('assign') && (
            <TechnicianPicker
              label="Técnico"
              submitLabel="Asignar"
              pending={pending}
              error={technicianError}
              onSubmit={(technicianId) => void actions.assign(technicianId)}
            />
          )}
          {can('start') && (
            <button
              type="button"
              className="button--primary"
              disabled={pending}
              onClick={() => void actions.start()}
            >
              {pending ? 'Enviando…' : 'Iniciar trabajo'}
            </button>
          )}
          {can('resolve') && !resolving && (
            <button
              type="button"
              className="button--primary"
              disabled={pending}
              onClick={() => {
                actions.reset()
                setResolving(true)
              }}
            >
              Resolver
            </button>
          )}
          {can('close') && (
            <ConfirmButton
              label="Cerrar y validar"
              confirmLabel="Confirmar cierre"
              question="Quedarás como responsable validador."
              pending={pending}
              onConfirm={() => void actions.close()}
            />
          )}
          {can('reassign') && (
            <TechnicianPicker
              label="Reasignar a"
              submitLabel="Reasignar"
              pending={pending}
              error={technicianError}
              excludeId={incident.assigned_technician?.id}
              onSubmit={(technicianId) => void actions.reassign(technicianId)}
            />
          )}
        </div>
      )}
      {resolving && (
        <>
          {actions.state.error && <ErrorMessage message={actions.state.error} />}
          <ResolveForm
            submitState={actions.state}
            onCancel={() => {
              actions.reset()
              setResolving(false)
            }}
            onSubmit={(input) => void actions.resolve(input)}
          />
        </>
      )}

      <div className="sections">
        <section aria-labelledby="detection-title">
          <h2 id="detection-title">Detección</h2>
          <dl className="details">
            <dt>Máquina</dt>
            <dd>
              <Link to={`/maquinas/${String(incident.machine.id)}`}>
                {incident.machine.code} · {incident.machine.name}
              </Link>{' '}
              <MachineStatusBadge status={incident.machine.status} />
            </dd>
            <dt>Detectada</dt>
            <dd>{formatDateTime(incident.detected_at, timeZone)}</dd>
            <dt>Reportada por</dt>
            <dd>{incident.reported_by.full_name}</dd>
            <dt>Tipo de fallo</dt>
            <dd>{FAILURE_TYPE_LABELS[incident.failure_type]}</dd>
            <dt>Parada de máquina</dt>
            <dd>{incident.machine_stopped ? 'Sí' : 'No'}</dd>
            <dt>Síntoma</dt>
            <dd className="pre-line">{incident.symptom}</dd>
          </dl>
        </section>

        <section aria-labelledby="assignment-title">
          <h2 id="assignment-title">Asignación</h2>
          <dl className="details">
            <dt>Técnico asignado</dt>
            <dd>{incident.assigned_technician?.full_name ?? 'Sin asignar'}</dd>
          </dl>
        </section>

        <section aria-labelledby="resolution-title">
          <h2 id="resolution-title">Resolución</h2>
          {incident.resolved_at ? (
            <dl className="details">
              <dt>Resuelta</dt>
              <dd>{formatDateTime(incident.resolved_at, timeZone)}</dd>
              <dt>Causa raíz</dt>
              <dd className="pre-line">{orDash(incident.root_cause)}</dd>
              <dt>Solución</dt>
              <dd className="pre-line">{orDash(incident.solution)}</dd>
              <dt>Repuestos</dt>
              <dd className="pre-line">{orDash(incident.replaced_parts)}</dd>
              <dt>Tipo de solución</dt>
              <dd>
                {incident.solution_type ? SOLUTION_TYPE_LABELS[incident.solution_type] : '—'}
              </dd>
              <dt>Recomendación preventiva</dt>
              <dd className="pre-line">{orDash(incident.preventive_recommendation)}</dd>
            </dl>
          ) : (
            <p className="muted">Pendiente de resolver.</p>
          )}
        </section>

        <section aria-labelledby="validation-title">
          <h2 id="validation-title">Validación</h2>
          {incident.closed_at ? (
            <dl className="details">
              <dt>Validada por</dt>
              <dd>{incident.closed_by?.full_name ?? '—'}</dd>
              <dt>Cerrada</dt>
              <dd>{formatDateTime(incident.closed_at, timeZone)}</dd>
            </dl>
          ) : (
            <p className="muted">Pendiente de cierre por un responsable.</p>
          )}
        </section>

        <section aria-labelledby="hours-title">
          <h2 id="hours-title">Horas y parada</h2>
          <dl className="details">
            <dt>Horas de trabajo</dt>
            <dd>{formatHours(incident.worked_minutes)}</dd>
            <dt>Tiempo de parada</dt>
            <dd>{formatDowntime(incident)}</dd>
          </dl>
        </section>
      </div>

      <WorkLogSection incident={incident} canLog={can('log')} onLogged={onDone} />
    </section>
  )
}
