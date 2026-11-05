import { apiRequest, buildQuery, jsonBody } from '../../shared/api/client'
import type { Page } from '../../shared/api/types'

export type Role = 'tecnico' | 'operario' | 'responsable'
export type Specialty = 'mecanica' | 'electrica' | 'electronica' | 'hidraulica' | 'neumatica'

export interface Person {
  id: number
  full_name: string
  role: Role
  specialty: Specialty | null
  email: string | null
  phone: string | null
  /** Decimal exacto como texto, p. ej. "35.50". */
  hourly_cost: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface PersonDetail extends Person {
  worked_minutes: number
  open_assignments: number
}

export interface PersonInput {
  full_name: string
  role: Role
  specialty: Specialty | null
  email: string | null
  phone: string | null
  hourly_cost: string | null
}

export interface PeopleQuery {
  role?: string
  active?: string
  page?: number
  page_size?: number
}

export function listPeople(query: PeopleQuery, signal?: AbortSignal): Promise<Page<Person>> {
  return apiRequest(`/people${buildQuery({ ...query })}`, { signal: signal ?? null })
}

export function getPerson(id: number, signal?: AbortSignal): Promise<PersonDetail> {
  return apiRequest(`/people/${String(id)}`, { signal: signal ?? null })
}

export function createPerson(input: PersonInput): Promise<PersonDetail> {
  return apiRequest('/people', { method: 'POST', body: jsonBody(input) })
}

export function updatePerson(
  id: number,
  changes: Partial<PersonInput> & { active?: boolean },
): Promise<PersonDetail> {
  return apiRequest(`/people/${String(id)}`, { method: 'PATCH', body: jsonBody(changes) })
}

export function retirePerson(id: number): Promise<null> {
  return apiRequest(`/people/${String(id)}`, { method: 'DELETE' })
}
