import type { Person } from '../people/api'
import type { Incident } from './api'

export type IncidentAction = 'assign' | 'reassign' | 'start' | 'resolve' | 'close' | 'log'

/**
 * Acciones que la interfaz ofrece al actor según el estado (spec.md, «Ciclo de vida»).
 * Solo guía al usuario: la API vuelve a comprobar rol, estado y técnico asignado.
 */
export function availableActions(incident: Incident, actor: Person | null): IncidentAction[] {
  if (!actor?.active) return []
  const isManager = actor.role === 'responsable'
  const isTechnician = actor.role === 'tecnico'
  const isAssigned = isTechnician && incident.assigned_technician?.id === actor.id
  const actions: IncidentAction[] = []
  switch (incident.status) {
    case 'abierta':
      if (isManager) actions.push('assign')
      break
    case 'asignada':
      if (isAssigned) actions.push('start')
      if (isManager) actions.push('reassign')
      break
    case 'en_curso':
      if (isTechnician) actions.push('log')
      if (isAssigned) actions.push('resolve')
      if (isManager) actions.push('reassign')
      break
    case 'resuelta':
      if (isManager) actions.push('close')
      break
    case 'cerrada':
      break
  }
  return actions
}
