import { useCallback, useEffect, useState } from 'react'
import { fetchHealth, type HealthStatus } from '../shared/api/health'

export type HealthState =
  | { kind: 'loading' }
  | { kind: 'ready'; health: HealthStatus }
  | { kind: 'unreachable'; message: string }

export function useHealth(): { state: HealthState; reload: () => void } {
  const [state, setState] = useState<HealthState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchHealth(controller.signal)
      .then((health) => {
        setState({ kind: 'ready', health })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({
          kind: 'unreachable',
          message: error instanceof Error ? error.message : 'Error desconocido',
        })
      })
    return () => {
      controller.abort()
    }
  }, [attempt])

  const reload = useCallback(() => {
    setState({ kind: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  return { state, reload }
}
