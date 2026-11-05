import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('muestra la API operativa y la revisión aplicada', async () => {
    mockFetch(200, { status: 'ok', database: 'ok', migration: '0001' })
    render(<App />)
    expect(await screen.findByText('API y base de datos operativas')).toBeInTheDocument()
    expect(screen.getByText('0001')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/v1/health', expect.anything())
  })

  it('explica que faltan migraciones cuando la API responde 503', async () => {
    mockFetch(503, { status: 'error', database: 'ok', migration: null })
    render(<App />)
    expect(await screen.findByText('Base de datos sin migraciones aplicadas')).toBeInTheDocument()
  })

  it('indica cuando no puede conectar con la API', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    render(<App />)
    expect(await screen.findByText('No se pudo conectar con la API')).toBeInTheDocument()
  })
})
