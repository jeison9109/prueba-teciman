import { useNavigate } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { PageHeader } from '../../shared/components/PageHeader'
import { useSubmit } from '../../shared/hooks/useSubmit'
import { createPerson } from './api'
import { PersonForm } from './PersonForm'

export function PersonCreatePage() {
  const navigate = useNavigate()
  const { refresh } = useActor()
  const { state, submit } = useSubmit()

  return (
    <section aria-labelledby="person-create-title">
      <PageHeader
        titleId="person-create-title"
        back={{ to: '/personas', label: 'Personas' }}
        title="Nueva persona"
        description="Los campos marcados con * son obligatorios."
      />
      <div className="card">
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
      </div>
    </section>
  )
}
