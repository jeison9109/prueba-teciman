import { ROLE_LABELS } from '../features/people/labels'
import { initials } from '../shared/utils/format'
import { useActor } from './ActorContext'

/** Identidad simulada de la demo: quién actúa en cada escritura. */
export function ActorSelector() {
  const { state, actor, selectActor } = useActor()
  const people = state.kind === 'ready' ? state.data.activePeople : []
  return (
    <div className="actor">
      <span className={`avatar${actor ? '' : ' avatar--empty'}`} aria-hidden="true">
        {actor ? initials(actor.full_name) : '?'}
      </span>
      <div className="actor__control">
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
    </div>
  )
}
