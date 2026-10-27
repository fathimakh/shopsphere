import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiEdit3, FiEye, FiShoppingBag, FiTrash2 } from 'react-icons/fi'
import api from '../../api/axiosInstance'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import AdminTable from '../../components/admin/AdminTable'
import DialogError from '../../components/admin/DialogError'
import OrderDetailDialog from '../../components/admin/OrderDetailDialog'
import OrderStatusDialog from '../../components/admin/OrderStatusDialog'
import RefreshButton from '../../components/admin/RefreshButton'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import Loader from '../../components/Loader'
import Pagination from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import useAdminMutation from '../../hooks/useAdminMutation'
import useAdminResource from '../../hooks/useAdminResource'
import useDocumentTitle from '../../hooks/useDocumentTitle'
import { NEXT_ORDER_STATUSES, ORDER_STATUSES } from '../../utils/constants'
import { formatDate, formatPrice, pluralize, shortId } from '../../utils/format'

const PAGE_SIZE = 20
const STATUS_FILTERS = ['', ...ORDER_STATUSES]
// Deleting an order that is still open also restocks its items (contract §3.5).
const FINAL_STATUSES = ['delivered', 'cancelled']

const COLUMNS = [
  {
    id: 'order',
    header: 'Order',
    primary: true,
    cell: (order) => (
      <div className="flex items-start justify-between gap-3 xl:block">
        <div className="min-w-0">
          <p className="font-semibold text-stone-900">{shortId(order._id)}</p>
          <p className="text-xs text-stone-500">
            {formatDate(order.createdAt)} · {pluralize(order.orderItems?.length ?? 0, 'item')}
          </p>
        </div>
        <StatusBadge status={order.status} className="xl:hidden" />
      </div>
    ),
  },
  {
    id: 'customer',
    header: 'Customer',
    cell: (order) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-stone-900">{order.user?.name ?? 'Unknown'}</p>
        <p className="truncate text-xs text-stone-500 xl:max-w-56">{order.user?.email}</p>
      </div>
    ),
  },
  {
    id: 'total',
    header: 'Total',
    align: 'right',
    cell: (order) => <span className="font-semibold tabular-nums">{formatPrice(order.totalPrice)}</span>,
  },
  {
    id: 'payment',
    header: 'Payment',
    cell: (order) => (
      <span className="whitespace-nowrap">
        {order.paymentMethod}{' '}
        <span className={`text-xs font-semibold ${order.isPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
          · {order.isPaid ? 'Paid' : 'Unpaid'}
        </span>
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    hideOnMobile: true,
    cell: (order) => <StatusBadge status={order.status} />,
  },
]

/** Order management: filter GET /orders by status, view details, move orders through their lifecycle, delete. */
export default function AdminOrders() {
  useDocumentTitle('Manage orders')
  // Filters live in the URL so dashboard links such as ?status=pending or ?order=<id> land here directly.
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = ORDER_STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : ''
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1)
  const detailId = searchParams.get('order')

  const orders = useAdminResource('/orders', { params: { status: statusFilter, page, limit: PAGE_SIZE } })
  const items = orders.data?.orders ?? []
  const pagination = orders.data?.pagination ?? { page: 1, pages: 1, total: 0 }

  // The detail dialog reuses the row from the list; orders on other pages are fetched by id.
  const listedOrder = detailId ? items.find((order) => order._id === detailId) : null
  const single = useAdminResource(detailId && !listedOrder && orders.data ? `/orders/${detailId}` : null)
  const detailOrder = listedOrder ?? (single.status === 'succeeded' ? single.data?.order : null)

  const [statusTarget, setStatusTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { run, isPending, error, resetError } = useAdminMutation()

  const updateParams = (changes) =>
    setSearchParams((params) => {
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '' || (key === 'page' && value === 1)) params.delete(key)
        else params.set(key, String(value))
      }
      return params
    })

  const replaceOrder = (updated) => {
    orders.setData((data) =>
      data ? { ...data, orders: data.orders.map((order) => (order._id === updated._id ? { ...order, ...updated } : order)) } : data,
    )
    single.setData((data) => (data?.order?._id === updated._id ? { ...data, order: { ...data.order, ...updated } } : data))
  }

  const closeDialogs = () => {
    setStatusTarget(null)
    setDeleteTarget(null)
    resetError()
  }

  const confirmStatus = async ({ status, note }) => {
    const order = statusTarget
    const body = note ? { status, note } : { status }
    const { ok, data } = await run('status', () => api.put(`/orders/${order._id}/status`, body), {
      successMessage: `Order ${shortId(order._id)} is now ${status}`,
    })
    if (!ok) return
    // Keep the populated customer from the list; the update response may only carry the user id.
    replaceOrder({ ...data.order, user: order.user })
    closeDialogs()
  }

  const confirmDelete = async () => {
    const order = deleteTarget
    const { ok } = await run('delete', () => api.delete(`/orders/${order._id}`), {
      successMessage: (data) => data.message ?? `Deleted order ${shortId(order._id)}`,
    })
    if (!ok) return
    closeDialogs()
    if (detailId === order._id) updateParams({ order: null })
    if (items.length === 1 && page > 1) updateParams({ page: page - 1 })
    else orders.reload()
  }

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Track every order and move it from pending to delivered."
        actions={<RefreshButton onClick={orders.reload} loading={orders.status === 'loading'} />}
      />

      <div className="scroll-x -mx-4 mb-4 px-4 sm:mx-0 sm:px-0">
        <div role="group" aria-label="Filter by status" className="flex gap-2 pb-1">
          {STATUS_FILTERS.map((value) => (
            <button
              key={value || 'all'}
              type="button"
              aria-pressed={statusFilter === value}
              onClick={() => updateParams({ status: value, page: 1 })}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold capitalize transition-colors ${
                statusFilter === value
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
              }`}
            >
              {value || 'All'}
            </button>
          ))}
        </div>
      </div>

      {orders.status === 'failed' ? (
        <ErrorMessage title="Couldn't load orders" message={orders.error?.message} onRetry={orders.reload} />
      ) : !orders.data ? (
        <Loader label="Loading orders…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FiShoppingBag}
          title={statusFilter ? `No ${statusFilter} orders` : 'No orders yet'}
          message={statusFilter ? 'Orders with this status will show up here.' : 'New orders will show up here.'}
          action={
            statusFilter && (
              <button type="button" className="btn btn-secondary" onClick={() => updateParams({ status: '', page: 1 })}>
                Show all orders
              </button>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-stone-600" aria-live="polite">
            {pluralize(pagination.total, statusFilter ? `${statusFilter} order` : 'order')}
          </p>
          <AdminTable
            caption="Orders"
            columns={COLUMNS}
            rows={items}
            getRowKey={(order) => order._id}
            busy={orders.status === 'loading'}
            isCurrentRow={(order) => order._id === detailId}
            renderActions={(order) => {
              const canUpdate = NEXT_ORDER_STATUSES[order.status]?.length > 0
              return (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm min-h-10"
                    onClick={() => updateParams({ order: order._id })}
                    aria-label={`View order ${shortId(order._id)}`}
                  >
                    <FiEye aria-hidden="true" /> View
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm min-h-10"
                    onClick={() => setStatusTarget(order)}
                    disabled={!canUpdate}
                    title={canUpdate ? undefined : `${order.status} orders can't change status`}
                    aria-label={`Update status of order ${shortId(order._id)}`}
                  >
                    <FiEdit3 aria-hidden="true" /> Status
                  </button>
                  <button
                    type="button"
                    className="btn-icon text-red-700 hover:bg-red-50"
                    onClick={() => setDeleteTarget(order)}
                    aria-label={`Delete order ${shortId(order._id)}`}
                  >
                    <FiTrash2 aria-hidden="true" />
                  </button>
                </>
              )
            }}
          />
          <Pagination page={pagination.page} pages={pagination.pages} onPageChange={(next) => updateParams({ page: next })} className="mt-6" />
        </>
      )}

      {detailId && orders.data && !statusTarget && !deleteTarget && (
        <OrderDetailDialog
          orderId={detailId}
          order={detailOrder}
          status={single.status}
          error={single.error}
          onRetry={single.reload}
          onClose={() => updateParams({ order: null })}
          onUpdateStatus={setStatusTarget}
          onDelete={setDeleteTarget}
        />
      )}

      {statusTarget && (
        <OrderStatusDialog
          order={statusTarget}
          busy={isPending}
          error={error?.message}
          onConfirm={confirmStatus}
          onCancel={closeDialogs}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Delete order ${shortId(deleteTarget._id)}?` : 'Delete order?'}
        message={
          deleteTarget && FINAL_STATUSES.includes(deleteTarget.status)
            ? 'The order record is removed permanently.'
            : 'The order record is removed permanently and its items go back into stock.'
        }
        confirmLabel="Delete order"
        busy={isPending}
        onConfirm={confirmDelete}
        onCancel={closeDialogs}
      >
        <DialogError message={error?.message} />
      </ConfirmDialog>
    </>
  )
}
