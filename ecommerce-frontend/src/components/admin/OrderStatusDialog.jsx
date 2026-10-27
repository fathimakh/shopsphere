import { useId, useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import DialogError from './DialogError'
import { NEXT_ORDER_STATUSES } from '../../utils/constants'
import { shortId } from '../../utils/format'

const NOTE_MAX_LENGTH = 200

const STATUS_HINTS = {
  processing: 'Payment confirmed and the order is being packed.',
  shipped: 'Handed over to the courier.',
  delivered: 'Received by the customer. Cash-on-delivery orders are marked paid.',
  cancelled: 'Stops the order and puts the items back in stock.',
}

/**
 * Lets an admin move an order to one of its allowed next statuses (NEXT_ORDER_STATUSES) with an
 * optional note for the status history. Mount it only while open; errors (e.g. 409) show inline.
 */
export default function OrderStatusDialog({ order, busy, error, onConfirm, onCancel }) {
  const options = NEXT_ORDER_STATUSES[order.status] ?? []
  const [status, setStatus] = useState(options[0] ?? '')
  const [note, setNote] = useState('')
  const noteId = useId()
  const errorId = useId()

  return (
    <ConfirmDialog
      open
      title={`Update order ${shortId(order._id)}`}
      message={`Current status: ${order.status}. Choose what happens next.`}
      confirmLabel={status === 'cancelled' ? 'Cancel order' : 'Update status'}
      cancelLabel="Close"
      tone={status === 'cancelled' ? 'danger' : 'primary'}
      busy={busy}
      onConfirm={() => onConfirm({ status, note: note.trim() })}
      onCancel={onCancel}
    >
      <fieldset className="mt-4" aria-describedby={error ? errorId : undefined}>
        <legend className="label">New status</legend>
        <div className="space-y-2">
          {options.map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                status === option ? 'border-brand-600 bg-brand-50/60' : 'border-stone-200 hover:bg-stone-50'
              }`}
            >
              <input
                type="radio"
                name="order-status"
                value={option}
                checked={status === option}
                onChange={() => setStatus(option)}
                className="mt-0.5 size-4 accent-brand-700"
              />
              <span>
                <span className="block text-sm font-semibold capitalize text-stone-800">{option}</span>
                <span className="block text-xs text-stone-500">{STATUS_HINTS[option]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor={noteId} className="label mt-4">
        Note <span className="font-normal text-stone-500">(optional)</span>
      </label>
      <input
        id={noteId}
        className="input"
        value={note}
        maxLength={NOTE_MAX_LENGTH}
        placeholder={status === 'shipped' ? 'e.g. Shipped via BlueDart, AWB 1234' : 'Shown in the order history'}
        onChange={(event) => setNote(event.target.value)}
      />

      <DialogError id={errorId} message={error} />
    </ConfirmDialog>
  )
}
