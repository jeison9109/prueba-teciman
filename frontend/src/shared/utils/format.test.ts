import { describe, expect, it } from 'vitest'
import { formatDate, formatEuros, formatHours, orDash } from './format'

describe('format', () => {
  it('convierte minutos a horas con coma decimal', () => {
    expect(formatHours(120)).toBe('2,00 h')
    expect(formatHours(75)).toBe('1,25 h')
    expect(formatHours(0)).toBe('0,00 h')
  })

  it('muestra fechas en formato local sin cambiar el día', () => {
    expect(formatDate('2026-01-01')).toBe('01/01/2026')
    expect(formatDate(null)).toBe('—')
  })

  it('formatea euros y vacíos', () => {
    expect(formatEuros('35.50').replace(/\s/g, ' ')).toBe('35,50 €')
    expect(formatEuros(null)).toBe('—')
    expect(orDash('  ')).toBe('—')
  })
})
