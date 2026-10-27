import { Link } from 'react-router-dom'
import logo from '../assets/logo.svg'
import { APP_NAME } from '../utils/constants'

const YEAR = new Date().getFullYear()

const LINK_GROUPS = [
  {
    title: 'Shop',
    links: [
      { to: '/', label: 'All products' },
      { to: '/?sort=popular', label: 'Best sellers' },
      { to: '/?sort=rating', label: 'Top rated' },
      { to: '/cart', label: 'Your cart' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/profile', label: 'Profile' },
      { to: '/orders', label: 'My orders' },
      { to: '/contact', label: 'Contact us' },
    ],
  },
]

const STACK = ['MongoDB', 'Express', 'React', 'Node.js', 'RapidMiner']

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-stone-200 bg-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Link to="/" className="inline-flex items-center gap-2 rounded-lg">
            <img src={logo} alt="" className="size-8" />
            <span className="text-lg font-extrabold tracking-tight text-brand-950">{APP_NAME}</span>
          </Link>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-600">
            Electronics, fashion, home and beauty at honest prices, with free delivery on orders over ₹999 and
            recommendations that learn from what shoppers like you browse and buy.
          </p>
          <p className="mt-5 text-xs font-semibold tracking-wide text-stone-500 uppercase">Built with MERN + RapidMiner</p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Technology stack">
            {STACK.map((name) => (
              <li key={name} className="badge bg-brand-50 text-brand-800">
                {name}
              </li>
            ))}
          </ul>
        </div>

        {LINK_GROUPS.map(({ title, links }) => (
          <nav key={title} aria-label={title}>
            <h2 className="text-sm font-bold text-stone-900">{title}</h2>
            <ul className="mt-3 space-y-1">
              {links.map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="inline-flex min-h-9 items-center text-sm text-stone-600 transition-colors hover:text-brand-700"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-stone-200">
        <div className="container-page flex flex-col gap-1 py-5 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {YEAR} {APP_NAME}. A demo store — no real payments are taken.
          </p>
          <p>All prices in Indian rupees (INR).</p>
        </div>
      </div>
    </footer>
  )
}
