import { useId, useState } from 'react'
import toast from 'react-hot-toast'
import { FiGrid, FiLoader, FiLock, FiLogOut, FiPackage, FiShoppingBag, FiTrash2 } from 'react-icons/fi'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorMessage from '../components/ErrorMessage'
import FormField from '../components/FormField'
import PasswordInput from '../components/PasswordInput'
import useDocumentTitle from '../hooks/useDocumentTitle'
import useValidatedForm, { focusFirstInvalid } from '../hooks/useValidatedForm'
import { selectCurrentUser } from '../redux/slices/authSlice'
import { changePassword, deleteAccount, logoutUser, updateProfile } from '../redux/thunks/authThunks'
import { formatDate, initials } from '../utils/format'
import { validatePasswordChange, validateProfile } from '../utils/validators'

const ADDRESS_FIELDS = ['street', 'city', 'state', 'postalCode', 'country']

/** Section wrapper shared by every card on the page. */
function Section({ title, description, children, tone = 'default' }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className={`card p-5 sm:p-6 ${tone === 'danger' ? 'border-red-200' : ''}`}>
      <h2 id={headingId} className={`text-lg font-bold ${tone === 'danger' ? 'text-red-700' : ''}`}>
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-stone-600">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function SubmitButton({ busy, children, busyLabel = 'Saving…', disabled = false }) {
  return (
    <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={busy || disabled}>
      {busy && <FiLoader className="size-4 animate-spin" aria-hidden="true" />}
      {busy ? busyLabel : children}
    </button>
  )
}

function AccountSummary({ user, isAdmin }) {
  return (
    <aside className="card p-5 sm:p-6 lg:sticky lg:top-24">
      <div className="flex items-center gap-4 lg:flex-col lg:items-start">
        <span
          className="grid size-16 shrink-0 place-items-center rounded-2xl bg-brand-700 text-xl font-extrabold text-white"
          aria-hidden="true"
        >
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-stone-900">{user.name}</p>
          <p className="truncate text-sm text-stone-600">{user.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`badge ${isAdmin ? 'bg-accent-100 text-accent-800' : 'bg-brand-50 text-brand-800'}`}>
              {isAdmin ? 'Administrator' : 'Shopper'}
            </span>
            {user.createdAt && <span className="text-xs text-stone-500">Member since {formatDate(user.createdAt)}</span>}
          </div>
        </div>
      </div>
      <nav aria-label="Account shortcuts" className="mt-5 grid gap-1 border-t border-stone-100 pt-4">
        <Link to="/orders" className="btn btn-ghost justify-start">
          <FiPackage aria-hidden="true" /> My orders
        </Link>
        {isAdmin && (
          <Link to="/admin" className="btn btn-ghost justify-start">
            <FiGrid aria-hidden="true" /> Admin dashboard
          </Link>
        )}
        <Link to="/" className="btn btn-ghost justify-start">
          <FiShoppingBag aria-hidden="true" /> Continue shopping
        </Link>
      </nav>
    </aside>
  )
}

function profileValues(user) {
  return {
    name: user.name ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    street: user.address?.street ?? '',
    city: user.address?.city ?? '',
    state: user.address?.state ?? '',
    postalCode: user.address?.postalCode ?? '',
    country: user.address?.country || 'India',
  }
}

