import { FiShield, FiTruck, FiZap } from 'react-icons/fi'
import logo from '../assets/logo.svg'
import { APP_NAME } from '../utils/constants'

const PERKS = [
  { icon: FiZap, title: 'Picks made for you', text: 'Recommendations scored by our RapidMiner similarity model.' },
  { icon: FiTruck, title: 'Free delivery over ₹999', text: 'A flat ₹49 below that — no surprises at checkout.' },
  { icon: FiShield, title: 'Secure by default', text: 'Passwords hashed with bcrypt, sessions signed as JWTs.' },
]

/** Two-panel frame for the login and register pages; the brand panel appears from `lg` up. */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="container-page py-8 sm:py-12 lg:py-16">
      <div className="card mx-auto grid max-w-5xl overflow-hidden lg:grid-cols-[1fr_1.15fr]">
        <aside className="relative hidden overflow-hidden bg-brand-950 p-10 text-brand-50 lg:flex lg:flex-col">
          <div
            className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-700/40 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-28 -left-16 size-72 rounded-full bg-accent-500/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-2.5">
            <img src={logo} alt="" className="size-9" />
            <span className="text-lg font-extrabold tracking-tight text-white">{APP_NAME}</span>
          </div>
          <p className="relative mt-10 text-3xl leading-tight font-extrabold text-white">
            Everything you love, <span className="text-accent-300">picked smarter.</span>
          </p>
          <ul className="relative mt-10 space-y-6">
            {PERKS.map(({ icon: Icon, title: perkTitle, text }) => (
              <li key={perkTitle} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-accent-300">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-white">{perkTitle}</span>
                  <span className="mt-0.5 block text-sm text-brand-100/80">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="p-6 sm:p-10">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-stone-600">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-8 border-t border-stone-200 pt-6 text-center text-sm text-stone-600">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
