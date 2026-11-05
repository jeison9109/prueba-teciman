import { describe, expect, it } from 'vitest'
import type { Person } from '../people/api'
import { availableActions } from './actions'
import type { Incident, IncidentStatus } from './api'

const person = (id: number, role: Person['role'], active = true): Person => ({
  id,
  full_name: `Persona ${String(id)}`,
  role,
  specialty: null,
  email: null,
  phone: null,
  hourly_cost: null,
  active,
  created_at: '',
  updated_at: '',
})

const boss = person(1, 'responsable')
const tech = person(2, 'tecnico')
const helper = person(3, 'tecnico')
const operator = person(4, 'operario')

function incident(status: IncidentStatus): Incident {
  return {
    id: 1,
    number: 'AV-2026-0001',
    status,
    title: 'Fuga',
    failure_type: 'hidraulico',
    priority: 'alta',
    machine_stopped: true,
    detected_at: '2026-11-05T08:00:00Z',
    machine: { id: 1, code: 'PRE-1', name: 'Prensa', status: 'en_averia' },
    reported_by: { id: 4, full_name: 'Persona 4' },
    assigned_technician: status === 'abierta' ? null : { id: 2, full_name: 'Persona 2' },
    resolved_at: null,
    closed_at: null,
    worked_minutes: 0,
    downtime_hours: null,
  }
}

describe('availableActions', () => {
  it('sigue el ciclo de vida con el actor que corresponde', () => {
    expect(availableActions(incident('abierta'), boss)).toEqual(['assign'])
    expect(availableActions(incident('asignada'), tech)).toEqual(['start'])
    expect(availableActions(incident('asignada'), boss)).toEqual(['reassign'])
    expect(availableActions(incident('en_curso'), tech)).toEqual(['log', 'resolve'])
    expect(availableActions(incident('en_curso'), boss)).toEqual(['reassign'])
    expect(availableActions(incident('resuelta'), boss)).toEqual(['close'])
    expect(availableActions(incident('cerrada'), boss)).toEqual([])
  })

  it('deja colaborar a otro técnico sin permitirle iniciar ni resolver', () => {
    expect(availableActions(incident('asignada'), helper)).toEqual([])
    expect(availableActions(incident('en_curso'), helper)).toEqual(['log'])
  })

  it('no ofrece acciones al operario, en solo consulta ni a personas inactivas', () => {
    for (const status of ['abierta', 'asignada', 'en_curso', 'resuelta'] as const) {
      expect(availableActions(incident(status), operator)).toEqual([])
      expect(availableActions(incident(status), null)).toEqual([])
    }
    expect(availableActions(incident('resuelta'), person(5, 'responsable', false))).toEqual([])
  })
})
