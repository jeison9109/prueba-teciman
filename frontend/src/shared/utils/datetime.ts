/**
 * Instantes y fechas en la zona de operación. La API guarda instantes en UTC; la interfaz
 * los muestra y los pide en la zona configurada (GET /config), no en la del navegador.
 */

export const DEFAULT_TIMEZONE = 'Europe/Madrid'

function parts(instant: Date, timeZone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]))
}

/** Instante ISO a "dd/mm/aaaa hh:mm" en la zona de operación. */
export function formatDateTime(value: string | null, timeZone: string): string {
  if (!value) return '—'
  const instant = new Date(value)
  if (Number.isNaN(instant.getTime())) return value
  const p = parts(instant, timeZone)
  return `${p.day ?? ''}/${p.month ?? ''}/${p.year ?? ''} ${p.hour ?? ''}:${p.minute ?? ''}`
}

/** Hora local de operación para un `<input type="datetime-local">`: "aaaa-mm-ddThh:mm". */
export function localDateTimeInput(instant: Date, timeZone: string): string {
  const p = parts(instant, timeZone)
  return `${p.year ?? ''}-${p.month ?? ''}-${p.day ?? ''}T${p.hour ?? ''}:${p.minute ?? ''}`
}

/** Día local de operación: "aaaa-mm-dd". */
export function localDate(instant: Date, timeZone: string): string {
  return localDateTimeInput(instant, timeZone).slice(0, 10)
}
