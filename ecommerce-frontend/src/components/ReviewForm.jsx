import { useId, useState } from 'react'
import toast from 'react-hot-toast'
import { FaStar } from 'react-icons/fa6'
import { useDispatch } from 'react-redux'
import { addReview } from '../redux/thunks/productThunks'
import { LIMITS, validateReview } from '../utils/validators'

const STARS = [1, 2, 3, 4, 5]
const RATING_WORDS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent' }

/**
 * Create-or-update review form (the API keeps one review per user per product). Validates
 * with the shared rules first, then shows any field errors the server sends back.
 */
export default function ReviewForm({ productId, existingReview }) {
  const dispatch = useDispatch()
  const id = useId()
  const [values, setValues] = useState({
    rating: existingReview?.rating ?? 0,
    comment: existingReview?.comment ?? '',
  })
  const [hovered, setHovered] = useState(0)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const ratingErrorId = `${id}-rating-error`
  const commentErrorId = `${id}-comment-error`
  const shownRating = hovered || values.rating

  const update = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const found = validateReview(values)
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      await dispatch(addReview({ productId, rating: values.rating, comment: values.comment })).unwrap()
      toast.success(existingReview ? 'Your review has been updated' : 'Thanks! Your review is now live')
    } catch ({ message, fieldErrors = {} }) {
      setErrors(fieldErrors)
      if (!Object.keys(fieldErrors).length) setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <fieldset>
        <legend className="label">Your rating</legend>
        <div className="flex items-center gap-3">
          <div className="flex" onMouseLeave={() => setHovered(0)}>
            {STARS.map((star) => (
              <label key={star} className="cursor-pointer p-1" onMouseEnter={() => setHovered(star)}>
                <input
                  type="radio"
                  name={`${id}-rating`}
                  value={star}
                  checked={values.rating === star}
                  onChange={() => update('rating', star)}
                  className="peer sr-only"
                  aria-invalid={Boolean(errors.rating) || undefined}
                  aria-describedby={errors.rating ? ratingErrorId : undefined}
                />
                <FaStar
                  aria-hidden="true"
                  className={`size-8 rounded transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 ${
                    shownRating >= star ? 'text-amber-400' : 'text-stone-300'
                  }`}
                />
                <span className="sr-only">
                  {star} {star === 1 ? 'star' : 'stars'}, {RATING_WORDS[star]}
                </span>
              </label>
            ))}
          </div>
          {shownRating > 0 && (
            <span className="text-sm font-semibold text-stone-700" aria-hidden="true">
              {RATING_WORDS[shownRating]}
            </span>
          )}
        </div>
        {errors.rating && (
          <p id={ratingErrorId} className="mt-1 text-sm text-red-600">
            {errors.rating}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor={`${id}-comment`} className="label">
          Your review
        </label>
        <textarea
          id={`${id}-comment`}
          rows={4}
          value={values.comment}
          maxLength={LIMITS.review.max}
          onChange={(event) => update('comment', event.target.value)}
          placeholder="What did you like or dislike? How did you use it?"
          className="input resize-y"
          aria-invalid={Boolean(errors.comment) || undefined}
          aria-describedby={errors.comment ? commentErrorId : `${id}-comment-count`}
        />
        <div className="mt-1 flex justify-between gap-3 text-xs">
          <p id={commentErrorId} className="text-sm text-red-600">
            {errors.comment}
          </p>
          <p id={`${id}-comment-count`} className="shrink-0 text-stone-500 tabular-nums">
            {values.comment.length}/{LIMITS.review.max}
          </p>
        </div>
      </div>

      {formError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}

      <button type="submit" className="btn btn-primary h-11 w-full sm:w-auto" disabled={submitting}>
        {submitting ? 'Saving…' : existingReview ? 'Update review' : 'Submit review'}
      </button>
    </form>
  )
}
