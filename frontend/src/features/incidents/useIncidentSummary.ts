import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { listMachines } from '../machines/api'
import { listIncidents, type IncidentStatus } from './api'

/** Estados con trabajo pendiente que se resumen en la bandeja. */
export const PENDING_STATUSES = ['abierta', 'asignada', 'en_curso', 'resuelta'] as const

export interface IncidentSummary {
  byStatus: Record<(typeof PENDING_STATUSES)[number], number>
  stoppedMachines: number
}

async function loadSummary(signal: AbortSignal): Promise<IncidentSummary> {
  // Solo interesan los totales: se pide una fila por consulta.
  const count = (status: IncidentStatus) =>
    listIncidents({ status, page_size: 1 }, signal).then((page) => page.total)
  const [abierta, asignada, en_curso, resuelta, stoppedMachines] = await Promise.all([
    count('abierta'),
    count('asignada'),
    count('en_curso'),
    count('resuelta'),
    listMachines({ status: 'en_averia', page_size: 1 }, signal).then((page) => page.total),
  ])
  return { byStatus: { abierta, asignada, en_curso, resuelta }, stoppedMachines }
}

/** Totales de averías pendientes por estado y de máquinas paradas, para el resumen de la bandeja. */
export function useIncidentSummary() {
  return useAsyncData('incident-summary', loadSummary)
}
