import { useEffect, useId, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { FiCheckCircle, FiClock, FiMail, FiMapPin, FiPackage, FiPhone, FiSend } from 'react-icons/fi'
import api, { getErrorMessage, getFieldErrors } from '../api/axiosInstance'
import ErrorMessage from '../components/ErrorMessage'
import FormField from '../components/FormField'
import useDocumentTitle from '../hooks/useDocumentTitle'
import useValidatedForm, { focusFirstInvalid } from '../hooks/useValidatedForm'
import { selectCurrentUser } from '../redux/slices/authSlice'
import { LIMITS, validateContact } from '../utils/validators'

const EMPTY_MESSAGE = { name: '', email: '', subject: '', message: '' }
const MESSAGE_MAX = LIMITS.message.max

const CONTACT_DETAILS = [
  { icon: FiMail, label: 'Email', value: 'support@shopsphere.dev' },
  { icon: FiPhone, label: 'Phone', value: '+91 80 4000 1234' },
  { icon: FiClock, label: 'Support hours', value: 'Mon – Sat, 9 am – 7 pm IST' },
  { icon: FiMapPin, label: 'Office', value: 'ShopSphere, 4th Floor, MG Road, Kochi, Kerala 682016' },
]

export default function Contact() {
  useDocumentTitle('Contact us')
  const user = useSelector(selectCurrentUser)
  // Logged-in shoppers don't need to retype who they are.
  const [initialValues] = useState(() => ({ ...EMPTY_MESSAGE, name: user?.name ?? '', email: user?.email ?? '' }))
  const { values, errors, errorId, getFieldProps, validateAll, setServerErrors, reset } = useValidatedForm(
    initialValues,
    validateContact,
  )
  const [sending, setSending] = useState(false)
  // { message, fieldErrors? } from the last failed send.
  const [submitError, setSubmitError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const formRef = useRef(null)
  const successHeadingRef = useRef(null)
  const counterId = useId()

  useEffect(() => {
    if (successMessage) successHeadingRef.current?.focus()
  }, [successMessage])

  // After a rejected send has re-rendered (inputs enabled again), focus the first field the server flagged.
  useEffect(() => {
    if (submitError?.fieldErrors) focusFirstInvalid(formRef.current, submitError.fieldErrors)
  }, [submitError])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (sending) return
    setSubmitError(null)

    const clientErrors = validateAll()
    if (Object.keys(clientErrors).length > 0) {
      focusFirstInvalid(formRef.current, clientErrors)
      return
    }

    setSending(true)
    try {
      const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]))
      const { data } = await api.post('/contact', payload)
      setSuccessMessage(data?.message || "Thanks for reaching out — we'll get back to you soon.")
    } catch (error) {
      const mapped = setServerErrors(getFieldErrors(error))
      setSubmitError(
        Object.keys(mapped).length > 0
          ? { message: 'Please correct the highlighted fields and try again.', fieldErrors: mapped }
          : { message: getErrorMessage(error) },
      )
    } finally {
      setSending(false)
    }
  }

  const startNewMessage = () => {
    reset({ ...EMPTY_MESSAGE, name: user?.name ?? values.name, email: user?.email ?? values.email })
    setSuccessMessage('')
    setSubmitError(null)
  }

  const messageLength = values.message.length
  const nameProps = getFieldProps('name')
  const emailProps = getFieldProps('email')
  const subjectProps = getFieldProps('subject')
  const messageProps = getFieldProps('message', { describedBy: counterId })

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold tracking-wide text-accent-600 uppercase">Contact</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">We&apos;re here to help</h1>
        <p className="mt-2 text-stone-600">
          Questions about an order, a product or your account? Send us a message and our support team will reply
          within one business day.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-8">
        <section aria-label="Contact form" className="card p-5 sm:p-8 lg:col-start-2 lg:row-start-1">
          {successMessage ? (
            <div className="flex flex-col items-center py-8 text-center" role="status">
              <span className="grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                <FiCheckCircle className="size-7" aria-hidden="true" />
              </span>
              <h2 ref={successHeadingRef} tabIndex={-1} className="mt-4 text-xl font-bold outline-none">
                Message sent!
              </h2>
              <p className="mt-2 max-w-md text-stone-600">{successMessage}</p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={startNewMessage} className="btn btn-primary">
                  Send another message
                </button>
                <Link to="/" className="btn btn-secondary">
                  Continue shopping
                </Link>
              </div>
            </div>
          ) : (
            <form ref={formRef} noValidate onSubmit={handleSubmit} aria-busy={sending} className="space-y-5">
              <h2 className="text-xl font-bold">Send us a message</h2>

              {submitError && <ErrorMessage title="Your message wasn't sent" message={submitError.message} />}

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Your name" htmlFor={nameProps.id} error={errors.name} errorId={errorId('name')}>
                  <input {...nameProps} type="text" autoComplete="name" required disabled={sending} className="input" />
                </FormField>
                <FormField label="Email" htmlFor={emailProps.id} error={errors.email} errorId={errorId('email')}>
                  <input
                    {...emailProps}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    disabled={sending}
                    className="input"
                  />
                </FormField>
              </div>

              <FormField label="Subject" htmlFor={subjectProps.id} error={errors.subject} errorId={errorId('subject')}>
                <input
                  {...subjectProps}
                  type="text"
                  placeholder="e.g. Question about my order"
                  required
                  disabled={sending}
                  className="input"
                />
              </FormField>

              <FormField
                label="Message"
                htmlFor={messageProps.id}
                error={errors.message}
                errorId={errorId('message')}
                aside={
                  <span
                    id={counterId}
                    className={`text-xs tabular-nums ${
                      messageLength > MESSAGE_MAX ? 'font-semibold text-red-700' : 'text-stone-500'
                    }`}
                  >
                    {messageLength} / {MESSAGE_MAX}
                    <span className="sr-only"> characters</span>
                  </span>
                }
              >
                <textarea
                  {...messageProps}
                  rows={6}
                  placeholder="How can we help? Include your order number if it's about an order."
                  required
                  disabled={sending}
                  className="input resize-y"
                />
              </FormField>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-stone-500">All fields are required.</p>
                <button type="submit" className="btn btn-primary btn-lg" disabled={sending}>
                  <FiSend aria-hidden="true" />
                  {sending ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          )}
        </section>

        <aside className="space-y-4 lg:col-start-1 lg:row-start-1" aria-label="Other ways to reach us">
          <div className="rounded-2xl bg-brand-900 p-6 text-brand-50">
            <h2 className="text-lg font-bold text-white">Get in touch</h2>
            <ul className="mt-4 space-y-4">
              {CONTACT_DETAILS.map(({ icon: Icon, label, value }) => (
                <li key={label} className="flex gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-accent-300">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-white">{label}</p>
                    <p className="break-words text-brand-100">{value}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card flex gap-3 p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-600">
              <FiPackage className="size-5" aria-hidden="true" />
            </span>
            <div className="text-sm">
              <p className="font-semibold text-stone-900">Checking on an order?</p>
              <p className="mt-0.5 text-stone-600">
                Track progress or cancel a pending order from{' '}
                <Link to="/orders" className="link">
                  My orders
                </Link>
                .
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
