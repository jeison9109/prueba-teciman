import type { MachineStatus } from './api'
import { STATUS_LABELS } from './labels'

export function MachineStatusBadge({ status }: { status: MachineStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status]}</span>
}
