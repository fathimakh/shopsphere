import { FiCheck, FiClock, FiHome, FiPackage, FiTruck, FiX } from 'react-icons/fi'
import { ORDER_FLOW } from '../utils/constants'
import { formatDateTime } from '../utils/format'

const STEP_DETAILS = {
  pending: { label: 'Order placed', icon: FiClock },
  processing: { label: 'Processing', icon: FiPackage },
  shipped: { label: 'Shipped', icon: FiTruck },
  delivered: { label: 'Delivered', icon: FiHome },
  cancelled: { label: 'Cancelled', icon: FiX },
}

const STATE_LABELS = { complete: 'completed', current: 'current step', upcoming: 'not reached yet', cancelled: '' }

const MARKER_STYLES = {
  complete: 'bg-brand-700 text-white',
  current: 'bg-white text-brand-700 ring-2 ring-brand-700',
  upcoming: 'bg-stone-100 text-stone-400 ring-1 ring-stone-200',
  cancelled: 'bg-red-600 text-white',
}

/**
 * Builds the visible steps from the order status and its statusHistory:
 * pending → processing → shipped → delivered, or the steps reached before a cancellation + "Cancelled".
 */
function buildSteps(status, statusHistory, createdAt) {
  const lastEntry = (step) => statusHistory.findLast((entry) => entry.status === step)

  if (status === 'cancelled') {
    const reached = Math.max(0, ...statusHistory.map((entry) => ORDER_FLOW.indexOf(entry.status)))
    return [...ORDER_FLOW.slice(0, reached + 1), 'cancelled'].map((step) => ({
      step,
      state: step === 'cancelled' ? 'cancelled' : 'complete',
      entry: lastEntry(step) ?? (step === 'pending' ? { at: createdAt } : null),
    }))
  }

  const currentIndex = Math.max(ORDER_FLOW.indexOf(status), 0)
  return ORDER_FLOW.map((step, index) => {
    let state = 'upcoming'
    if (index < currentIndex || (index === currentIndex && step === 'delivered')) state = 'complete'
    else if (index === currentIndex) state = 'current'
    return { step, state, entry: lastEntry(step) ?? (step === 'pending' ? { at: createdAt } : null) }
  })
}

/** Order progress tracker: vertical on phones, horizontal from the `sm` breakpoint up. */
export default function OrderStatusTimeline({ status, statusHistory = [], createdAt }) {
  const steps = buildSteps(status, statusHistory, createdAt)

  return (
    <ol className="grid sm:auto-cols-fr sm:grid-flow-col">
      {steps.map(({ step, state, entry }, index) => {
        const { label, icon: StepIcon } = STEP_DETAILS[step]
        const Icon = state === 'complete' ? FiCheck : StepIcon
        const next = steps[index + 1]
        const connectorDone = next && next.state !== 'upcoming'
        const note = entry?.note && entry.note.toLowerCase() !== label.toLowerCase() ? entry.note : null

        return (
          <li
            key={step}
            aria-current={state === 'current' ? 'step' : undefined}
            className="relative flex gap-3 pb-6 last:pb-0 sm:flex-col sm:items-center sm:px-2 sm:pb-0 sm:text-center"
          >
            {next && (
              <span
                aria-hidden="true"
                className={`absolute top-10 bottom-0 left-5 w-0.5 -translate-x-1/2 sm:top-5 sm:right-[calc(-50%+1.5rem)] sm:bottom-auto sm:left-[calc(50%+1.5rem)] sm:h-0.5 sm:w-auto sm:translate-x-0 sm:-translate-y-1/2 ${
                  connectorDone ? (next.state === 'cancelled' ? 'bg-red-300' : 'bg-brand-600') : 'bg-stone-200'
                }`}
              />
            )}
            <span className={`relative grid size-10 shrink-0 place-items-center rounded-full ${MARKER_STYLES[state]}`}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-1.5 sm:mt-2 sm:pt-0">
              <p
                className={`text-sm font-semibold ${
                  state === 'upcoming' ? 'text-stone-500' : state === 'cancelled' ? 'text-red-700' : 'text-stone-900'
                }`}
              >
                {label}
                {STATE_LABELS[state] && <span className="sr-only"> ({STATE_LABELS[state]})</span>}
              </p>
              {entry?.at && (
                <p className="mt-0.5 text-xs text-stone-500">
                  <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
                </p>
              )}
              {note && <p className="mt-1 text-xs text-stone-600 italic">“{note}”</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
