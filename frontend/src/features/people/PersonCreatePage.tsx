import { useNavigate } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { useSubmit } from '../../shared/hooks/useSubmit'
import { createPerson } from './api'
import { PersonForm } from './PersonForm'

export function PersonCreatePage() {
  const navigate = useNavigate()
  const { refresh } = useActor()
  const { state, submit } = useSubmit()

  return (
    <section aria-labelledby="person-create-title">
      <h1 id="person-create-title">Nueva persona</h1>
      <PersonForm
        submitLabel="Crear persona"
        submitState={state}
        onCancel={() => {
          void navigate('/personas')
        }}
        onSubmit={(input) => {
          void submit(() => createPerson(input)).then((person) => {
            if (!person) return
            refresh()
            void navigate(`/personas/${String(person.id)}`, { state: { notice: 'Persona creada' } })
          })
        }}
      />
    </section>
  )
}
