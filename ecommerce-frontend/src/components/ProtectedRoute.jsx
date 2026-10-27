import { FiLock } from 'react-icons/fi'
import { useSelector } from 'react-redux'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  selectAuthInitialized,
  selectCurrentUser,
  selectIsAuthenticated,
  selectSessionMessage,
} from '../redux/slices/authSlice'
import Loader from './Loader'

/**
 * Guards a route (wrap an element, or use it as a layout route rendering an <Outlet/>).
 *  - While a restored session is being validated → full-page loader.
 *  - Guest → /login, remembering the page so login can send them back.
 *  - Logged in without `requiredRole` → a friendly 403 panel (no redirect loop).
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const location = useLocation()
  const initialized = useSelector(selectAuthInitialized)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectCurrentUser)
  const sessionMessage = useSelector(selectSessionMessage)

  if (!initialized) return <Loader fullPage label="Checking your session…" />

  if (!isAuthenticated) {
    // Same target as AuthWatcher when a session expires, so both redirects agree.
    const to = sessionMessage ? '/login?expired=1' : '/login'
    return <Navigate to={to} state={{ from: location }} replace />
  }

  if (requiredRole && user.role !== requiredRole) return <AccessDenied user={user} requiredRole={requiredRole} />

  return children ?? <Outlet />
}

function AccessDenied({ user, requiredRole }) {
  return (
    <div className="container-page py-16 sm:py-24">
      <div className="card mx-auto flex max-w-lg flex-col items-center px-6 py-12 text-center sm:px-10">
        <span className="grid size-14 place-items-center rounded-2xl bg-accent-50 text-accent-700">
          <FiLock className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm font-semibold tracking-wide text-accent-700 uppercase">403 · Access denied</p>
        <h1 className="mt-1 text-2xl font-extrabold">This area is for {requiredRole}s only</h1>
        <p className="mt-3 text-sm text-stone-600">
          You&apos;re signed in as <span className="font-semibold text-stone-800">{user.email}</span>, which
          doesn&apos;t have {requiredRole} access. Sign in with a different account if you manage the store.
        </p>
        <div className="mt-8 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link to="/" className="btn btn-primary">
            Back to the shop
          </Link>
          <Link to="/profile" className="btn btn-secondary">
            My account
          </Link>
        </div>
      </div>
    </div>
  )
}
