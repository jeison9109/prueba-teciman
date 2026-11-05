import { createContext, useContext, type ReactNode } from 'react'
import { apiRequest } from '../shared/api/client'
import { useAsyncData } from '../shared/hooks/useAsyncData'
import { DEFAULT_TIMEZONE } from '../shared/utils/datetime'

interface PublicConfig {
  operation_timezone: string
}

function loadConfig(signal: AbortSignal): Promise<PublicConfig> {
  return apiRequest('/config', { signal })
}

const TimezoneContext = createContext<string>(DEFAULT_TIMEZONE)

/** Zona de operación del backend. Mientras carga, o si falla, se usa la zona por defecto. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { state } = useAsyncData('config', loadConfig)
  const timeZone = state.kind === 'ready' ? state.data.operation_timezone : DEFAULT_TIMEZONE
  return <TimezoneContext value={timeZone}>{children}</TimezoneContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTimezone(): string {
  return useContext(TimezoneContext)
}
