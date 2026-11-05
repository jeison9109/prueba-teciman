import type { FailureType, IncidentStatus, Priority, SolutionType } from './api'

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  abierta: 'Abierta',
  asignada: 'Asignada',
  en_curso: 'En curso',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

export const FAILURE_TYPE_LABELS: Record<FailureType, string> = {
  mecanico: 'Mecánico',
  electrico: 'Eléctrico',
  electronico: 'Electrónico',
  hidraulico: 'Hidráulico',
  neumatico: 'Neumático',
  software: 'Software',
  otro: 'Otro',
}

export const SOLUTION_TYPE_LABELS: Record<SolutionType, string> = {
  definitiva: 'Definitiva',
  provisional: 'Provisional',
  sustitucion: 'Sustitución',
  ajuste: 'Ajuste',
}
