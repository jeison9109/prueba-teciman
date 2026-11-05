import { apiRequest, buildQuery, jsonBody } from '../../shared/api/client'
import type { Page } from '../../shared/api/types'

export type Criticality = 'alta' | 'media' | 'baja'
export type AdminStatus = 'operativa' | 'fuera_de_servicio' | 'de_baja'
export type MachineStatus = 'operativa' | 'en_averia' | 'fuera_de_servicio' | 'de_baja'
/** Condición administrativa elegible en el formulario; la baja va por DELETE. */
export type EditableAdminStatus = Exclude<AdminStatus, 'de_baja'>

export interface Machine {
  id: number
  code: string
  name: string
  type: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  location: string
  commissioning_date: string | null
  criticality: Criticality
  admin_status: AdminStatus
  /** Estado efectivo calculado por el backend. */
  status: MachineStatus
  created_at: string
  updated_at: string
}

export interface MachineDetail extends Machine {
  worked_minutes: number
  open_incidents: number
}

export interface MachineInput {
  code: string
  name: string
  type: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  location: string
  commissioning_date: string | null
  criticality: Criticality
  admin_status: EditableAdminStatus
}

export interface MachinesQuery {
  status?: string
  location?: string
  type?: string
  page?: number
  page_size?: number
}

export function listMachines(query: MachinesQuery, signal?: AbortSignal): Promise<Page<Machine>> {
  return apiRequest(`/machines${buildQuery({ ...query })}`, { signal: signal ?? null })
}

export function getMachine(id: number, signal?: AbortSignal): Promise<MachineDetail> {
  return apiRequest(`/machines/${String(id)}`, { signal: signal ?? null })
}

export function createMachine(input: MachineInput): Promise<MachineDetail> {
  return apiRequest('/machines', { method: 'POST', body: jsonBody(input) })
}

export function updateMachine(id: number, changes: Partial<MachineInput>): Promise<MachineDetail> {
  return apiRequest(`/machines/${String(id)}`, { method: 'PATCH', body: jsonBody(changes) })
}

export function retireMachine(id: number): Promise<null> {
  return apiRequest(`/machines/${String(id)}`, { method: 'DELETE' })
}
