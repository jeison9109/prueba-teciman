import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, errorMessage } from '../api/client'

export type AsyncState<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: T }
  | { kind: 'error'; message: string; status: number | null }

const LOADING = { kind: 'loading' } as const

/**
 * Carga datos y los recarga cuando cambia `key` o se llama a `reload`.
 * `key` resume los parámetros de la consulta (p. ej. los filtros serializados).
 * El estado se asocia a la petición que lo produjo: mientras llega la nueva, es `loading`.
 */
export function useAsyncData<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
): { state: AsyncState<T>; reload: () => void } {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ token: string; state: AsyncState<T> } | null>(null)
  const loader = useRef(load)
  const token = `${key}#${String(attempt)}`

  useEffect(() => {
    loader.current = load
  })

  useEffect(() => {
    const controller = new AbortController()
    loader
      .current(controller.signal)
      .then((data) => {
        setResult({ token, state: { kind: 'ready', data } })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const status = error instanceof ApiError ? error.status : null
        setResult({ token, state: { kind: 'error', message: errorMessage(error), status } })
      })
    return () => {
      controller.abort()
    }
  }, [token])

  const reload = useCallback(() => {
    setAttempt((value) => value + 1)
  }, [])

  return { state: result?.token === token ? result.state : LOADING, reload }
}
