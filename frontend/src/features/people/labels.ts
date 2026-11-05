import type { Role, Specialty } from './api'

export const ROLE_LABELS: Record<Role, string> = {
  tecnico: 'Técnico',
  operario: 'Operario',
  responsable: 'Responsable',
}

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  mecanica: 'Mecánica',
  electrica: 'Eléctrica',
  electronica: 'Electrónica',
  hidraulica: 'Hidráulica',
  neumatica: 'Neumática',
}
