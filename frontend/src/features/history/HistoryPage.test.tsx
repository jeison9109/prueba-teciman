import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App'
import { boss, machine, mockApi, page, type Route } from '../../test/mockApi'

const repaired = {
  id: 9,
  number: 'AV-2026-0009',
  status: 'cerrada',
  title: 'Pérdida de presión',
  failure_type: 'hidraulico',
  machine: { id: 7, code: 'PRE-004', name: 'Prensa 4', status: 'de_baja' },
  detected_at: '2026-10-01T06:00:00Z',
  resolved_at: '2026-10-01T09:15:00Z',
  closed_at: '2026-10-02T08:00:00Z',
  assigned_technician: { id: 2, full_name: 'Tomás Técnico' },
  symptom: 'Fuga de aceite en el cilindro',
  root_cause: 'Junta tórica cristalizada',
  solution: 'Sustitución de la junta y purga del circuito',
  solution_type: 'sustitucion',
  replaced_parts: 'Junta NBR 80x5 (1 ud.)',
  worked_minutes: 120,
  downtime_hours: 3.25,
}

function baseRoutes(): Route[] {
  return [
    [/^GET \/config$/, () => ({ body: { operation_timezone: 'Europe/Madrid' } })],
    [/^GET \/people\?active=true&page_size=100$/, () => ({ body: page([boss]) })],
    [/^GET \/people\?page_size=1$/, () => ({ body: { ...page([]), total: 1 } })],
    [/^GET \/machines\?page_size=100$/, () => ({ body: page([machine]) })],
  ]
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('histórico de conocimiento', () => {
  it('muestra máquina, síntoma, causa y solución con enlace al detalle', async () => {
    const calls = mockApi([
      ...baseRoutes(),
      [/^GET \/incidents\/history/, () => ({ body: page([repaired]) })],
    ])
    renderAt('/historico?q=junta&machine_id=7')

    const results = await screen.findByRole('list', { name: 'Resultados' })
    const card = within(results).getByRole('article')
    expect(within(card).getByRole('link', { name: /AV-2026-0009/ })).toHaveAttribute(
      'href',
      '/averias/9',
    )
    expect(within(card).getByRole('link', { name: 'PRE-004' })).toHaveAttribute(
      'href',
      '/maquinas/7',
    )
    expect(within(card).getByText('De baja')).toBeInTheDocument()
    expect(within(card).getByText('Fuga de aceite en el cilindro')).toBeInTheDocument()
    expect(within(card).getByText('Junta tórica cristalizada')).toBeInTheDocument()
    expect(
      within(card).getByText('Sustitución de la junta y purga del circuito'),
    ).toBeInTheDocument()
    // 09:15 UTC son las 11:15 en Madrid (horario de verano).
    expect(
      within(card).getByText(/01\/10\/2026 11:15 por Tomás Técnico · 2,00 h/),
    ).toBeInTheDocument()
    // Los filtros de la URL llegan a la API y rellenan el formulario.
    expect(
      calls.some(
        (call) => call.path === '/incidents/history?q=junta&machine_id=7&page=1&page_size=25',
      ),
    ).toBe(true)
    expect(screen.getByLabelText('Buscar')).toHaveValue('junta')
  })

  it('aplica los textos al enviar, combinados en una sola consulta', async () => {
    const calls = mockApi([
      ...baseRoutes(),
      [/^GET \/incidents\/history/, () => ({ body: page([]) })],
    ])
    renderAt('/historico')

    expect(
      await screen.findByText('Todavía no hay averías resueltas ni cerradas.'),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Síntoma'), { target: { value: ' fuga ' } })
    fireEvent.change(screen.getByLabelText('Causa raíz'), { target: { value: 'junta' } })
    // Escribir no consulta: solo al pulsar Buscar.
    expect(calls.filter((call) => call.path.startsWith('/incidents/history'))).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => {
      expect(
        calls.some(
          (call) =>
            call.path === '/incidents/history?symptom=fuga&root_cause=junta&page=1&page_size=25',
        ),
      ).toBe(true)
    })
    expect(
      await screen.findByText('Ninguna reparación documentada coincide con la búsqueda.'),
    ).toBeInTheDocument()
  })

  it('muestra el error de la API con opción de reintentar', async () => {
    mockApi([
      ...baseRoutes(),
      [
        /^GET \/incidents\/history/,
        () => ({
          status: 503,
          body: { code: 'database_unavailable', message: 'Sin base de datos', fields: [] },
        }),
      ],
    ])
    renderAt('/historico')

    expect(await screen.findByText(/Sin base de datos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument()
  })
})
