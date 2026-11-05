export interface Option {
  value: string
  label: string
}

/** Etiquetas en español indexadas por valor estable de la API a opciones de un select. */
export function optionsFrom(labels: Record<string, string>): Option[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }))
}