function ProfileDetailsForm({ user }) {
  const dispatch = useDispatch()
  const [initialValues] = useState(() => profileValues(user))
  const { values, errors, errorId, getFieldProps, validateAll, setServerErrors } = useValidatedForm(
    initialValues,
    validateProfile,
  )
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const fieldFrame = (name) => ({ htmlFor: getFieldProps(name).id, error: errors[name], errorId: errorId(name) })

  const dirty = Object.keys(initialValues).some((name) => values[name] !== initialValues[name])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const clientErrors = validateAll()
    if (Object.keys(clientErrors).length) {
      focusFirstInvalid(formElement, clientErrors)
      return
    }
    const trimmed = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, value.trim()]))
    const { name, email, phone } = trimmed
    const address = Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, trimmed[field]]))

    setSaving(true)
    setFormError(null)
    try {
      await dispatch(updateProfile({ name, email, phone, address })).unwrap()
      toast.success('Your profile has been updated.')
    } catch ({ message, status, fieldErrors = {} }) {
      const mapped = status === 409 && !fieldErrors.email ? { ...fieldErrors, email: message } : fieldErrors
      const shown = setServerErrors(mapped)
      if (Object.keys(shown).length) focusFirstInvalid(formElement, shown)
      else setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Personal details" description="Used for your account and pre-filled at checkout.">
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {formError && <ErrorMessage title="Couldn't save your changes" message={formError} />}
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full name" {...fieldFrame('name')}>
            <input type="text" autoComplete="name" className="input" {...getFieldProps('name')} />
          </FormField>
          <FormField label="Email address" {...fieldFrame('email')}>
            <input type="email" autoComplete="email" inputMode="email" className="input" {...getFieldProps('email')} />
          </FormField>
          <FormField label="Phone" optional {...fieldFrame('phone')}>
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+91 98765 43210"
              className="input"
              {...getFieldProps('phone')}
            />
          </FormField>
        </div>

        <fieldset className="grid gap-5 border-t border-stone-100 pt-5 sm:grid-cols-2">
          <legend className="float-left mb-1 text-sm font-bold text-stone-900 sm:col-span-2">Default shipping address</legend>
          <FormField label="Street address" optional className="sm:col-span-2" {...fieldFrame('street')}>
            <input type="text" autoComplete="street-address" className="input" {...getFieldProps('street')} />
          </FormField>
          <FormField label="City" optional {...fieldFrame('city')}>
            <input type="text" autoComplete="address-level2" className="input" {...getFieldProps('city')} />
          </FormField>
          <FormField label="State" optional {...fieldFrame('state')}>
            <input type="text" autoComplete="address-level1" className="input" {...getFieldProps('state')} />
          </FormField>
          <FormField label="PIN / postal code" optional {...fieldFrame('postalCode')}>
            <input type="text" autoComplete="postal-code" inputMode="numeric" className="input" {...getFieldProps('postalCode')} />
          </FormField>
          <FormField label="Country" optional {...fieldFrame('country')}>
            <input type="text" autoComplete="country-name" className="input" {...getFieldProps('country')} />
          </FormField>
        </fieldset>

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          {!dirty && <p className="text-center text-xs text-stone-500 sm:text-right">No unsaved changes</p>}
          <SubmitButton busy={saving} disabled={!dirty}>
            Save changes
          </SubmitButton>
        </div>
      </form>
    </Section>
  )
}

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' }

function ChangePasswordForm() {
  const dispatch = useDispatch()
  const { values, errors, errorId, getFieldProps, validateAll, setServerErrors, reset } = useValidatedForm(
    EMPTY_PASSWORDS,
    validatePasswordChange,
  )
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const fieldFrame = (name) => ({ htmlFor: getFieldProps(name).id, error: errors[name], errorId: errorId(name) })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const clientErrors = validateAll()
    if (Object.keys(clientErrors).length) {
      focusFirstInvalid(formElement, clientErrors)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const { currentPassword, newPassword } = values
      await dispatch(changePassword({ currentPassword, newPassword })).unwrap()
      reset(EMPTY_PASSWORDS)
      toast.success('Password changed. Any other devices have been signed out.')
    } catch ({ message, status, fieldErrors = {} }) {
      // A rejected current password comes back without field details; attach it to that field.
      const wrongPassword = !Object.keys(fieldErrors).length && (status === 400 || status === 401)
      const shown = setServerErrors(wrongPassword ? { currentPassword: message } : fieldErrors)
      if (Object.keys(shown).length) focusFirstInvalid(formElement, shown)
      else setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      title="Change password"
      description="Changing your password signs you out everywhere else; this device stays signed in."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <ErrorMessage title="Couldn't change your password" message={formError} />}
        <FormField label="Current password" {...fieldFrame('currentPassword')}>
          <PasswordInput autoComplete="current-password" {...getFieldProps('currentPassword')} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="New password" {...fieldFrame('newPassword')}>
            <PasswordInput autoComplete="new-password" {...getFieldProps('newPassword')} />
          </FormField>
          <FormField label="Confirm new password" {...fieldFrame('confirmPassword')}>
            <PasswordInput autoComplete="new-password" {...getFieldProps('confirmPassword')} />
          </FormField>
        </div>
        <p className="text-xs text-stone-500">At least 8 characters, including a letter and a number.</p>
        <div className="flex justify-end">
          <SubmitButton busy={saving} busyLabel="Updating…">
            <FiLock aria-hidden="true" /> Update password
          </SubmitButton>
        </div>
      </form>
    </Section>
  )
}

