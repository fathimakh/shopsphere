import { Suspense, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { FiCpu, FiGrid, FiMail, FiPackage, FiShoppingBag, FiUsers } from 'react-icons/fi'
import Loader from '../../components/Loader'
import { selectCurrentUser } from '../../redux/slices/authSlice'

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: FiGrid, end: true },
  { to: '/admin/products', label: 'Products', icon: FiPackage },
  { to: '/admin/orders', label: 'Orders', icon: FiShoppingBag },
  { to: '/admin/users', label: 'Users', icon: FiUsers },
  { to: '/admin/messages', label: 'Messages', icon: FiMail },
  { to: '/admin/recommendations', label: 'Recommendations', icon: FiCpu },
]

const linkClass = ({ isActive }) =>
  `flex min-h-10 shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
    isActive
      ? 'bg-brand-700 text-white shadow-sm'
      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900 lg:hover:bg-white'
  }`

/**
 * Shell for every /admin screen (route guarded by ProtectedRoute requiredRole="admin"):
 * section header, sub-navigation (scrollable tabs on phones, sidebar from lg) and the outlet.
 */
export default function AdminLayout() {
  const user = useSelector(selectCurrentUser)
  const { pathname } = useLocation()
  const navRef = useRef(null)

  // Keep the active tab visible in the horizontally scrolling tab bar on small screens.
  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector('[aria-current="page"]')
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return
    nav.scrollTo({ left: active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' })
  }, [pathname])

  return (
    <div className="container-page py-6 sm:py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-2 lg:mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest text-brand-700 uppercase">ShopSphere</p>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Admin</h1>
        </div>
        {user && (
          <p className="text-sm text-stone-600">
            Signed in as <span className="font-semibold text-stone-900">{user.name}</span>
          </p>
        )}
      </header>

      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <nav aria-label="Admin sections" className="-mx-4 mb-6 sm:-mx-6 lg:sticky lg:top-24 lg:mx-0 lg:mb-0">
          <ul
            ref={navRef}
            className="scroll-x relative flex gap-1.5 px-4 pb-2 sm:px-6 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-2xl lg:border lg:border-stone-200/80 lg:bg-stone-50 lg:p-2"
          >
            {ADMIN_LINKS.map(({ to, label, icon: Icon, end }) => (
              <li key={to} className="shrink-0">
                <NavLink to={to} end={end} className={linkClass}>
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* The app shell already renders <main>; this is just the content column. */}
        <div className="min-w-0">
          <Suspense fallback={<Loader />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
