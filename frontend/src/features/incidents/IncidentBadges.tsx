import type { IncidentStatus, Priority } from './api'
import { INCIDENT_STATUS_LABELS, PRIORITY_LABELS } from './labels'

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return <span className={`badge badge--incident-${status}`}>{INCIDENT_STATUS_LABELS[status]}</span>
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge badge--priority-${priority}`}>{PRIORITY_LABELS[priority]}</span>
}
