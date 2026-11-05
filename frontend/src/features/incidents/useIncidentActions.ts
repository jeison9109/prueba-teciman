import { useCallback } from 'react'
import { useSubmit, type SubmitState } from '../../shared/hooks/useSubmit'
import {
  assignIncident,
  closeIncident,
  reassignIncident,
  resolveIncident,
  startIncident,
  type ResolveInput,
} from './api'

export interface IncidentActions {
  state: SubmitState
  reset: () => void
  assign: (technicianId: number) => Promise<boolean>
  reassign: (technicianId: number) => Promise<boolean>
  start: () => Promise<boolean>
  resolve: (input: ResolveInput) => Promise<boolean>
  close: () => Promise<boolean>
}

/**
 * Acciones del ciclo de vida de una avería con un único envío pendiente a la vez.
 * Tras cada acción correcta llama a `onDone` con el aviso para que la página recargue.
 */
export function useIncidentActions(id: number, onDone: (notice: string) => void): IncidentActions {
  const { state, submit, reset } = useSubmit()

  const run = useCallback(
    async (action: () => Promise<unknown>, notice: string) => {
      const result = await submit(action)
      if (result === undefined) return false
      onDone(notice)
      return true
    },
    [submit, onDone],
  )

  return {
    state,
    reset,
    assign: (technicianId) => run(() => assignIncident(id, technicianId), 'Avería asignada'),
    reassign: (technicianId) => run(() => reassignIncident(id, technicianId), 'Avería reasignada'),
    start: () => run(() => startIncident(id), 'Trabajo iniciado'),
    resolve: (input) => run(() => resolveIncident(id, input), 'Avería resuelta'),
    close: () => run(() => closeIncident(id), 'Avería cerrada y validada'),
  }
}
