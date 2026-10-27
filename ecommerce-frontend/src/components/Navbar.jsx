import { useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  FiChevronDown,
  FiGrid,
  FiLogIn,
  FiLogOut,
  FiMenu,
  FiPackage,
  FiSearch,
  FiShoppingCart,
  FiUser,
  FiX,
} from 'react-icons/fi'
import { useDispatch, useSelector } from 'react-redux'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import logo from '../assets/logo.svg'
import { selectCurrentUser, selectIsAdmin, selectIsAuthenticated } from '../redux/slices/authSlice'
import { selectCartCount } from '../redux/slices/cartSlice'
import { logoutUser } from '../redux/thunks/authThunks'
import { APP_NAME } from '../utils/constants'
import { initials, pluralize } from '../utils/format'

const desktopLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-brand-50 text-brand-800' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
  }`

const mobileLinkClass = ({ isActive }) =>
  `flex min-h-11 items-center gap-3 rounded-xl px-3 text-base font-semibold transition-colors ${
    isActive ? 'bg-brand-50 text-brand-800' : 'text-stone-700 hover:bg-stone-100'
  }`

const menuItemClass =
  'flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900'

/** Product search; submitting opens the catalogue filtered by the term (`/?search=…`). */
function SearchForm({ defaultValue, onSearch, className = '' }) {
  const inputId = useId()

  const handleSubmit = (event) => {
    event.preventDefault()
    onSearch(String(new FormData(event.currentTarget).get('search') ?? '').trim())
  }

  return (
    <form role="search" onSubmit={handleSubmit} className={`relative ${className}`}>
      <label htmlFor={inputId} className="sr-only">
        Search products
      </label>
      <FiSearch
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400"
        aria-hidden="true"
      />
      {/* Uncontrolled and keyed by the URL term, so it resets whenever the catalogue search changes. */}
      <input
        key={defaultValue}
        id={inputId}
        name="search"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search products, brands…"
        autoComplete="off"
        enterKeyHint="search"
        className="input rounded-full bg-stone-50 pl-10"
      />
    </form>
  )
}

/** Account dropdown for wide screens: profile, orders, admin and logout. */
function UserMenu({ user, isAdmin, onLogout }) {
  const location = useLocation()
  const menuId = useId()
  const containerRef = useRef(null)
  const buttonRef = useRef(null)
  // Remember where the menu was opened: any navigation closes it, without an effect.
  const [openAt, setOpenAt] = useState(null)
  const open = openAt === location.key

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpenAt(null)
    }
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      setOpenAt(null)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const firstName = user.name.split(' ')[0]

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpenAt(open ? null : location.key)}
        aria-expanded={open}
        aria-controls={menuId}
        className="flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-white pr-3 pl-1 text-sm font-semibold text-stone-800 transition-colors hover:border-stone-300 hover:bg-stone-50"
      >
        <span className="grid size-8 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white" aria-hidden="true">
          {initials(user.name)}
        </span>
        <span className="max-w-28 truncate">{firstName}</span>
        <span className="sr-only">— account menu</span>
        <FiChevronDown className={`size-4 text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute right-0 z-50 mt-2 w-64 animate-fade-in rounded-2xl border border-stone-200 bg-white p-2 shadow-xl"
        >
          <div className="border-b border-stone-100 px-3 pt-2 pb-3">
            <p className="truncate text-sm font-bold text-stone-900">{user.name}</p>
            <p className="truncate text-xs text-stone-500">{user.email}</p>
          </div>
          <nav aria-label="Account" className="pt-2">
            <Link to="/profile" className={menuItemClass}>
              <FiUser className="size-4" aria-hidden="true" /> Profile
            </Link>
            <Link to="/orders" className={menuItemClass}>
              <FiPackage className="size-4" aria-hidden="true" /> My orders
            </Link>
            {isAdmin && (
              <Link to="/admin" className={menuItemClass}>
                <FiGrid className="size-4" aria-hidden="true" /> Admin dashboard
              </Link>
            )}
            <button type="button" onClick={onLogout} className={`${menuItemClass} mt-1 border-t border-stone-100 pt-1`}>
              <FiLogOut className="size-4" aria-hidden="true" /> Log out
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const user = useSelector(selectCurrentUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const isAdmin = useSelector(selectIsAdmin)
  const cartCount = useSelector(selectCartCount)

  const panelId = useId()
  const panelRef = useRef(null)
  const toggleRef = useRef(null)
  // Same trick as the user menu: the mobile panel closes itself on every navigation.
  const [menuOpenAt, setMenuOpenAt] = useState(null)
  const menuOpen = menuOpenAt === location.key
  const closeMenu = () => setMenuOpenAt(null)

  const searchTerm = location.pathname === '/' ? (searchParams.get('search') ?? '') : ''

  // Move focus into the panel when it opens; Esc closes it and returns focus to the toggle.
  useEffect(() => {
    if (!menuOpen) return undefined
    panelRef.current?.querySelector('input, a[href], button')?.focus()
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      setMenuOpenAt(null)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  const handleSearch = (term) => {
    navigate(term ? `/?search=${encodeURIComponent(term)}` : '/')
  }

  const handleLogout = async () => {
    // Leave protected pages first so their guards don't bounce the user to the login page.
    navigate('/')
    await dispatch(logoutUser())
    toast.success('You have been logged out.')
  }

  const navLinks = [
    { to: '/', label: 'Shop', end: true },
    { to: '/contact', label: 'Contact' },
    ...(isAuthenticated ? [{ to: '/orders', label: 'My orders' }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ]

  const cartLabel = `Cart, ${pluralize(cartCount, 'item')}`

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-3 lg:gap-6">
        <Link to="/" className="flex shrink-0 items-center gap-2 rounded-lg" aria-label={`${APP_NAME} home`}>
          <img src={logo} alt="" className="size-8" />
          <span className="text-lg font-extrabold tracking-tight text-brand-950">{APP_NAME}</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {navLinks.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={desktopLinkClass}>
              {label}
            </NavLink>
          ))}
        </nav>

        <SearchForm defaultValue={searchTerm} onSearch={handleSearch} className="ml-auto hidden max-w-md flex-1 md:block" />

        <div className="ml-auto flex items-center gap-1 md:ml-0 lg:gap-2">
          <NavLink
            to="/cart"
            aria-label={cartLabel}
            title={cartLabel}
            className={({ isActive }) => `btn-icon relative ${isActive ? 'bg-brand-50 text-brand-800' : ''}`}
          >
            <FiShoppingCart className="size-5" aria-hidden="true" />
            {cartCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[11px] leading-none font-bold text-white ring-2 ring-white"
                aria-hidden="true"
              >
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </NavLink>

          <div className="hidden items-center gap-2 lg:flex">
            {isAuthenticated ? (
              <UserMenu user={user} isAdmin={isAdmin} onLogout={handleLogout} />
            ) : (
              <>
                <Link to="/login" state={{ from: location }} className="btn btn-ghost">
                  Log in
                </Link>
                <Link to="/register" state={{ from: location }} className="btn btn-primary">
                  Sign up
                </Link>
              </>
            )}
          </div>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setMenuOpenAt(menuOpen ? null : location.key)}
            className="btn-icon lg:hidden"
            aria-expanded={menuOpen}
            aria-controls={panelId}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <FiX className="size-5" aria-hidden="true" /> : <FiMenu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <div
            className="fixed inset-x-0 top-16 bottom-0 bg-stone-950/30 lg:hidden"
            onClick={closeMenu}
            aria-hidden="true"
          />
          <div
            id={panelId}
            ref={panelRef}
            className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] animate-fade-in overflow-y-auto border-b border-stone-200 bg-white shadow-xl lg:hidden"
          >
            <div className="container-page space-y-4 py-4">
              <SearchForm defaultValue={searchTerm} onSearch={handleSearch} className="md:hidden" />

              <nav aria-label="Main" className="grid gap-1">
                {navLinks.map(({ to, label, end }) => (
                  <NavLink key={to} to={to} end={end} className={mobileLinkClass}>
                    {label}
                  </NavLink>
                ))}
              </nav>

              <div className="border-t border-stone-200 pt-4">
                {isAuthenticated ? (
                  <>
                    <div className="flex items-center gap-3 px-3">
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white"
                        aria-hidden="true"
                      >
                        {initials(user.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-stone-900">{user.name}</p>
                        <p className="truncate text-sm text-stone-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-1">
                      <NavLink to="/profile" className={mobileLinkClass}>
                        <FiUser className="size-5" aria-hidden="true" /> Profile
                      </NavLink>
                      <button type="button" onClick={handleLogout} className={mobileLinkClass({ isActive: false })}>
                        <FiLogOut className="size-5" aria-hidden="true" /> Log out
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link to="/login" state={{ from: location }} className="btn btn-secondary">
                      <FiLogIn aria-hidden="true" /> Log in
                    </Link>
                    <Link to="/register" state={{ from: location }} className="btn btn-primary">
                      Sign up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  )
}
