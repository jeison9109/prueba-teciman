import type { Criticality, EditableAdminStatus, MachineStatus } from './api'

export const STATUS_LABELS: Record<MachineStatus, string> = {
  operativa: 'Operativa',
  en_averia: 'En avería',
  fuera_de_servicio: 'Fuera de servicio',
  de_baja: 'De baja',
}

export const ADMIN_STATUS_LABELS: Record<EditableAdminStatus, string> = {
  operativa: 'Operativa',
  fuera_de_servicio: 'Fuera de servicio',
}

export const CRITICALITY_LABELS: Record<Criticality, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}
