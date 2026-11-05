import { apiRequest, buildQuery } from '../../shared/api/client'
import type { Page } from '../../shared/api/types'
import type {
  FailureType,
  IncidentStatus,
  MachineRef,
  PersonRef,
  SolutionType,
} from '../incidents/api'

/** Avería resuelta o cerrada con la documentación de la reparación. */
export interface HistoryItem {
  id: number
  number: string
  status: Extract<IncidentStatus, 'resuelta' | 'cerrada'>
  title: string
  failure_type: FailureType
  machine: MachineRef
  detected_at: string
  resolved_at: string
  closed_at: string | null
  assigned_technician: PersonRef | null
  symptom: string
  root_cause: string
  solution: string
  solution_type: SolutionType | null
  replaced_parts: string | null
  worked_minutes: number
  downtime_hours: number | null
}

/** Filtros del histórico; la API los combina con AND y busca sin distinguir mayúsculas. */
export interface HistoryQuery {
  machine_id?: string
  symptom?: string
  root_cause?: string
  q?: string
  page?: number
  page_size?: number
}

export const SEARCH_MAX_LENGTH = 200

export function listHistory(query: HistoryQuery, signal?: AbortSignal): Promise<Page<HistoryItem>> {
  return apiRequest(`/incidents/history${buildQuery({ ...query })}`, { signal: signal ?? null })
}
