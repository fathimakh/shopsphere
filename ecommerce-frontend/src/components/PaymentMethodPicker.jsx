import { FiCheckCircle, FiCreditCard, FiInfo, FiTruck } from 'react-icons/fi'
import { PAYMENT_METHODS } from '../utils/constants'

const ICONS = { COD: FiTruck, CARD: FiCreditCard }

/**
 * Radio-card group for the payment method (contract: "COD" | "CARD").
 * CARD is a simulated payment: no card details are collected and nothing is charged.
 */
export default function PaymentMethodPicker({ value, onChange, disabled = false, name = 'paymentMethod' }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="sr-only">Payment method</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {PAYMENT_METHODS.map((method) => {
          const Icon = ICONS[method.value] ?? FiCreditCard
          const checked = value === method.value
          return (
            <label
              key={method.value}
              className={`relative flex cursor-pointer gap-3 rounded-2xl border p-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 ${
                checked
                  ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600'
                  : 'border-stone-300 bg-white hover:border-stone-400'
              } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={method.value}
                checked={checked}
                onChange={() => onChange(method.value)}
                className="sr-only"
              />
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                  checked ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 pr-6">
                <span className="block font-semibold text-stone-900">{method.label}</span>
                <span className="mt-0.5 block text-sm text-stone-600">{method.description}</span>
              </span>
              {checked && (
                <FiCheckCircle className="absolute top-4 right-4 size-5 text-brand-700" aria-hidden="true" />
              )}
            </label>
          )
        })}
      </div>

      {value === 'CARD' && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
          <FiInfo className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Demo payment:</strong> no card details are collected and no money is charged. The order is
            marked as paid with a simulated reference number.
          </span>
        </p>
      )}
    </fieldset>
  )
}
