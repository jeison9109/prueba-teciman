import { ApiError, apiRequest } from './client'

export interface HealthStatus {
  status: 'ok' | 'error'
  database: 'ok' | 'error'
  migration: string | null
}

function isHealthStatus(value: unknown): value is HealthStatus {
  return typeof value === 'object' && value !== null && 'status' in value && 'database' in value
}

/** Devuelve el estado aunque la API responda 503, porque el cuerpo explica qué falla. */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthStatus> {
  try {
    return await apiRequest<HealthStatus>('/health', { signal: signal ?? null })
  } catch (error) {
    if (error instanceof ApiError && isHealthStatus(error.body)) {
      return error.body
    }
    throw error
  }
}
