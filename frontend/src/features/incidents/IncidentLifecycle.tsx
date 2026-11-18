import type { IncidentStatus } from './api'
import { INCIDENT_STATUS_LABELS } from './labels'

const ORDER: IncidentStatus[] = ['abierta', 'asignada', 'en_curso', 'resuelta', 'cerrada']

/** Ciclo de vida de la avería con el estado actual resaltado. */
export function IncidentLifecycle({ status }: { status: IncidentStatus }) {
  const current = ORDER.indexOf(status)
  return (
    <ol className="stepper" aria-label="Ciclo de vida">
      {ORDER.map((step, index) => {
        const done = index < current || status === 'cerrada'
        const isCurrent = index === current && status !== 'cerrada'
        const modifier = isCurrent ? ' stepper__step--current' : done ? ' stepper__step--done' : ''
        return (
          <li
            key={step}
            className={`stepper__step${modifier}`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className="stepper__marker" aria-hidden="true">
              {done ? '✓' : index + 1}
            </span>
            {INCIDENT_STATUS_LABELS[step]}
          </li>
        )
      })}
    </ol>
  )
}
