import { useState, type SubmitEvent } from 'react'
import { SelectField, TextAreaField } from '../../shared/components/Field'
import type { SubmitState } from '../../shared/hooks/useSubmit'
import { optionsFrom } from '../../shared/utils/options'
import type { ResolveInput, SolutionType } from './api'
import { SOLUTION_TYPE_LABELS } from './labels'

interface ResolveFormProps {
  submitState: SubmitState
  onSubmit: (input: ResolveInput) => void
  onCancel: () => void
}

function emptyToNull(value: string): string | null {
  return value.trim() ? value : null
}

/** Documentación de la reparación. Causa raíz y solución son obligatorias. */
export function ResolveForm({ submitState, onSubmit, onCancel }: ResolveFormProps) {
  const [values, setValues] = useState({
    root_cause: '',
    solution: '',
    replaced_parts: '',
    solution_type: '',
    preventive_recommendation: '',
  })
  const errors = submitState.fieldErrors
  const set = (key: keyof typeof values) => (value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }))
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({
      root_cause: values.root_cause,
      solution: values.solution,
      replaced_parts: emptyToNull(values.replaced_parts),
      solution_type: (values.solution_type || null) as SolutionType | null,
      preventive_recommendation: emptyToNull(values.preventive_recommendation),
    })
  }

  return (
    <form className="form form--grid card" onSubmit={handleSubmit} noValidate aria-label="Resolver avería">
      <TextAreaField
        label="Causa raíz"
        value={values.root_cause}
        onChange={set('root_cause')}
        error={errors.root_cause}
        maxLength={4000}
        required
      />
      <TextAreaField
        label="Solución aplicada"
        value={values.solution}
        onChange={set('solution')}
        error={errors.solution}
        maxLength={4000}
        required
      />
      <TextAreaField
        label="Repuestos"
        value={values.replaced_parts}
        onChange={set('replaced_parts')}
        error={errors.replaced_parts}
        hint="Referencia y cantidad, p. ej. JNT-45 x1"
        maxLength={4000}
        rows={2}
      />
      <SelectField
        label="Tipo de solución"
        value={values.solution_type}
        options={optionsFrom(SOLUTION_TYPE_LABELS)}
        onChange={set('solution_type')}
        error={errors.solution_type}
        emptyLabel="Sin indicar"
      />
      <div className="form__full">
        <TextAreaField
          label="Recomendación preventiva"
          value={values.preventive_recommendation}
          onChange={set('preventive_recommendation')}
          error={errors.preventive_recommendation}
          maxLength={4000}
          rows={2}
        />
      </div>
      <div className="actions form__full">
        <button type="submit" className="button--primary" disabled={submitState.pending}>
          {submitState.pending ? 'Enviando…' : 'Marcar como resuelta'}
        </button>
        <button type="button" onClick={onCancel} disabled={submitState.pending}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
