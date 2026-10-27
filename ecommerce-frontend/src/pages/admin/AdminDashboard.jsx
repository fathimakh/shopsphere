import { Link } from 'react-router-dom'
import { FiAlertTriangle, FiArrowRight, FiBox, FiShoppingBag, FiTrendingUp, FiUsers } from 'react-icons/fi'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import AdminPanel from '../../components/admin/AdminPanel'
import BarList from '../../components/admin/BarList'
import RefreshButton from '../../components/admin/RefreshButton'
import StatCard from '../../components/admin/StatCard'
import ErrorMessage from '../../components/ErrorMessage'
import AdminThumbnail from '../../components/admin/AdminThumbnail'
import StatusBadge from '../../components/StatusBadge'
import useAdminResource from '../../hooks/useAdminResource'
import useDocumentTitle from '../../hooks/useDocumentTitle'
import { ORDER_STATUSES } from '../../utils/constants'
import { formatCategory, formatCompact, formatDate, formatPrice, shortId } from '../../utils/format'

function DashboardSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </div>
  )
}

function LowStockList({ products }) {
  if (!products.length) {
    return <p className="py-4 text-sm text-stone-500">Every product is comfortably in stock.</p>
  }
  return (
    <ul className="-my-2 divide-y divide-stone-100">
      {products.map((product) => (
        <li key={product._id} className="flex items-center gap-3 py-2.5">
          <AdminThumbnail src={product.thumbnail || product.images?.[0]} className="size-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-stone-900">{product.name}</p>
            <p className={`text-xs font-semibold ${product.stock > 0 ? 'text-amber-700' : 'text-red-700'}`}>
              {product.stock > 0 ? `${product.stock} left` : 'Out of stock'}
            </p>
          </div>
          <Link
            to={`/admin/products?edit=${product._id}`}
            className="btn btn-secondary btn-sm min-h-9"
            aria-label={`Restock ${product.name}`}
          >
            Edit
          </Link>
        </li>
      ))}
    </ul>
  )
}

function TopProductsList({ items }) {
  const rows = items.filter((item) => item.product)
  if (!rows.length) return <p className="py-4 text-sm text-stone-500">No sales yet.</p>
  return (
    <ol className="-my-2 divide-y divide-stone-100">
      {rows.map(({ product, soldCount }, index) => (
        <li key={product._id} className="flex items-center gap-3 py-2.5">
          <span className="w-5 shrink-0 text-center text-sm font-bold text-stone-400 tabular-nums">{index + 1}</span>
          <AdminThumbnail src={product.thumbnail || product.images?.[0]} className="size-10" />
          <div className="min-w-0 flex-1">
            <Link to={`/product/${product._id}`} className="block truncate text-sm font-semibold text-stone-900 hover:text-brand-700">
              {product.name}
            </Link>
            <p className="truncate text-xs text-stone-500">{formatCategory(product.category)}</p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {soldCount ?? product.soldCount ?? 0} <span className="font-normal text-stone-500">sold</span>
          </p>
        </li>
      ))}
    </ol>
  )
}

function RecentOrdersList({ orders }) {
  if (!orders.length) return <p className="py-4 text-sm text-stone-500">No orders yet.</p>
  return (
    <ul className="-my-2 divide-y divide-stone-100">
      {orders.map((order) => (
        <li key={order._id}>
          <Link
            to={`/admin/orders?order=${order._id}`}
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-stone-50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-stone-900">
                {shortId(order._id)} <span className="font-normal text-stone-500">· {order.user?.name ?? 'Customer'}</span>
              </p>
              <p className="text-xs text-stone-500">{formatDate(order.createdAt)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold tabular-nums">{formatPrice(order.totalPrice)}</span>
              <StatusBadge status={order.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Admin landing page: KPIs, order pipeline, stock alerts, best sellers and latest orders (GET /analytics/summary). */
export default function AdminDashboard() {
  useDocumentTitle('Admin dashboard')
  const { data, status, error, reload } = useAdminResource('/analytics/summary')

  const header = (
    <AdminPageHeader
      title="Dashboard"
      description="How the store is doing right now."
      actions={<RefreshButton onClick={reload} loading={status === 'loading'} />}
    />
  )

  if (!data) {
    return (
      <>
        {header}
        {status === 'failed' ? (
          <ErrorMessage title="Couldn't load the dashboard" message={error?.message} onRetry={reload} />
        ) : (
          <DashboardSkeleton />
        )}
      </>
    )
  }

  const { totals = {}, ordersByStatus = {}, lowStock = [], topProducts = [], recentOrders = [] } = data
  const statusItems = ORDER_STATUSES.map((orderStatus) => ({
    key: orderStatus,
    label: orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1),
    value: ordersByStatus[orderStatus] ?? 0,
    tone: orderStatus,
    to: `/admin/orders?status=${orderStatus}`,
  }))

  return (
    <>
      {header}
      {status === 'failed' && (
        <ErrorMessage title="Couldn't refresh the dashboard" message={error?.message} onRetry={reload} className="mb-4" />
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard icon={FiTrendingUp} label="Revenue" value={formatPrice(totals.revenue)} hint="Excludes cancelled orders" />
          <StatCard
            icon={FiShoppingBag}
            label="Orders"
            value={formatCompact(totals.orders)}
            hint="Manage orders"
            to="/admin/orders"
            tone="accent"
          />
          <StatCard
            icon={FiBox}
            label="Products"
            value={formatCompact(totals.products)}
            hint="Manage catalogue"
            to="/admin/products"
            tone="sky"
          />
          <StatCard
            icon={FiUsers}
            label="Customers"
            value={formatCompact(totals.users)}
            hint="Manage users"
            to="/admin/users"
            tone="violet"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AdminPanel title="Orders by status" description="Select a status to see those orders.">
            <BarList items={statusItems} label="Orders by status" emptyMessage="No orders yet." />
          </AdminPanel>
          <AdminPanel
            title="Low stock"
            description="Restock these before they sell out."
            action={lowStock.length > 0 && <FiAlertTriangle className="size-5 text-amber-500" aria-hidden="true" />}
          >
            <LowStockList products={lowStock} />
          </AdminPanel>
          <AdminPanel title="Top products" description="Best sellers by units sold.">
            <TopProductsList items={topProducts} />
          </AdminPanel>
          <AdminPanel
            title="Recent orders"
            action={
              <Link to="/admin/orders" className="link inline-flex items-center gap-1 text-sm">
                All orders <FiArrowRight aria-hidden="true" />
              </Link>
            }
          >
            <RecentOrdersList orders={recentOrders} />
          </AdminPanel>
        </div>
      </div>
    </>
  )
}
