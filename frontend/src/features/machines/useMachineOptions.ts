import { useAsyncData, type AsyncState } from '../../shared/hooks/useAsyncData'
import type { Option } from '../../shared/utils/options'
import { listMachines } from './api'

/**
 * Máquinas para un desplegable (la API limita la página a 100, suficiente para la demo).
 * `includeRetired: false` deja fuera las de baja, que no admiten nuevas averías.
 */
export function useMachineOptions({ includeRetired }: { includeRetired: boolean }): {
  state: AsyncState<Option[]>
  reload: () => void
} {
  return useAsyncData(`machine-options-${String(includeRetired)}`, async (signal) => {
    const page = await listMachines({ page_size: 100 }, signal)
    return page.items
      .filter((machine) => includeRetired || machine.status !== 'de_baja')
      .map((machine) => ({ value: String(machine.id), label: `${machine.code} · ${machine.name}` }))
  })
}
