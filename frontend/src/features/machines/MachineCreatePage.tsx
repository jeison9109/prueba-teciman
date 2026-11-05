import { useNavigate } from 'react-router'
import { useSubmit } from '../../shared/hooks/useSubmit'
import { createMachine } from './api'
import { MachineForm } from './MachineForm'

export function MachineCreatePage() {
  const navigate = useNavigate()
  const { state, submit } = useSubmit()
  return (
    <section aria-labelledby="machine-create-title">
      <h1 id="machine-create-title">Nueva máquina</h1>
      <MachineForm
        submitLabel="Crear máquina"
        submitState={state}
        onCancel={() => {
          void navigate('/maquinas')
        }}
        onSubmit={(input) => {
          void submit(() => createMachine(input)).then((machine) => {
            if (!machine) return
            void navigate(`/maquinas/${String(machine.id)}`, {
              state: { notice: 'Máquina creada' },
            })
          })
        }}
      />
    </section>
  )
}
