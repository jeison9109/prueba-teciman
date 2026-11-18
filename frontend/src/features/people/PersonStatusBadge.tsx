export function PersonStatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`badge badge--${active ? 'operativa' : 'de_baja'}`}>
      {active ? 'Activa' : 'De baja'}
    </span>
  )
}
