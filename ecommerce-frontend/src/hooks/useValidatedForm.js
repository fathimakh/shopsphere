import { useCallback, useId, useMemo, useState } from 'react'

/**
 * Controlled form state with "validate on blur, then live" behaviour.
 *
 * - `validate(values)` returns `{ field: message }` for invalid fields (see utils/validators).
 * - A field shows its error once it has been touched (blurred) or the form was submitted;
 *   from then on it re-validates on every keystroke.
 * - Server-side field errors (`setServerErrors`) are shown until the user edits that field.
 *
 * `getFieldProps(name)` wires an input up with value, handlers and the aria attributes
 * (aria-invalid + aria-describedby pointing at the element with `errorId(name)`).
 */
export default function useValidatedForm(initialValues, validate) {
  const idPrefix = useId()
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState({})
  const [serverErrors, setServerErrorState] = useState({})

  const clientErrors = useMemo(() => validate(values), [validate, values])

  const errors = useMemo(() => {
    const visible = {}
    for (const name of Object.keys(values)) {
      const message = serverErrors[name] ?? (touched[name] ? clientErrors[name] : undefined)
      if (message) visible[name] = message
    }
    return visible
  }, [values, touched, serverErrors, clientErrors])

  const setFieldValue = useCallback((name, value) => {
    setValues((current) => ({ ...current, [name]: value }))
    setServerErrorState((current) => {
      if (!(name in current)) return current
      const rest = { ...current }
      delete rest[name]
      return rest
    })
  }, [])

  const handleChange = useCallback(
    (event) => {
      const { name, type, checked, value } = event.target
      setFieldValue(name, type === 'checkbox' ? checked : value)
    },
    [setFieldValue],
  )

  const handleBlur = useCallback((event) => {
    const { name } = event.target
    setTouched((current) => (current[name] ? current : { ...current, [name]: true }))
  }, [])

  /** Marks every field as touched and returns the client-side errors (empty object = valid). */
  const validateAll = useCallback(() => {
    setTouched(Object.fromEntries(Object.keys(values).map((name) => [name, true])))
    return clientErrors
  }, [values, clientErrors])

  /** Shows errors returned by the API, keeping only those that belong to this form. */
  const setServerErrors = useCallback(
    (fieldErrors = {}) => {
      const known = Object.fromEntries(Object.entries(fieldErrors).filter(([name]) => name in values))
      setServerErrorState(known)
      return known
    },
    [values],
  )

  const reset = useCallback((nextValues = initialValues) => {
    setValues(nextValues)
    setTouched({})
    setServerErrorState({})
  }, [initialValues])

  const errorId = useCallback((name) => `${idPrefix}-${name}-error`, [idPrefix])

  const getFieldProps = useCallback(
    (name, { describedBy } = {}) => {
      const invalid = Boolean(errors[name])
      const describedByIds = [invalid ? errorId(name) : null, describedBy].filter(Boolean).join(' ')
      return {
        id: `${idPrefix}-${name}`,
        name,
        value: values[name] ?? '',
        onChange: handleChange,
        onBlur: handleBlur,
        'aria-invalid': invalid || undefined,
        'aria-describedby': describedByIds || undefined,
      }
    },
    [errors, errorId, handleBlur, handleChange, idPrefix, values],
  )

  return {
    values,
    errors,
    setFieldValue,
    handleChange,
    handleBlur,
    validateAll,
    setServerErrors,
    reset,
    errorId,
    getFieldProps,
  }
}

/** Moves keyboard focus to the first invalid control of a form (in DOM order). */
export function focusFirstInvalid(form, errors) {
  const names = Object.keys(errors)
  if (!form || names.length === 0) return
  const firstInvalid = Array.from(form.elements).find((element) => names.includes(element.name))
  firstInvalid?.focus()
}
