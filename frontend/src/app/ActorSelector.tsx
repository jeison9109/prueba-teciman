import { ROLE_LABELS } from '../features/people/labels'
import { useActor } from './ActorContext'

export function ActorSelector() {
  const { state, actor, selectActor } = useActor()
  const people = state.kind === 'ready' ? state.data.activePeople : []
  return (
    <div className="actor">
      <label htmlFor="actor-select">Persona activa</label>
      <select
        id="actor-select"
        value={actor ? String(actor.id) : ''}
        disabled={state.kind !== 'ready'}
        onChange={(event) => {
          selectActor(event.target.value ? Number(event.target.value) : null)
        }}
      >
        <option value="">Solo consulta</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.full_name} · {ROLE_LABELS[person.role]}
          </option>
        ))}
      </select>
    </div>
  )
}
