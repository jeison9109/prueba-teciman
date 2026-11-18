import { useCallback, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { useTimezone } from '../../app/SettingsContext'
import { ErrorMessage, Loading, SuccessMessage } from '../../shared/components/AsyncStatus'
import { ConfirmButton } from '../../shared/components/ConfirmButton'
import { Icon } from '../../shared/components/Icon'
import { PageHeader } from '../../shared/components/PageHeader'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { formatDateTime } from '../../shared/utils/datetime'
import { formatHours, orDash } from '../../shared/utils/format'
import { MachineStatusBadge } from '../machines/MachineStatusBadge'
import { availableActions } from './actions'
import { getIncident, type IncidentDetail } from './api'
import { formatDowntime } from './format'
import { IncidentStatusBadge, PriorityBadge } from './IncidentBadges'
import { IncidentLifecycle } from './IncidentLifecycle'
import { FAILURE_TYPE_LABELS, SOLUTION_TYPE_LABELS } from './labels'
import { NEXT_STEP } from './nextStep'
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

  if (state.kind === 'loading') return <Loading rows={8} />
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
      onDismiss={() => {
        setNotice(null)
      }}
    />
  )
}

interface IncidentViewProps {
  incident: IncidentDetail
  notice: string | null
  /** Muestra el aviso y recarga el detalle (y con él, formularios e imputaciones). */
  onDone: (notice: string) => void
  onDismiss: () => void
}

function IncidentView({ incident, notice, onDone, onDismiss }: IncidentViewProps) {
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
  const step = NEXT_STEP[incident.status]
  const finished = incident.status === 'cerrada'

  return (
    <section aria-labelledby="incident-title">
      <PageHeader
        titleId="incident-title"
        back={{ to: '/averias', label: 'Averías' }}
        eyebrow={incident.number}
        title={incident.title}
        meta={
          <>
            <IncidentStatusBadge status={incident.status} />
            <PriorityBadge priority={incident.priority} />
            {incident.machine_stopped && (
              <span className="badge badge--danger">Máquina parada</span>
            )}
          </>
        }
      />
      {notice && <SuccessMessage onDismiss={onDismiss}>{notice}</SuccessMessage>}
      {actions.state.error && !resolving && <ErrorMessage message={actions.state.error} />}

      <IncidentLifecycle status={incident.status} />

      <div className={`card next-step${finished ? ' next-step--done' : ''}`}>
        <div className="next-step__text">
          <Icon name={finished ? 'checkCircle' : 'info'} />
          <div>
            <h2>{step.title}</h2>
            <p>{step.text}</p>
          </div>
        </div>
        {hasButtons && (
          <div className="actions" role="group" aria-label="Acciones">
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
                <Icon name="play" />
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
                <Icon name="check" />
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
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="card" aria-labelledby="symptom-title">
            <h2 id="symptom-title" className="card__title">
              <Icon name="alert" />
              Síntoma
            </h2>
            <p className="text-block">{incident.symptom}</p>
          </section>

          <section className="card" aria-labelledby="resolution-title">
            <h2 id="resolution-title" className="card__title">
              <Icon name="lightbulb" />
              Resolución y conocimiento
            </h2>
            {resolving ? (
              <>
                <p className="card__subtitle">
                  Documenta por qué falló y cómo se arregló: quedará en el histórico para futuras
                  averías.
                </p>
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
            ) : incident.resolved_at ? (
              <Resolution incident={incident} />
            ) : (
              <div className="stack">
                <p className="pending">
                  <Icon name="clock" size={16} />
                  Pendiente de resolver.
                </p>
                <Link
                  className="hint-link"
                  to={`/historico?machine_id=${String(incident.machine.id)}`}
                >
                  <Icon name="book" size={16} />
                  Ver reparaciones anteriores de {incident.machine.code}
                </Link>
              </div>
            )}
          </section>

          <WorkLogSection incident={incident} canLog={can('log')} onLogged={onDone} />
        </div>

        <aside className="detail-aside" aria-label="Datos de la avería">
          <section className="card" aria-labelledby="detection-title">
            <h2 id="detection-title" className="card__title">
              Detección
            </h2>
            <dl className="details details--stacked">
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
              <dt>Técnico asignado</dt>
              <dd>{incident.assigned_technician?.full_name ?? 'Sin asignar'}</dd>
            </dl>
          </section>

          <section className="card" aria-labelledby="hours-title">
            <h2 id="hours-title" className="card__title">
              Horas y parada
            </h2>
            <div className="metric-row">
              <div className="metric">
                <span>Horas de trabajo</span>
                <strong>{formatHours(incident.worked_minutes)}</strong>
              </div>
              <div className="metric">
                <span>Tiempo de parada</span>
                <strong>{formatDowntime(incident)}</strong>
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="validation-title">
            <h2 id="validation-title" className="card__title">
              Validación
            </h2>
            {incident.closed_at ? (
              <dl className="details details--stacked">
                <dt>Validada por</dt>
                <dd>{incident.closed_by?.full_name ?? '—'}</dd>
                <dt>Cerrada</dt>
                <dd>{formatDateTime(incident.closed_at, timeZone)}</dd>
              </dl>
            ) : (
              <p className="pending">
                <Icon name="shield" size={16} />
                Pendiente de cierre por un responsable.
              </p>
            )}
          </section>
        </aside>
      </div>
    </section>
  )
}

/** Conocimiento documentado al resolver: el núcleo reutilizable de la avería. */
function Resolution({ incident }: { incident: IncidentDetail }) {
  const timeZone = useTimezone()
  return (
    <div className="knowledge">
      <p className="muted">
        Resuelta el{' '}
        <span>{incident.resolved_at ? formatDateTime(incident.resolved_at, timeZone) : '—'}</span>
        {incident.solution_type && ` · ${SOLUTION_TYPE_LABELS[incident.solution_type]}`}
      </p>
      <div className="knowledge__item">
        <h3>Causa raíz</h3>
        <p className="text-block">{orDash(incident.root_cause)}</p>
      </div>
      <div className="knowledge__item knowledge__item--highlight">
        <h3>Solución aplicada</h3>
        <p className="text-block">{orDash(incident.solution)}</p>
      </div>
      <div className="knowledge__item">
        <h3>Repuestos</h3>
        <p className="text-block">{orDash(incident.replaced_parts)}</p>
      </div>
      <div className="knowledge__item">
        <h3>Recomendación preventiva</h3>
        <p className="text-block">{orDash(incident.preventive_recommendation)}</p>
      </div>
    </div>
  )
}
