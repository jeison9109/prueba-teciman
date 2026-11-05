import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App'
import {
  boss,
  helper,
  incident,
  machine,
  mockApi,
  operator,
  page,
  technician,
  type Route,
} from '../../test/mockApi'

const tomas = { id: technician.id, full_name: technician.full_name }

function renderAt(path: string, actorId: number | null) {
  if (actorId !== null) localStorage.setItem('mantenimiento.actorId', String(actorId))
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function baseRoutes(timeZone = 'Europe/Madrid'): Route[] {
  const people = [boss, technician, operator, helper]
  return [
    [/^GET \/config$/, () => ({ body: { operation_timezone: timeZone } })],
    [/^GET \/people\?active=true&page_size=100$/, () => ({ body: page(people) })],
    [/^GET \/people\?page_size=1$/, () => ({ body: { ...page([]), total: people.length } })],
    [
      /^GET \/people\?role=tecnico/,
      () => ({ body: page([technician, helper]) }),
    ],
    [/^GET \/machines\?page_size=100$/, () => ({ body: page([machine]) })],
  ]
}

function withIncident(overrides: Partial<typeof incident>, extra: Route[] = []): Route[] {
  return [
    ...extra,
    ...baseRoutes(),
    [/^GET \/incidents\/1\/work-logs/, () => ({ body: page([]) })],
    [/^GET \/incidents\/1$/, () => ({ body: { ...incident, ...overrides } })],
  ]
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('averías', () => {
  it('la bandeja lee los filtros de la URL y enlaza al detalle', async () => {
    const calls = mockApi([
      ...baseRoutes(),
      [/^GET \/incidents\?/, () => ({ body: page([{ ...incident, assigned_technician: tomas }]) })],
    ])
    renderAt('/averias?status=abierta&priority=alta', 3)

    const table = await screen.findByRole('table')
    expect(within(table).getByRole('link', { name: 'AV-2026-0001' })).toHaveAttribute(
      'href',
      '/averias/1',
    )
    expect(within(table).getByText('Tomás Técnico')).toBeInTheDocument()
    // 07:30 UTC es 08:30 en Madrid.
    expect(within(table).getByText('05/11/2026 08:30')).toBeInTheDocument()
    expect(calls.some((call) => call.path.startsWith('/incidents?status=abierta&priority=alta'))).toBe(
      true,
    )
    expect(screen.getByRole('link', { name: 'Registrar avería' })).toBeInTheDocument()
  })

  it('registra con el actor y muestra los errores de la API junto a cada campo', async () => {
    const calls = mockApi([
      ...baseRoutes(),
      [
        /^POST \/incidents$/,
        () => ({
          status: 422,
          body: {
            code: 'validation_error',
            message: 'Hay datos no válidos',
            fields: [
              { field: 'title', message: 'No puede estar vacío' },
              { field: 'machine_stopped', message: 'Campo obligatorio' },
            ],
          },
        }),
      ],
    ])
    renderAt('/averias/nueva?machine_id=7', 3)

    const machineSelect = await screen.findByLabelText(/^Máquina/)
    await waitFor(() => {
      expect(machineSelect).toHaveValue('7')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar avería' }))

    const stopped = screen.getByLabelText(/¿Ha parado la máquina\?/)
    await waitFor(() => {
      expect(stopped).toHaveAttribute('aria-invalid', 'true')
    })
    expect(stopped).toHaveAccessibleDescription(/Campo obligatorio/)
    expect(screen.getByLabelText(/^Título/)).toHaveAccessibleDescription(/No puede estar vacío/)
    const post = calls.find((call) => call.method === 'POST')
    expect(post?.headers.get('X-Actor-Id')).toBe('3')
    expect(post?.body).toMatchObject({ machine_id: 7 })
    expect(post?.body).not.toHaveProperty('machine_stopped')
    // Hora local de operación sin zona: la API la interpreta en Europe/Madrid.
    expect((post?.body as { detected_at: string }).detected_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/)
  })

  it('el responsable asigna una avería abierta a un técnico activo', async () => {
    let current = { ...incident }
    const calls = mockApi([
      [
        /^POST \/incidents\/1\/assign$/,
        () => {
          current = { ...current, status: 'asignada', assigned_technician: tomas }
          return { body: current }
        },
      ],
      [/^GET \/incidents\/1$/, () => ({ body: current })],
      ...withIncident({}),
    ])
    renderAt('/averias/1', 1)

    const technicianSelect = await screen.findByLabelText(/^Técnico/)
    await screen.findByRole('option', { name: /Teresa Técnica/ })
    expect(screen.queryByRole('button', { name: 'Iniciar trabajo' })).not.toBeInTheDocument()
    fireEvent.change(technicianSelect, { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }))

    expect(await screen.findByText('Avería asignada')).toBeInTheDocument()
    expect(screen.getByText('Tomás Técnico', { selector: 'dd' })).toBeInTheDocument()
    const post = calls.find((call) => call.method === 'POST')
    expect(post?.body).toEqual({ technician_id: 2 })
    expect(post?.headers.get('X-Actor-Id')).toBe('1')
    // Ya asignada: se ofrece reasignar, sin el técnico actual entre las opciones.
    const reassign = await screen.findByLabelText(/^Reasignar a/)
    expect(within(reassign).queryByRole('option', { name: /Tomás/ })).not.toBeInTheDocument()
  })

  it('solo el técnico asignado ve iniciar; el operario no ve acciones', async () => {
    mockApi(withIncident({ status: 'asignada', assigned_technician: tomas }))
    const { unmount } = renderAt('/averias/1', 2)
    expect(await screen.findByRole('button', { name: 'Iniciar trabajo' })).toBeEnabled()
    unmount()

    localStorage.clear()
    renderAt('/averias/1', 3)
    expect(await screen.findByRole('heading', { name: /AV-2026-0001/ })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Acciones' })).not.toBeInTheDocument()
  })

  it('un técnico colaborador imputa horas con coma y valida los tramos antes de enviar', async () => {
    const calls = mockApi(
      withIncident({ status: 'en_curso', assigned_technician: tomas }, [
        [
          /^POST \/incidents\/1\/work-logs$/,
          () => ({
            status: 201,
            body: {
              id: 9,
              incident_id: 1,
              technician: { id: 4, full_name: 'Teresa Técnica' },
              work_date: '2026-11-05',
              minutes: 75,
              description: 'Cambio de junta',
              created_at: '2026-11-05T10:00:00Z',
            },
          }),
        ],
      ]),
    )
    renderAt('/averias/1', 4)

    const hours = await screen.findByRole('textbox', { name: /^Horas/ })
    expect(screen.queryByRole('button', { name: 'Resolver' })).not.toBeInTheDocument()
    fireEvent.change(hours, { target: { value: '0,10' } })
    fireEvent.change(screen.getByLabelText(/Trabajo realizado/), {
      target: { value: 'Cambio de junta' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Imputar horas' }))
    expect(hours).toHaveAccessibleDescription(/tramos de 0,25 h/)
    expect(calls.some((call) => call.method === 'POST')).toBe(false)

    fireEvent.change(hours, { target: { value: '1,25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Imputar horas' }))
    expect(await screen.findByText('Imputadas 1,25 h')).toBeInTheDocument()
    const post = calls.find((call) => call.method === 'POST')
    expect(post?.body).toMatchObject({ hours: '1.25', description: 'Cambio de junta' })
    expect(post?.headers.get('X-Actor-Id')).toBe('4')
  })

  it('el asignado resuelve y ve los errores de causa y solución', async () => {
    const calls = mockApi(
      withIncident({ status: 'en_curso', assigned_technician: tomas }, [
        [
          /^POST \/incidents\/1\/resolve$/,
          () => ({
            status: 422,
            body: {
              code: 'validation_error',
              message: 'Hay datos no válidos',
              fields: [{ field: 'root_cause', message: 'No puede estar vacío' }],
            },
          }),
        ],
      ]),
    )
    renderAt('/averias/1', 2)

    fireEvent.click(await screen.findByRole('button', { name: 'Resolver' }))
    fireEvent.change(screen.getByLabelText(/Solución aplicada/), { target: { value: 'Junta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como resuelta' }))
    const cause = screen.getByLabelText(/Causa raíz/)
    await waitFor(() => {
      expect(cause).toHaveAccessibleDescription(/No puede estar vacío/)
    })
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      root_cause: '',
      solution: 'Junta',
      replaced_parts: null,
      solution_type: null,
      preventive_recommendation: null,
    })
  })

  it('el responsable cierra una resuelta y el detalle muestra la documentación completa', async () => {
    const resolved = {
      status: 'resuelta',
      assigned_technician: tomas,
      resolved_at: '2026-11-05T09:30:00Z',
      root_cause: 'Junta desgastada',
      solution: 'Cambio de junta',
      worked_minutes: 120,
      downtime_hours: 2,
    }
    const calls = mockApi(
      withIncident(resolved, [
        [/^POST \/incidents\/1\/close$/, () => ({ body: { ...incident, ...resolved } })],
      ]),
    )
    renderAt('/averias/1', 1)

    expect(await screen.findByText('Junta desgastada')).toBeInTheDocument()
    expect(screen.getByText('05/11/2026 10:30')).toBeInTheDocument()
    expect(screen.getAllByText('2,00 h')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar y validar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
    expect(await screen.findByText('Avería cerrada y validada')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST')?.path).toBe('/incidents/1/close')
  })

  it('muestra las horas en la zona de operación configurada', async () => {
    mockApi([
      [/^GET \/config$/, () => ({ body: { operation_timezone: 'America/New_York' } })],
      ...withIncident({}),
    ])
    renderAt('/averias/1', null)
    expect(await screen.findByText('05/11/2026 02:30')).toBeInTheDocument()
    expect(screen.getByText('Parada en curso')).toBeInTheDocument()
  })
})
