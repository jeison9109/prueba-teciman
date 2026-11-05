import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { boss, machine, mockApi, page, technician, type Route } from '../test/mockApi'
import { App } from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function peopleRoutes(people: unknown[]): Route[] {
  return [
    [/^GET \/people\?active=true/, () => ({ body: page(people) })],
    [/^GET \/people\?page_size=1$/, () => ({ body: { ...page([]), total: people.length } })],
  ]
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('con la base vacía pide el primer responsable y lo deja como persona activa', async () => {
    let created = false
    const calls = mockApi([
      [/^GET \/people\?active=true/, () => ({ body: page(created ? [boss] : []) })],
      [/^GET \/people\?page_size=1$/, () => ({ body: { ...page([]), total: created ? 1 : 0 } })],
      [
        /^POST \/people$/,
        () => {
          created = true
          return { status: 201, body: { ...boss, worked_minutes: 0, open_assignments: 0 } }
        },
      ],
      [/^GET \/machines/, () => ({ body: page([]) })],
    ])
    renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Primer responsable' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Rol/)).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Nombre y apellidos/), {
      target: { value: 'Rosa Responsable' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear responsable' }))

    expect(await screen.findByRole('heading', { name: 'Máquinas' })).toBeInTheDocument()
    const post = calls.find((call) => call.method === 'POST')
    expect(post?.headers.get('X-Actor-Id')).toBeNull()
    expect(post?.body).toMatchObject({ full_name: 'Rosa Responsable', role: 'responsable' })
    await waitFor(() => {
      expect(screen.getByLabelText('Persona activa')).toHaveValue('1')
    })
  })

  it('lee los filtros de la URL y oculta la gestión a quien no es responsable', async () => {
    const calls = mockApi([
      ...peopleRoutes([boss, technician]),
      [/^GET \/machines/, () => ({ body: page([machine]) })],
    ])
    localStorage.setItem('mantenimiento.actorId', '2')
    renderAt('/maquinas?status=en_averia&type=prensa')

    const table = await screen.findByRole('table')
    expect(within(table).getByText('En avería')).toBeInTheDocument()
    expect(calls.some((call) => call.path.startsWith('/machines?status=en_averia&type=prensa'))).toBe(
      true,
    )
    expect(screen.queryByRole('link', { name: 'Nueva máquina' })).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Tu rol solo permite consultar')

    fireEvent.change(screen.getByLabelText('Persona activa'), { target: { value: '1' } })
    expect(await screen.findByRole('link', { name: 'Nueva máquina' })).toBeInTheDocument()
  })

  it('envía el actor al crear una máquina y muestra los errores junto a cada campo', async () => {
    const calls = mockApi([
      ...peopleRoutes([boss]),
      [
        /^POST \/machines$/,
        () => ({
          status: 409,
          body: {
            code: 'machine_code_taken',
            message: 'Ya existe una máquina con ese código',
            fields: [{ field: 'code', message: 'Ya existe una máquina con ese código' }],
          },
        }),
      ],
    ])
    localStorage.setItem('mantenimiento.actorId', '1')
    renderAt('/maquinas/nueva')

    fireEvent.change(await screen.findByLabelText(/^Código/), { target: { value: 'pre-004' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear máquina' }))

    const codeInput = screen.getByLabelText(/^Código/)
    await waitFor(() => {
      expect(codeInput).toHaveAttribute('aria-invalid', 'true')
    })
    expect(codeInput).toHaveAccessibleDescription(/Ya existe una máquina con ese código/)
    expect(screen.getByRole('alert')).toHaveTextContent('Ya existe una máquina con ese código')
    const post = calls.find((call) => call.method === 'POST')
    expect(post?.headers.get('X-Actor-Id')).toBe('1')
  })

  it('impide dar de baja a un técnico con averías a su cargo', async () => {
    mockApi([
      ...peopleRoutes([boss, technician]),
      [
        /^GET \/people\/2$/,
        () => ({ body: { ...technician, worked_minutes: 120, open_assignments: 2 } }),
      ],
    ])
    localStorage.setItem('mantenimiento.actorId', '1')
    renderAt('/personas/2')

    expect(await screen.findByRole('heading', { name: 'Tomás Técnico' })).toBeInTheDocument()
    expect(screen.getByText('2,00 h')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dar de baja' })).toBeDisabled()
    expect(screen.getByText(/Reasígnalas antes de darla de baja/)).toBeInTheDocument()
  })

  it('muestra horas acumuladas y avisa de que la baja exige averías cerradas', async () => {
    mockApi([
      ...peopleRoutes([boss]),
      [/^GET \/machines\/7$/, () => ({ body: { ...machine, worked_minutes: 75, open_incidents: 1 } })],
    ])
    localStorage.setItem('mantenimiento.actorId', '1')
    renderAt('/maquinas/7')

    expect(await screen.findByText('1,25 h')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dar de baja' })).toBeDisabled()
  })
})
