import { Link } from 'react-router'
import { useTimezone } from '../../app/SettingsContext'
import { formatDateTime } from '../../shared/utils/datetime'
import { formatHours } from '../../shared/utils/format'
import type { Incident } from './api'
import { IncidentStatusBadge, PriorityBadge } from './IncidentBadges'

interface IncidentTableProps {
  incidents: Incident[]
  /** En la ficha de máquina la columna de máquina sobra. */
  showMachine?: boolean
}

export function IncidentTable({ incidents, showMachine = true }: IncidentTableProps) {
  const timeZone = useTimezone()
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Número</th>
          <th scope="col">Título</th>
          {showMachine && <th scope="col">Máquina</th>}
          <th scope="col">Detección</th>
          <th scope="col">Prioridad</th>
          <th scope="col">Parada</th>
          <th scope="col">Técnico</th>
          <th scope="col">Horas</th>
          <th scope="col">Estado</th>
        </tr>
      </thead>
      <tbody>
        {incidents.map((incident) => (
          <tr key={incident.id}>
            <td>
              <Link to={`/averias/${String(incident.id)}`}>{incident.number}</Link>
            </td>
            <td>{incident.title}</td>
            {showMachine && (
              <td>
                <Link to={`/maquinas/${String(incident.machine.id)}`}>{incident.machine.code}</Link>{' '}
                <span className="muted">{incident.machine.name}</span>
              </td>
            )}
            <td>{formatDateTime(incident.detected_at, timeZone)}</td>
            <td>
              <PriorityBadge priority={incident.priority} />
            </td>
            <td>{incident.machine_stopped ? 'Sí' : 'No'}</td>
            <td>{incident.assigned_technician?.full_name ?? '—'}</td>
            <td>{formatHours(incident.worked_minutes)}</td>
            <td>
              <IncidentStatusBadge status={incident.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
