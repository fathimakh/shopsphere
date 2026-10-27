import { useEffect, useId } from 'react'
import toast from 'react-hot-toast'
import { FiAlertCircle, FiCheck, FiLoader, FiUserPlus } from 'react-icons/fi'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Navigate, useLocation } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import PasswordInput from '../components/PasswordInput'
import useDocumentTitle from '../hooks/useDocumentTitle'
import useRedirectPath from '../hooks/useRedirectPath'
import useValidatedForm, { focusFirstInvalid } from '../hooks/useValidatedForm'
import { clearAuthError, selectAuthError, selectAuthStatus, selectIsAuthenticated } from '../redux/slices/authSlice'
import { registerUser } from '../redux/thunks/authThunks'
import { APP_NAME } from '../utils/constants'
import { LIMITS, validateRegister } from '../utils/validators'

const INITIAL_VALUES = { name: '', email: '', password: '', confirmPassword: '' }

/** Live checklist mirroring the server's password rule (contract §3.2). */
const PASSWORD_RULES = [
  { label: `At least ${LIMITS.password.min} characters`, test: (value) => value.length >= LIMITS.password.min },
  { label: 'A letter', test: (value) => /[A-Za-z]/.test(value) },
  { label: 'A number', test: (value) => /\d/.test(value) },
]

export default function Register() {
  useDocumentTitle('Create an account')
  const dispatch = useDispatch()
  const location = useLocation()
  const rulesId = useId()
  const redirectPath = useRedirectPath()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const status = useSelector(selectAuthStatus)
  const serverError = useSelector(selectAuthError)
  const { values, errors, errorId, getFieldProps, validateAll, setServerErrors } = useValidatedForm(
    INITIAL_VALUES,
    validateRegister,
  )
  const fieldFrame = (name) => ({ htmlFor: getFieldProps(name).id, error: errors[name], errorId: errorId(name) })

  useEffect(() => () => dispatch(clearAuthError()), [dispatch])

  // Registration logs the user straight in; already-signed-in visitors skip the form.
  if (isAuthenticated) return <Navigate to={redirectPath} replace />

  const submitting = status === 'loading'

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const clientErrors = validateAll()
    if (Object.keys(clientErrors).length) {
      focusFirstInvalid(formElement, clientErrors)
      return
    }
    try {
      const { name, email, password } = values
      const { user } = await dispatch(registerUser({ name, email, password })).unwrap()
      toast.success(`Welcome to ${APP_NAME}, ${user.name.split(' ')[0]}!`)
    } catch ({ message, status: httpStatus, fieldErrors = {} }) {
      // 409 = the email is already registered: show it on the email field itself.
      const mapped = httpStatus === 409 && !fieldErrors.email ? { ...fieldErrors, email: message } : fieldErrors
      const shown = setServerErrors(mapped)
      if (Object.keys(shown).length) {
        dispatch(clearAuthError())
        focusFirstInvalid(formElement, shown)
      }
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It takes a minute — then your cart follows you to any device."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="link">
            Log in
          </Link>
        </>
      }
    >
      {serverError && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
        >
          <FiAlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
          <p>{serverError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormField label="Full name" {...fieldFrame('name')}>
          <input type="text" autoComplete="name" placeholder="Asha Nair" className="input" {...getFieldProps('name')} />
        </FormField>

        <FormField label="Email address" {...fieldFrame('email')}>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className="input"
            {...getFieldProps('email')}
          />
        </FormField>

        <FormField label="Password" {...fieldFrame('password')}>
          <PasswordInput autoComplete="new-password" {...getFieldProps('password', { describedBy: rulesId })} />
          <ul id={rulesId} className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Password requirements">
            {PASSWORD_RULES.map(({ label, test }) => {
              const met = test(values.password)
              return (
                <li key={label} className={`flex items-center gap-1 ${met ? 'text-emerald-700' : 'text-stone-500'}`}>
                  <FiCheck className={`size-3.5 ${met ? '' : 'opacity-30'}`} aria-hidden="true" />
                  {label}
                  <span className="sr-only">{met ? '(met)' : '(not met yet)'}</span>
                </li>
              )
            })}
          </ul>
        </FormField>

        <FormField label="Confirm password" {...fieldFrame('confirmPassword')}>
          <PasswordInput autoComplete="new-password" {...getFieldProps('confirmPassword')} />
        </FormField>

        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting}>
          {submitting ? (
            <FiLoader className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <FiUserPlus className="size-5" aria-hidden="true" />
          )}
          {submitting ? 'Creating your account…' : 'Create account'}
        </button>
        <p className="text-center text-xs text-stone-500">
          New accounts are shopper accounts. Your password is stored only as a bcrypt hash.
        </p>
      </form>
    </AuthLayout>
  )
}
