import type { Criticality, MachineStatus } from './api'
import { CRITICALITY_LABELS, STATUS_LABELS } from './labels'

export function MachineStatusBadge({ status }: { status: MachineStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status]}</span>
}

const CRITICALITY_TONE: Record<Criticality, string> = {
  alta: 'danger',
  media: 'warning',
  baja: 'de_baja',
}

export function CriticalityBadge({ criticality }: { criticality: Criticality }) {
  return (
    <span className={`badge badge--${CRITICALITY_TONE[criticality]}`}>
      {CRITICALITY_LABELS[criticality]}
    </span>
  )
}
