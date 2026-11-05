/** Cliente HTTP común. Las features construyen sus llamadas sobre `apiRequest`. */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
export const ACTOR_HEADER = 'X-Actor-Id'

export interface ApiFieldError {
  field: string
  message: string
}

/** Formato común de error de la API (ver README, «Formato de error»). */
export interface ApiErrorBody {
  code: string
  message: string
  fields: ApiFieldError[]
}

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  readonly code: string
  readonly fields: ApiFieldError[]

  constructor(status: number, message: string, body: unknown) {
    const parsed = isApiErrorBody(body) ? body : null
    super(parsed?.message ?? message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.code = parsed?.code ?? 'http_error'
    this.fields = parsed?.fields ?? []
  }

  /** Mensajes por campo para mostrarlos junto a cada control. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.fields.map((item) => [item.field, item.message]))
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<ApiErrorBody>).code === 'string' &&
    typeof (value as Partial<ApiErrorBody>).message === 'string' &&
    Array.isArray((value as Partial<ApiErrorBody>).fields)
  )
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Error desconocido'
}

// Actor simulado: lo fija el selector de persona activa y se envía en cada escritura.
let currentActorId: number | null = null

export function setRequestActor(actorId: number | null): void {
  currentActorId = actorId
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export type QueryValue = string | number | boolean | null | undefined

export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && currentActorId !== null) {
    headers.set(ACTOR_HEADER, String(currentActorId))
  }
  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con la API', null)
  }
  const body = await readBody(response)
  if (!response.ok) {
    throw new ApiError(response.status, `La API respondió ${String(response.status)}`, body)
  }
  return body as T
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value)
}
