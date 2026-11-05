import { useSubmit } from '../shared/hooks/useSubmit'
import { createPerson } from '../features/people/api'
import { PersonForm } from '../features/people/PersonForm'
import { useActor } from './ActorContext'

/** Base vacía: la API admite sin actor el alta del primer responsable. */
export function SetupPage() {
  const { selectActor, refresh } = useActor()
  const { state, submit } = useSubmit()
  return (
    <section className="card" aria-labelledby="setup-title">
      <h1 id="setup-title">Primer responsable</h1>
      <p>
        No hay ninguna persona registrada. Crea el primer responsable para empezar a gestionar
        máquinas y personas. Quedará seleccionado como persona activa.
      </p>
      <PersonForm
        fixedRole="responsable"
        submitLabel="Crear responsable"
        submitState={state}
        onSubmit={(input) => {
          void submit(() => createPerson(input)).then((person) => {
            if (!person) return
            selectActor(person.id)
            refresh()
          })
        }}
      />
    </section>
  )
}
