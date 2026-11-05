/** Horas decimales escritas por el usuario ("1,25" o "1.25") en el formato de la API. */

export type ParsedHours = { ok: true; value: string } | { ok: false; error: string }

const DECIMAL = /^\d+(\.\d+)?$/

export function parseHours(input: string): ParsedHours {
  const normalized = input.trim().replace(',', '.')
  if (!normalized) return { ok: false, error: 'Indica las horas' }
  if (!DECIMAL.test(normalized)) {
    return { ok: false, error: 'Usa un número positivo, p. ej. 1,25' }
  }
  const hours = Number(normalized)
  if (hours <= 0) return { ok: false, error: 'Las horas deben ser mayores que cero' }
  if (!Number.isInteger(hours * 4)) return { ok: false, error: 'Las horas van en tramos de 0,25 h' }
  if (hours > 24) return { ok: false, error: 'Máximo 24 h por imputación' }
  return { ok: true, value: normalized }
}
