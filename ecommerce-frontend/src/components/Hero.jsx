import { FiArrowDown, FiCpu, FiRotateCcw, FiTruck } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { FREE_SHIPPING_THRESHOLD } from '../utils/constants'
import { formatPrice } from '../utils/format'

const PERKS = [
  { icon: FiTruck, text: `Free delivery over ${formatPrice(FREE_SHIPPING_THRESHOLD)}` },
  { icon: FiCpu, text: 'Picks tuned by RapidMiner' },
  { icon: FiRotateCcw, text: 'Cancel before it ships' },
]

/**
 * Compact home banner: value proposition plus a CTA that jumps to the catalogue.
 * Kept short on phones so products appear within the first screen or two.
 */
export default function Hero({ isAuthenticated, onShopNow }) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-brand-900 px-5 py-7 text-white sm:px-10 sm:py-10 lg:px-12 lg:py-12">
      {/* Decorative "spheres" */}
      <div aria-hidden="true" className="absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-brand-600/50 blur-2xl sm:size-96" />
      <div aria-hidden="true" className="absolute -bottom-28 left-1/3 -z-10 size-64 rounded-full bg-accent-500/25 blur-3xl" />
      <div aria-hidden="true" className="absolute top-8 right-8 -z-10 hidden size-40 rounded-full border border-white/15 lg:block" />
      <div aria-hidden="true" className="absolute top-20 right-28 -z-10 hidden size-20 rounded-full border border-white/10 bg-white/5 lg:block" />

      <div className="max-w-2xl">
        <p className="text-xs font-semibold tracking-[0.18em] text-accent-300 uppercase">ShopSphere store</p>
        <h1 className="mt-2 text-2xl leading-tight font-extrabold text-white sm:text-4xl lg:text-5xl">
          Everyday essentials, smarter picks.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-brand-100 sm:text-base">
          Phones, fashion, beauty and home, at honest prices. Search and filter the whole catalogue, and get
          recommendations that learn from what you browse.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={onShopNow} className="btn btn-accent h-11">
            Shop the catalogue <FiArrowDown aria-hidden="true" />
          </button>
          {isAuthenticated ? (
            <Link to="/orders" className="btn h-11 bg-white/10 text-white ring-1 ring-white/25 ring-inset hover:bg-white/20">
              Track my orders
            </Link>
          ) : (
            <Link to="/register" className="btn h-11 bg-white/10 text-white ring-1 ring-white/25 ring-inset hover:bg-white/20">
              Create an account
            </Link>
          )}
        </div>
      </div>

      <ul className="mt-6 hidden flex-wrap gap-x-6 gap-y-2 border-t border-white/15 pt-5 text-sm text-brand-100 sm:flex">
        {PERKS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2">
            <Icon aria-hidden="true" className="size-4 text-accent-300" />
            {text}
          </li>
        ))}
      </ul>
    </section>
  )
}
