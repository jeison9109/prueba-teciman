import { apiRequest, buildQuery, jsonBody } from '../../shared/api/client'
import type { Page } from '../../shared/api/types'
import type { MachineStatus } from '../machines/api'

export type IncidentStatus = 'abierta' | 'asignada' | 'en_curso' | 'resuelta' | 'cerrada'
export type Priority = 'urgente' | 'alta' | 'media' | 'baja'
export type FailureType =
  | 'mecanico'
  | 'electrico'
  | 'electronico'
  | 'hidraulico'
  | 'neumatico'
  | 'software'
  | 'otro'
export type SolutionType = 'definitiva' | 'provisional' | 'sustitucion' | 'ajuste'

export interface PersonRef {
  id: number
  full_name: string
}

export interface MachineRef {
  id: number
  code: string
  name: string
  status: MachineStatus
}

export interface Incident {
  id: number
  number: string
  status: IncidentStatus
  title: string
  failure_type: FailureType
  priority: Priority
  machine_stopped: boolean
  detected_at: string
  machine: MachineRef
  reported_by: PersonRef
  assigned_technician: PersonRef | null
  resolved_at: string | null
  closed_at: string | null
  worked_minutes: number
  /** Horas de parada calculadas en el backend; nulo mientras siga abierta, 0 sin parada. */
  downtime_hours: number | null
}

export interface IncidentDetail extends Incident {
  symptom: string
  root_cause: string | null
  solution: string | null
  replaced_parts: string | null
  solution_type: SolutionType | null
  preventive_recommendation: string | null
  closed_by: PersonRef | null
  created_at: string
  updated_at: string
}

/**
 * Alta de avería. Los campos opcionales aquí son obligatorios en la API: la interfaz los
 * omite si no se eligieron para que la API devuelva el error junto a cada campo.
 */
export interface IncidentInput {
  machine_id?: number
  /** Hora local de operación sin zona ("aaaa-mm-ddThh:mm"); la API la interpreta. */
  detected_at: string
  title: string
  symptom: string
  failure_type?: FailureType
  priority?: Priority
  machine_stopped?: boolean
}

export interface ResolveInput {
  root_cause: string
  solution: string
  replaced_parts: string | null
  solution_type: SolutionType | null
  preventive_recommendation: string | null
}

export interface WorkLog {
  id: number
  incident_id: number
  technician: PersonRef
  work_date: string
  minutes: number
  description: string
  created_at: string
}

export interface WorkLogInput {
  work_date: string
  /** Horas decimales como texto con punto, p. ej. "1.25". */
  hours: string
  description: string
}

export interface IncidentsQuery {
  machine_id?: string | number
  status?: string
  priority?: string
  page?: number
  page_size?: number
}

const base = (id: number) => `/incidents/${String(id)}`

export function listIncidents(query: IncidentsQuery, signal?: AbortSignal): Promise<Page<Incident>> {
  return apiRequest(`/incidents${buildQuery({ ...query })}`, { signal: signal ?? null })
}

export function getIncident(id: number, signal?: AbortSignal): Promise<IncidentDetail> {
  return apiRequest(base(id), { signal: signal ?? null })
}

export function createIncident(input: IncidentInput): Promise<IncidentDetail> {
  return apiRequest('/incidents', { method: 'POST', body: jsonBody(input) })
}

export function assignIncident(id: number, technicianId: number): Promise<IncidentDetail> {
  return apiRequest(`${base(id)}/assign`, {
    method: 'POST',
    body: jsonBody({ technician_id: technicianId }),
  })
}

export function reassignIncident(id: number, technicianId: number): Promise<IncidentDetail> {
  return apiRequest(`${base(id)}/reassign`, {
    method: 'POST',
    body: jsonBody({ technician_id: technicianId }),
  })
}

export function startIncident(id: number): Promise<IncidentDetail> {
  return apiRequest(`${base(id)}/start`, { method: 'POST' })
}

export function resolveIncident(id: number, input: ResolveInput): Promise<IncidentDetail> {
  return apiRequest(`${base(id)}/resolve`, { method: 'POST', body: jsonBody(input) })
}

export function closeIncident(id: number): Promise<IncidentDetail> {
  return apiRequest(`${base(id)}/close`, { method: 'POST' })
}

export function listWorkLogs(id: number, signal?: AbortSignal): Promise<Page<WorkLog>> {
  return apiRequest(`${base(id)}/work-logs${buildQuery({ page_size: 100 })}`, {
    signal: signal ?? null,
  })
}

export function addWorkLog(id: number, input: WorkLogInput): Promise<WorkLog> {
  return apiRequest(`${base(id)}/work-logs`, { method: 'POST', body: jsonBody(input) })
}
