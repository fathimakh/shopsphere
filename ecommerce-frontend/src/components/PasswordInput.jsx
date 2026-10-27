import { useState } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'

/**
 * Password field with a show/hide toggle button. Accepts every <input> prop, typically the
 * spread of useValidatedForm's getFieldProps (id, value, handlers, aria attributes).
 */
export default function PasswordInput({ className = '', ...inputProps }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input {...inputProps} type={visible ? 'text' : 'password'} className={`input pr-12 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0.5 my-auto grid size-10 place-items-center rounded-lg text-stone-500 transition-colors hover:text-stone-800"
        aria-label="Show password"
        aria-pressed={visible}
        aria-controls={inputProps.id}
      >
        {visible ? <FiEyeOff className="size-4.5" aria-hidden="true" /> : <FiEye className="size-4.5" aria-hidden="true" />}
      </button>
    </div>
  )
}
