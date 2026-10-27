import { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { FiPackage } from 'react-icons/fi'
import EmptyState from '../components/EmptyState'
import ErrorMessage from '../components/ErrorMessage'
import OrderCard from '../components/OrderCard'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { selectMyOrders } from '../redux/slices/orderSlice'
import { fetchMyOrders } from '../redux/thunks/orderThunks'
import { pluralize } from '../utils/format'

const FILTERS = [
  { value: 'all', label: 'All', statuses: null },
  { value: 'active', label: 'In progress', statuses: ['pending', 'processing', 'shipped'] },
  { value: 'delivered', label: 'Delivered', statuses: ['delivered'] },
  { value: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
]

const matchesFilter = (order, filter) => !filter.statuses || filter.statuses.includes(order.status)

/** Error stored by the order slice: the serialized API error ({ message, … }) or a plain string. */
const errorText = (error) => (typeof error === 'string' ? error : error?.message)

function OrderCardSkeleton() {
  return (
    <div className="card p-4 sm:p-5" aria-hidden="true">
      <div className="flex justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-4 w-28" />
        </div>
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="flex gap-2">
          <div className="skeleton size-12 rounded-xl sm:size-14" />
          <div className="skeleton size-12 rounded-xl sm:size-14" />
        </div>
        <div className="space-y-2">
          <div className="skeleton ml-auto h-4 w-14" />
          <div className="skeleton h-6 w-24" />
        </div>
      </div>
    </div>
  )
}

export default function Orders() {
  useDocumentTitle('My orders')
  const dispatch = useDispatch()
  const { items: orders, status, error } = useSelector(selectMyOrders)
  const [filterValue, setFilterValue] = useState('all')

  const loadOrders = useCallback(() => dispatch(fetchMyOrders()), [dispatch])

  useEffect(() => {
    const request = loadOrders()
    return () => request.abort()
  }, [loadOrders])

  const filter = FILTERS.find((option) => option.value === filterValue) ?? FILTERS[0]
  const visibleOrders = orders.filter((order) => matchesFilter(order, filter))
  const isInitialLoad = (status === 'idle' || status === 'loading') && orders.length === 0

  let content
  if (isInitialLoad) {
    content = (
      <div className="space-y-4">
        <p role="status" className="sr-only">
          Loading your orders…
        </p>
        {[1, 2, 3].map((key) => (
          <OrderCardSkeleton key={key} />
        ))}
      </div>
    )
  } else if (status === 'failed' && orders.length === 0) {
    content = (
      <ErrorMessage title="We couldn't load your orders" message={errorText(error)} onRetry={loadOrders} />
    )
  } else if (orders.length === 0) {
    content = (
      <EmptyState
        icon={FiPackage}
        title="No orders yet"
        message="When you place an order it will show up here, so you can track it from checkout to your doorstep."
        action={
          <Link to="/" className="btn btn-primary">
            Start shopping
          </Link>
        }
      />
    )
  } else {
    content = (
      <>
        {status === 'failed' && (
          <ErrorMessage
            className="mb-4"
            title="Showing saved results"
            message={errorText(error)}
            onRetry={loadOrders}
          />
        )}
        <div className="scroll-x -mx-4 mb-5 px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2" role="group" aria-label="Filter orders by status">
            {FILTERS.map((option) => {
              const count = orders.filter((order) => matchesFilter(order, option)).length
              const active = option.value === filter.value
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilterValue(option.value)}
                  className={`btn min-h-10 rounded-full px-4 ${
                    active ? 'bg-brand-700 text-white hover:bg-brand-800' : 'btn-secondary'
                  }`}
                >
                  {option.label}
                  <span
                    className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/20' : 'bg-stone-100 text-stone-600'}`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {visibleOrders.length === 0 ? (
          <p className="card px-6 py-10 text-center text-sm text-stone-600">
            No {filter.label.toLowerCase()} orders.
          </p>
        ) : (
          <ul className="space-y-4">
            {visibleOrders.map((order) => (
              <li key={order._id}>
                <OrderCard order={order} />
              </li>
            ))}
          </ul>
        )}
      </>
    )
  }

  return (
    <div className="container-page max-w-4xl py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">My orders</h1>
          <p className="mt-1 text-sm text-stone-600">
            {orders.length > 0
              ? `${pluralize(orders.length, 'order')} · newest first`
              : 'Track, review and cancel your orders.'}
          </p>
        </div>
        {status === 'loading' && orders.length > 0 && (
          <span role="status" className="text-sm text-stone-500">
            Refreshing…
          </span>
        )}
      </div>
      {content}
    </div>
  )
}
