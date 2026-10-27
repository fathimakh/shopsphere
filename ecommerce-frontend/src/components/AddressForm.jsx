import FormField from './FormField'

/** Shipping address fields in display order (names match the API's shippingAddress keys). */
const FIELDS = [
  { name: 'fullName', label: 'Full name', autoComplete: 'name', span: true },
  { name: 'phone', label: 'Phone number', autoComplete: 'tel', type: 'tel', inputMode: 'tel' },
  { name: 'street', label: 'Street address', autoComplete: 'street-address', span: true },
  { name: 'city', label: 'City', autoComplete: 'address-level2' },
  { name: 'state', label: 'State', autoComplete: 'address-level1' },
  { name: 'postalCode', label: 'PIN / postal code', autoComplete: 'postal-code' },
  { name: 'country', label: 'Country', autoComplete: 'country-name' },
]

/**
 * Controlled shipping-address fields. Pass `getFieldProps`, `errors` and `errorId` from
 * useValidatedForm so validation, aria-invalid and aria-describedby stay in one place.
 */
export default function AddressForm({ getFieldProps, errors, errorId, disabled = false }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map(({ name, label, autoComplete, type = 'text', inputMode, span }) => {
        const fieldProps = getFieldProps(name)
        return (
          <FormField
            key={name}
            label={label}
            htmlFor={fieldProps.id}
            error={errors[name]}
            errorId={errorId(name)}
            className={span ? 'sm:col-span-2' : ''}
          >
            <input
              {...fieldProps}
              type={type}
              inputMode={inputMode}
              autoComplete={`shipping ${autoComplete}`}
              disabled={disabled}
              required
              className="input"
            />
          </FormField>
        )
      })}
    </div>
  )
}