function SessionsSection() {
  const dispatch = useDispatch()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const logoutEverywhere = async () => {
    setBusy(true)
    try {
      await dispatch(logoutUser({ allDevices: true })).unwrap()
      toast.success('You have been logged out of all devices.')
    } catch ({ message }) {
      toast.error(message)
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <Section title="Sessions" description="Lost a device or used a shared computer? End every active session at once.">
      <button type="button" className="btn btn-secondary w-full sm:w-auto" onClick={() => setConfirming(true)}>
        <FiLogOut aria-hidden="true" /> Log out of all devices
      </button>
      <ConfirmDialog
        open={confirming}
        tone="primary"
        title="Log out of all devices?"
        message="Every session, including this one, will be signed out. You can log back in straight away."
        confirmLabel="Log out everywhere"
        busy={busy}
        onConfirm={logoutEverywhere}
        onCancel={() => setConfirming(false)}
      />
    </Section>
  )
}

function DeleteAccountSection() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const passwordId = useId()
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const closeDialog = () => {
    setConfirming(false)
    setPassword('')
    setError(null)
  }

  const handleDelete = async () => {
    if (!password) {
      setError('Enter your password to confirm')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await dispatch(deleteAccount({ password })).unwrap()
      navigate('/', { replace: true })
      toast.success('Your account has been deleted. Sorry to see you go!')
    } catch ({ message }) {
      setError(message)
      setBusy(false)
    }
  }

  return (
    <Section
      title="Delete account"
      tone="danger"
      description="Permanently removes your account and signs you out. This can't be undone."
    >
      <button type="button" className="btn btn-danger w-full sm:w-auto" onClick={() => setConfirming(true)}>
        <FiTrash2 aria-hidden="true" /> Delete my account
      </button>
      <ConfirmDialog
        open={confirming}
        title="Delete your account?"
        message="Your profile and saved cart will be erased and you will be signed out."
        confirmLabel="Delete account"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={closeDialog}
      >
        <form
          className="mt-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            handleDelete()
          }}
        >
          <FormField label="Confirm with your password" htmlFor={passwordId} error={error} errorId={`${passwordId}-error`}>
            <PasswordInput
              id={passwordId}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError(null)
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${passwordId}-error` : undefined}
            />
          </FormField>
        </form>
      </ConfirmDialog>
    </Section>
  )
}

export default function Profile() {
  useDocumentTitle('My account')
  const user = useSelector(selectCurrentUser)
  // ProtectedRoute only renders this page for a signed-in user; this covers the logout render.
  if (!user) return null
  const isAdmin = user.role === 'admin'

  return (
    <div className="container-page py-8 sm:py-10">
      <h1 className="text-2xl font-extrabold sm:text-3xl">My account</h1>
      <p className="mt-1 text-sm text-stone-600">Manage your details, password and sessions.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <AccountSummary user={user} isAdmin={isAdmin} />
        <div className="space-y-6">
          {/* Re-mounts with fresh values whenever the saved profile changes. */}
          <ProfileDetailsForm key={user.updatedAt ?? user._id} user={user} />
          <ChangePasswordForm />
          <SessionsSection />
          <DeleteAccountSection />
        </div>
      </div>
    </div>
  )
}
