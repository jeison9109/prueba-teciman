import { formatHours } from '../../shared/utils/format'
import type { Incident } from './api'

/** Tiempo de parada calculado por el backend, con su significado cuando no hay horas. */
export function formatDowntime(incident: Pick<Incident, 'machine_stopped' | 'downtime_hours'>) {
  if (!incident.machine_stopped) return 'Sin parada (0,00 h)'
  if (incident.downtime_hours === null) return 'Parada en curso'
  return formatHours(Math.round(incident.downtime_hours * 60))
}
