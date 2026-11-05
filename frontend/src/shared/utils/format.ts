/** Formateo puro de horas y fechas para la interfaz (zona y formato locales). */

const LOCALE = 'es-ES'

const hoursFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Minutos enteros a horas con dos decimales y coma decimal: 120 → "2,00 h". */
export function formatHours(minutes: number): string {
  return `${hoursFormat.format(minutes / 60)} h`
}

const euroFormat = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'EUR' })

/** Decimal exacto recibido como texto ("35.50") a importe local. */
export function formatEuros(value: string | null): string {
  if (value === null) return '—'
  return euroFormat.format(Number(value))
}

/** Fecha ISO (AAAA-MM-DD) a formato local sin desplazar el día por la zona horaria. */
export function formatDate(value: string | null): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

/** Texto opcional para mostrar: nulo o vacío como guion. */
export function orDash(value: string | null | undefined): string {
  return value?.trim() ? value : '—'
}
