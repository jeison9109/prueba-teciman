import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setRequestActor } from '../shared/api/client'
import { useAsyncData, type AsyncState } from '../shared/hooks/useAsyncData'
import { listPeople, type Person } from '../features/people/api'

const STORAGE_KEY = 'mantenimiento.actorId'

function readStoredActor(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function storeActor(id: number | null): void {
  try {
    if (id === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, String(id))
  } catch {
    // Sin almacenamiento disponible: la selección dura lo que la pestaña.
  }
}

interface ActorData {
  activePeople: Person[]
  totalPeople: number
}

interface ActorContextValue {
  /** Personas activas y número total de personas (0 indica base vacía). */
  state: AsyncState<ActorData>
  actor: Person | null
  isManager: boolean
  selectActor: (id: number | null) => void
  /** Vuelve a cargar las personas activas tras altas, bajas o cambios de rol. */
  refresh: () => void
}

const ActorContext = createContext<ActorContextValue | null>(null)

async function loadActors(signal: AbortSignal): Promise<ActorData> {
  const [active, all] = await Promise.all([
    listPeople({ active: 'true', page_size: 100 }, signal),
    listPeople({ page_size: 1 }, signal),
  ])
  return { activePeople: active.items, totalPeople: all.total }
}

/** Identidad simulada: la persona elegida se envía como `X-Actor-Id` en cada escritura. */
export function ActorProvider({ children }: { children: ReactNode }) {
  const { state, reload } = useAsyncData('actors', loadActors)
  const [selectedId, setSelectedId] = useState<number | null>(readStoredActor)

  const actor = useMemo(() => {
    if (state.kind !== 'ready') return null
    return state.data.activePeople.find((person) => person.id === selectedId) ?? null
  }, [state, selectedId])

  useEffect(() => {
    setRequestActor(actor?.id ?? null)
  }, [actor])

  const selectActor = useCallback((id: number | null) => {
    setSelectedId(id)
    storeActor(id)
    // Se aplica de inmediato para que una escritura justo después ya lleve el actor.
    setRequestActor(id)
  }, [])

  const value = useMemo<ActorContextValue>(
    () => ({
      state,
      actor,
      isManager: actor?.role === 'responsable',
      selectActor,
      refresh: reload,
    }),
    [state, actor, selectActor, reload],
  )

  return <ActorContext value={value}>{children}</ActorContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActor(): ActorContextValue {
  const value = useContext(ActorContext)
  if (!value) throw new Error('useActor debe usarse dentro de ActorProvider')
  return value
}
