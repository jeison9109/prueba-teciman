import { useAsyncData, type AsyncState } from '../../shared/hooks/useAsyncData'
import type { Option } from '../../shared/utils/options'
import { listPeople } from './api'
import { SPECIALTY_LABELS } from './labels'

/** Técnicos activos, los únicos asignables. */
export function useTechnicianOptions(): { state: AsyncState<Option[]>; reload: () => void } {
  return useAsyncData('technician-options', async (signal) => {
    const page = await listPeople({ role: 'tecnico', active: 'true', page_size: 100 }, signal)
    return page.items.map((person) => ({
      value: String(person.id),
      label: person.specialty
        ? `${person.full_name} · ${SPECIALTY_LABELS[person.specialty]}`
        : person.full_name,
    }))
  })
}
