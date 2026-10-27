import { useState } from 'react'
import { useSelector } from 'react-redux'
import { FiSearch, FiShield, FiTrash2, FiUser, FiUsers } from 'react-icons/fi'
import api from '../../api/axiosInstance'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import AdminTable from '../../components/admin/AdminTable'
import DialogError from '../../components/admin/DialogError'
import RefreshButton from '../../components/admin/RefreshButton'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import Loader from '../../components/Loader'
import Pagination from '../../components/Pagination'
import useAdminMutation from '../../hooks/useAdminMutation'
import useAdminResource from '../../hooks/useAdminResource'
import useDebounce from '../../hooks/useDebounce'
import useDocumentTitle from '../../hooks/useDocumentTitle'
import { selectCurrentUser } from '../../redux/slices/authSlice'
import { formatDate, initials, pluralize } from '../../utils/format'

const PAGE_SIZE = 20
const ROLE_FILTERS = [
  { value: '', label: 'All roles' },
  { value: 'user', label: 'Customers' },
  { value: 'admin', label: 'Admins' },
]

function RoleBadge({ role }) {
  return role === 'admin' ? (
    <span className="badge bg-brand-100 text-brand-800">
      <FiShield className="size-3" aria-hidden="true" /> Admin
    </span>
  ) : (
    <span className="badge bg-stone-100 text-stone-700">
      <FiUser className="size-3" aria-hidden="true" /> Customer
    </span>
  )
}

/** User management: search GET /users, promote / demote (PUT /users/:id) and delete accounts. */
export default function AdminUsers() {
  useDocumentTitle('Manage users')
  const currentUser = useSelector(selectCurrentUser)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search.trim())
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)

  // A new search term always starts from page 1 (adjusting state while rendering, not in an effect).
  const [searchedTerm, setSearchedTerm] = useState(debouncedSearch)
  if (searchedTerm !== debouncedSearch) {
    setSearchedTerm(debouncedSearch)
    setPage(1)
  }

  const users = useAdminResource('/users', { params: { search: debouncedSearch, role, page, limit: PAGE_SIZE } })
  const items = users.data?.users ?? []
  const pagination = users.data?.pagination ?? { page: 1, pages: 1, total: 0 }
  const isSelf = (user) => user._id === currentUser?._id

  // { type: 'role' | 'delete', user }
  const [pending, setPending] = useState(null)
  const { run, isPending, error, resetError } = useAdminMutation()

  const closeDialog = () => {
    setPending(null)
    resetError()
  }

  const confirmAction = async () => {
    const { type, user } = pending
    if (type === 'role') {
      const nextRole = user.role === 'admin' ? 'user' : 'admin'
      const { ok, data } = await run('role', () => api.put(`/users/${user._id}`, { role: nextRole }), {
        successMessage: `${user.name} is now ${nextRole === 'admin' ? 'an admin' : 'a customer'}`,
      })
      if (!ok) return
      users.setData((current) => ({
        ...current,
        users: current.users.map((item) => (item._id === user._id ? { ...item, ...data.user } : item)),
      }))
    } else {
      const { ok } = await run('delete', () => api.delete(`/users/${user._id}`), {
        successMessage: `Deleted ${user.name}'s account`,
      })
      if (!ok) return
      if (items.length === 1 && page > 1) setPage(page - 1)
      else users.reload()
    }
    closeDialog()
  }

  const columns = [
    {
      id: 'user',
      header: 'User',
      primary: true,
      cell: (user) => (
        <div className="flex items-center gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800"
            aria-hidden="true"
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-stone-900">
              <span className="truncate">{user.name}</span>
              {isSelf(user) && <span className="badge bg-accent-100 text-accent-800">You</span>}
            </p>
            <p className="truncate text-xs text-stone-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    { id: 'role', header: 'Role', cell: (user) => <RoleBadge role={user.role} /> },
    { id: 'phone', header: 'Phone', hideOnMobile: true, cell: (user) => user.phone || <span className="text-stone-400">—</span> },
    { id: 'joined', header: 'Joined', cell: (user) => <span className="whitespace-nowrap">{formatDate(user.createdAt)}</span> },
  ]

  const dialogCopy = pending && {
    role: {
      title: pending.user.role === 'admin' ? 'Remove admin access?' : 'Make this user an admin?',
      message:
        pending.user.role === 'admin'
          ? `${pending.user.name} will lose access to the admin dashboard.`
          : `${pending.user.name} will be able to manage products, orders, users and recommendations.`,
      confirmLabel: pending.user.role === 'admin' ? 'Remove admin' : 'Make admin',
      tone: pending.user.role === 'admin' ? 'danger' : 'primary',
    },
    delete: {
      title: `Delete ${pending.user.name}'s account?`,
      message: `${pending.user.email} will no longer be able to sign in. Their past orders stay on record.`,
      confirmLabel: 'Delete account',
      tone: 'danger',
    },
  }[pending.type]

  return (
    <>
      <AdminPageHeader
        title="Users"
        description="Customers and admins with a ShopSphere account."
        actions={<RefreshButton onClick={users.reload} loading={users.status === 'loading'} />}
      />

      <div role="search" className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="relative">
          <label htmlFor="admin-user-search" className="sr-only">
            Search users
          </label>
          <FiSearch className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <input
            id="admin-user-search"
            type="search"
            className="input pl-10"
            placeholder="Search by name or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="admin-user-role" className="sr-only">
            Role
          </label>
          <select
            id="admin-user-role"
            className="input"
            value={role}
            onChange={(event) => {
              setRole(event.target.value)
              setPage(1)
            }}
          >
            {ROLE_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {users.status === 'failed' ? (
        <ErrorMessage title="Couldn't load users" message={users.error?.message} onRetry={users.reload} />
      ) : !users.data ? (
        <Loader label="Loading users…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FiUsers}
          title="No users found"
          message={debouncedSearch || role ? 'Try a different name, email or role.' : 'Registered users will show up here.'}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-stone-600" aria-live="polite">
            {pluralize(pagination.total, 'user')}
          </p>
          <AdminTable
            caption="Users"
            columns={columns}
            rows={items}
            getRowKey={(user) => user._id}
            busy={users.status === 'loading'}
            isCurrentRow={isSelf}
            renderActions={(user) => {
              const self = isSelf(user)
              const selfHint = self ? "You can't change your own account here" : undefined
              return (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm min-h-10"
                    onClick={() => setPending({ type: 'role', user })}
                    disabled={self}
                    title={selfHint}
                  >
                    <FiShield aria-hidden="true" />
                    {user.role === 'admin' ? 'Make customer' : 'Make admin'}
                    {self && <span className="sr-only"> (disabled for your own account)</span>}
                  </button>
                  <button
                    type="button"
                    className="btn-icon text-red-700 hover:bg-red-50"
                    onClick={() => setPending({ type: 'delete', user })}
                    disabled={self}
                    title={selfHint ?? `Delete ${user.name}`}
                    aria-label={self ? 'Delete your own account (disabled)' : `Delete ${user.name}`}
                  >
                    <FiTrash2 aria-hidden="true" />
                  </button>
                </>
              )
            }}
          />
          <Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} className="mt-6" />
        </>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={dialogCopy?.title}
        message={dialogCopy?.message}
        confirmLabel={dialogCopy?.confirmLabel}
        tone={dialogCopy?.tone}
        busy={isPending}
        onConfirm={confirmAction}
        onCancel={closeDialog}
      >
        <DialogError message={error?.message} />
      </ConfirmDialog>
    </>
  )
}
