import { describe, expect, it } from 'vitest'
import { formatDateTime, localDate, localDateTimeInput } from './datetime'
import { parseHours } from './hours'

describe('datetime', () => {
  it('muestra instantes en la zona de operación y no en la del navegador', () => {
    expect(formatDateTime('2026-11-05T09:30:00Z', 'Europe/Madrid')).toBe('05/11/2026 10:30')
    expect(formatDateTime('2026-07-01T22:15:00Z', 'Europe/Madrid')).toBe('02/07/2026 00:15')
    expect(formatDateTime('2026-11-05T09:30:00Z', 'America/New_York')).toBe('05/11/2026 04:30')
    expect(formatDateTime(null, 'Europe/Madrid')).toBe('—')
  })

  it('da la hora y el día locales para los campos de fecha', () => {
    const instant = new Date('2026-12-31T23:30:00Z')
    expect(localDateTimeInput(instant, 'Europe/Madrid')).toBe('2027-01-01T00:30')
    expect(localDate(instant, 'Europe/Madrid')).toBe('2027-01-01')
    expect(localDate(instant, 'UTC')).toBe('2026-12-31')
  })
})

describe('parseHours', () => {
  it('admite coma o punto en tramos de 0,25 h', () => {
    expect(parseHours('1,25')).toEqual({ ok: true, value: '1.25' })
    expect(parseHours(' 0.75 ')).toEqual({ ok: true, value: '0.75' })
    expect(parseHours('2')).toEqual({ ok: true, value: '2' })
  })

  it('rechaza cero, negativos, fracciones no válidas y texto', () => {
    expect(parseHours('0')).toEqual({ ok: false, error: 'Las horas deben ser mayores que cero' })
    expect(parseHours('-1')).toMatchObject({ ok: false })
    expect(parseHours('0,10')).toEqual({ ok: false, error: 'Las horas van en tramos de 0,25 h' })
    expect(parseHours('abc')).toMatchObject({ ok: false })
    expect(parseHours('')).toMatchObject({ ok: false })
    expect(parseHours('25')).toEqual({ ok: false, error: 'Máximo 24 h por imputación' })
  })
})
