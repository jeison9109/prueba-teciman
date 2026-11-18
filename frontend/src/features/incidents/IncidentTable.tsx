import { Link } from 'react-router'
import { useTimezone } from '../../app/SettingsContext'
import { Icon } from '../../shared/components/Icon'
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
    <div className="table-wrap">
      <table className="table--stack">
        <thead>
          <tr>
            <th scope="col">Avería</th>
            {showMachine && <th scope="col">Máquina</th>}
            <th scope="col">Detección</th>
            <th scope="col">Prioridad</th>
            <th scope="col">Parada</th>
            <th scope="col">Técnico</th>
            <th scope="col" className="num">
              Horas
            </th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((incident) => (
            <tr key={incident.id}>
              <td className="cell--wide" data-label="Avería">
                <Link className="cell-link" to={`/averias/${String(incident.id)}`}>
                  {incident.number}
                </Link>
                <span className="cell-title">{incident.title}</span>
              </td>
              {showMachine && (
                <td className="cell--wide" data-label="Máquina">
                  <span>
                    <Link className="cell-link" to={`/maquinas/${String(incident.machine.id)}`}>
                      {incident.machine.code}
                    </Link>
                    <span className="cell-sub">{incident.machine.name}</span>
                  </span>
                </td>
              )}
              <td className="nowrap" data-label="Detección">
                {formatDateTime(incident.detected_at, timeZone)}
              </td>
              <td data-label="Prioridad">
                <span>
                  <PriorityBadge priority={incident.priority} />
                </span>
              </td>
              <td data-label="Parada">
                {incident.machine_stopped ? (
                  <span className="stopped">
                    <Icon name="pause" size={15} />
                    Sí
                  </span>
                ) : (
                  <span className="muted">No</span>
                )}
              </td>
              <td data-label="Técnico">
                {incident.assigned_technician?.full_name ?? (
                  <span className="muted">Sin asignar</span>
                )}
              </td>
              <td className="num" data-label="Horas">
                {formatHours(incident.worked_minutes)}
              </td>
              <td data-label="Estado">
                <span>
                  <IncidentStatusBadge status={incident.status} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
