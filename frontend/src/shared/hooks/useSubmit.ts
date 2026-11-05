import { useCallback, useState } from 'react'
import { ApiError, errorMessage } from '../api/client'

export interface SubmitState {
  pending: boolean
  error: string | null
  fieldErrors: Record<string, string>
}

const IDLE: SubmitState = { pending: false, error: null, fieldErrors: {} }

/**
 * Envía una mutación una sola vez a la vez y expone el error general y por campo.
 * Devuelve el resultado o `undefined` si falló.
 */
export function useSubmit(): {
  state: SubmitState
  submit: <T>(action: () => Promise<T>) => Promise<T | undefined>
  reset: () => void
} {
  const [state, setState] = useState<SubmitState>(IDLE)

  const submit = useCallback(async <T,>(action: () => Promise<T>) => {
    setState({ pending: true, error: null, fieldErrors: {} })
    try {
      const result = await action()
      setState(IDLE)
      return result
    } catch (error) {
      setState({
        pending: false,
        error: errorMessage(error),
        fieldErrors: error instanceof ApiError ? error.fieldErrors() : {},
      })
      return undefined
    }
  }, [])

  const reset = useCallback(() => {
    setState(IDLE)
  }, [])

  return { state, submit, reset }
}
