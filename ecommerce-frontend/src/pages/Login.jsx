import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiAlertCircle, FiClock, FiLoader, FiLogIn, FiX } from 'react-icons/fi'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import PasswordInput from '../components/PasswordInput'
import useDocumentTitle from '../hooks/useDocumentTitle'
import useRedirectPath from '../hooks/useRedirectPath'
import useValidatedForm, { focusFirstInvalid } from '../hooks/useValidatedForm'
import {
  SESSION_EXPIRED_MESSAGE,
  clearAuthError,
  clearSessionMessage,
  selectAuthError,
  selectAuthStatus,
  selectIsAuthenticated,
  selectSessionMessage,
} from '../redux/slices/authSlice'
import { loginUser } from '../redux/thunks/authThunks'
import { APP_NAME, DEMO_ACCOUNTS } from '../utils/constants'
import { validateLogin } from '../utils/validators'

const INITIAL_VALUES = { email: '', password: '' }

export default function Login() {
  useDocumentTitle('Log in')
  const dispatch = useDispatch()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const redirectPath = useRedirectPath()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const status = useSelector(selectAuthStatus)
  const serverError = useSelector(selectAuthError)
  const sessionMessage = useSelector(selectSessionMessage)
  const { values, errors, errorId, getFieldProps, setFieldValue, validateAll, setServerErrors } = useValidatedForm(
    INITIAL_VALUES,
    validateLogin,
  )
  const fieldFrame = (name) => ({ htmlFor: getFieldProps(name).id, error: errors[name], errorId: errorId(name) })

  // Don't greet the next visit with the error from a previous failed attempt.
  useEffect(() => () => dispatch(clearAuthError()), [dispatch])

  // Already signed in (or just signed in): continue to the page that asked for a login.
  if (isAuthenticated) return <Navigate to={redirectPath} replace />

  const submitting = status === 'loading'
  const expiredNotice = searchParams.has('expired') ? (sessionMessage ?? SESSION_EXPIRED_MESSAGE) : null

  const dismissNotice = () => {
    dispatch(clearSessionMessage())
    const next = new URLSearchParams(searchParams)
    next.delete('expired')
    setSearchParams(next, { replace: true, state: location.state })
  }

  const fillDemoAccount = ({ email, password }) => {
    setFieldValue('email', email)
    setFieldValue('password', password)
    dispatch(clearAuthError())
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const clientErrors = validateAll()
    if (Object.keys(clientErrors).length) {
      focusFirstInvalid(formElement, clientErrors)
      return
    }
    try {
      const { user } = await dispatch(loginUser(values)).unwrap()
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
    } catch ({ fieldErrors }) {
      // Field-level problems show next to their inputs; anything else stays in the banner.
      const shown = setServerErrors(fieldErrors)
      if (Object.keys(shown).length) {
        dispatch(clearAuthError())
        focusFirstInvalid(formElement, shown)
      }
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to check out faster, track your orders and get picks tailored to you."
      footer={
        <>
          New to {APP_NAME}?{' '}
          <Link to="/register" state={location.state} className="link">
            Create an account
          </Link>
        </>
      }
    >
      {expiredNotice && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          <FiClock className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="flex-1">
            <span className="font-semibold">Session ended. </span>
            {expiredNotice}
          </p>
          <button
            type="button"
            onClick={dismissNotice}
            className="-m-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-amber-700 hover:bg-amber-100"
            aria-label="Dismiss notice"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
      )}

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
          <PasswordInput autoComplete="current-password" placeholder="Your password" {...getFieldProps('password')} />
        </FormField>

        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting}>
          {submitting ? (
            <FiLoader className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <FiLogIn className="size-5" aria-hidden="true" />
          )}
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <section aria-labelledby="demo-accounts" className="mt-6 rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 p-4">
        <h2 id="demo-accounts" className="text-sm font-bold text-brand-900">
          Exploring the demo?
        </h2>
        <p className="mt-0.5 text-xs text-stone-600">Fill in a seeded account, then press Log in.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemoAccount(account)}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Use {account.label.toLowerCase()}
            </button>
          ))}
        </div>
      </section>
    </AuthLayout>
  )
}
