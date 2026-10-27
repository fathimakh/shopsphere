import { useLocation } from 'react-router-dom'

const AUTH_PAGES = ['/login', '/register']

/**
 * Where to send the user after logging in or registering: the page that redirected them
 * (`location.state.from`, set by ProtectedRoute and AuthWatcher) or the shop home.
 */
export default function useRedirectPath() {
  const from = useLocation().state?.from
  if (typeof from?.pathname !== 'string' || AUTH_PAGES.includes(from.pathname)) return '/'
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
}
