import type { IncidentStatus } from './api'

/** Qué falta para avanzar la avería y quién debe hacerlo. Solo orienta: la API decide. */
export const NEXT_STEP: Record<IncidentStatus, { title: string; text: string }> = {
  abierta: {
    title: 'Pendiente de asignar',
    text: 'Un responsable debe asignarla a un técnico de mantenimiento activo.',
  },
  asignada: {
    title: 'Pendiente de iniciar',
    text: 'El técnico asignado debe iniciar el trabajo para poder imputar horas.',
  },
  en_curso: {
    title: 'Trabajo en curso',
    text: 'Los técnicos imputan horas. Para resolverla hay que documentar la causa raíz y la solución aplicada.',
  },
  resuelta: {
    title: 'Pendiente de validación',
    text: 'Un responsable debe revisar la solución documentada y cerrar la avería.',
  },
  cerrada: {
    title: 'Cerrada y validada',
    text: 'La reparación queda en el histórico como conocimiento reutilizable.',
  },
}
