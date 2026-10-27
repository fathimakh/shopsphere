import { FiArrowLeft, FiCompass } from 'react-icons/fi'
import { Link, useLocation } from 'react-router-dom'
import useDocumentTitle from '../hooks/useDocumentTitle'

export default function NotFound() {
  useDocumentTitle('Page not found')
  const { pathname } = useLocation()

  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16">
      <div className="max-w-lg text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <FiCompass className="size-8" aria-hidden="true" />
        </span>
        <p className="mt-6 text-sm font-bold tracking-widest text-accent-600 uppercase">Error 404</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-stone-600">
          Nothing lives at <code className="rounded bg-stone-100 px-1.5 py-0.5 text-sm break-all text-stone-800">{pathname}</code>.
          It may have moved, or the link might have a typo.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/" className="btn btn-primary btn-lg">
            <FiArrowLeft aria-hidden="true" /> Back to the shop
          </Link>
          <Link to="/contact" className="btn btn-secondary btn-lg">
            Contact support
          </Link>
        </div>
      </div>
    </div>
  )
}
