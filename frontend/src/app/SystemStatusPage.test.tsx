import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi } from '../test/mockApi'
import { SystemStatusPage } from './SystemStatusPage'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SystemStatusPage', () => {
  it('muestra la API operativa y la revisión aplicada', async () => {
    mockApi([[/^GET \/health$/, () => ({ body: { status: 'ok', database: 'ok', migration: '0001' } })]])
    render(<SystemStatusPage />)
    expect(await screen.findByText('API y base de datos operativas')).toBeInTheDocument()
    expect(screen.getByText('0001')).toBeInTheDocument()
  })

  it('explica que faltan migraciones cuando la API responde 503', async () => {
    mockApi([
      [
        /^GET \/health$/,
        () => ({ status: 503, body: { status: 'error', database: 'ok', migration: null } }),
      ],
    ])
    render(<SystemStatusPage />)
    expect(await screen.findByText('Base de datos sin migraciones aplicadas')).toBeInTheDocument()
  })

  it('indica cuando no puede conectar con la API', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    render(<SystemStatusPage />)
    expect(await screen.findByText('No se pudo conectar con la API')).toBeInTheDocument()
  })
})
