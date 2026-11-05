import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Filtros y página guardados en la URL, para que sobrevivan a la navegación.
 * Cambiar un filtro vuelve a la primera página.
 */
export function useUrlFilters<K extends string>(
  keys: readonly K[],
): {
  filters: Record<K, string>
  page: number
  setFilter: (key: K, value: string) => void
  setPage: (page: number) => void
  clear: () => void
} {
  const [params, setParams] = useSearchParams()
  const filters = Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ''])) as Record<
    K,
    string
  >
  const parsedPage = Number(params.get('page') ?? '1')
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const setFilter = useCallback(
    (key: K, value: string) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (value) next.set(key, value)
          else next.delete(key)
          next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setPage = useCallback(
    (value: number) => {
      setParams((previous) => {
        const next = new URLSearchParams(previous)
        if (value > 1) next.set('page', String(value))
        else next.delete('page')
        return next
      })
    },
    [setParams],
  )

  const clear = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true })
  }, [setParams])

  return { filters, page, setFilter, setPage, clear }
}
