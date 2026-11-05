import { vi } from 'vitest'

export interface MockCall {
  method: string
  path: string
  headers: Headers
  body: unknown
}

export type Handler = (call: MockCall) => { status?: number; body?: unknown }
export type Route = readonly [RegExp, Handler]

/**
 * Sustituye `fetch` por un enrutador mínimo. Las rutas se comparan sin el prefijo /api/v1,
 * incluida la query (p. ej. "GET /machines?status=en_averia"). Gana la primera que encaje.
 */
export function mockApi(routes: readonly Route[]): MockCall[] {
  const calls: MockCall[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const path = input.replace(/^\/api\/v1/, '')
      const method = (init?.method ?? 'GET').toUpperCase()
      const call: MockCall = {
        method,
        path,
        headers: new Headers(init?.headers),
        body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null,
      }
      calls.push(call)
      const route = routes.find(([pattern]) => pattern.test(`${method} ${path}`))
      if (!route) return Promise.resolve(new Response(null, { status: 404 }))
      const { status = 200, body } = route[1](call)
      const payload = body === undefined ? null : JSON.stringify(body)
      return Promise.resolve(new Response(payload, { status }))
    }),
  )
  return calls
}

export function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 25 }
}

export const boss = {
  id: 1,
  full_name: 'Rosa Responsable',
  role: 'responsable',
  specialty: null,
  email: null,
  phone: null,
  hourly_cost: null,
  active: true,
  created_at: '2026-11-05T10:00:00Z',
  updated_at: '2026-11-05T10:00:00Z',
}

export const technician = {
  ...boss,
  id: 2,
  full_name: 'Tomás Técnico',
  role: 'tecnico',
  specialty: 'mecanica',
}

export const machine = {
  id: 7,
  code: 'PRE-004',
  name: 'Prensa 4',
  type: 'Prensa',
  manufacturer: null,
  model: null,
  serial_number: null,
  location: 'Nave 1',
  commissioning_date: null,
  criticality: 'alta',
  admin_status: 'operativa',
  status: 'en_averia',
  created_at: '2026-11-05T10:00:00Z',
  updated_at: '2026-11-05T10:00:00Z',
}

export const operator = {
  ...boss,
  id: 3,
  full_name: 'Olga Operaria',
  role: 'operario',
}

export const helper = {
  ...technician,
  id: 4,
  full_name: 'Teresa Técnica',
}

/** Avería abierta con parada; las pruebas cambian estado y técnico según el caso. */
export const incident = {
  id: 1,
  number: 'AV-2026-0001',
  status: 'abierta',
  title: 'Fuga de aceite',
  failure_type: 'hidraulico',
  priority: 'alta',
  machine_stopped: true,
  detected_at: '2026-11-05T07:30:00Z',
  machine: { id: 7, code: 'PRE-004', name: 'Prensa 4', status: 'en_averia' },
  reported_by: { id: 3, full_name: 'Olga Operaria' },
  assigned_technician: null as { id: number; full_name: string } | null,
  resolved_at: null as string | null,
  closed_at: null as string | null,
  worked_minutes: 0,
  downtime_hours: null as number | null,
  symptom: 'Charco bajo el cilindro',
  root_cause: null as string | null,
  solution: null as string | null,
  replaced_parts: null,
  solution_type: null,
  preventive_recommendation: null,
  closed_by: null as { id: number; full_name: string } | null,
  created_at: '2026-11-05T07:31:00Z',
  updated_at: '2026-11-05T07:31:00Z',
}
