import { useEffect, useEffectEvent } from 'react'
import toast from 'react-hot-toast'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { AUTH_STORAGE_KEY, loadAuth } from '../redux/persistence'
import { selectSessionMessage, selectToken, sessionExpired, setCredentials } from '../redux/slices/authSlice'
import { getTokenExpiry } from '../utils/jwt'

// setTimeout overflows above ~24.8 days; a token living that long is checked on the next load.
const MAX_TIMER_MS = 2 ** 31 - 1

/**
 * Renders nothing; keeps the UI in step with the session:
 *  1. ends the session the moment the JWT expires (decoded `exp`),
 *  2. when a session ends (expiry timer or a 401 from the API) shows a toast and sends the
 *     user to /login?expired=1, remembering the page they were on,
 *  3. follows logins and logouts made in other tabs.
 */
export default function AuthWatcher() {
  const dispatch = useDispatch()
  const store = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const token = useSelector(selectToken)
  const sessionMessage = useSelector(selectSessionMessage)

  useEffect(() => {
    const expiresAt = getTokenExpiry(token)
    if (!token || expiresAt === null) return undefined
    const delay = expiresAt - Date.now()
    if (delay > MAX_TIMER_MS) return undefined
    const timer = setTimeout(() => dispatch(sessionExpired()), Math.max(delay, 0))
    return () => clearTimeout(timer)
  }, [token, dispatch])

  // An effect event reads the latest location without re-running the effect on navigation.
  const redirectToLogin = useEffectEvent((message) => {
    toast.error(message, { id: 'session-ended' })
    navigate('/login?expired=1', { replace: true, state: { from: location } })
  })

  useEffect(() => {
    if (sessionMessage) redirectToLogin(sessionMessage)
  }, [sessionMessage])

  useEffect(() => {
    const syncFromOtherTab = (event) => {
      // `key` is null when another tab cleared all of localStorage.
      if (event.key !== AUTH_STORAGE_KEY && event.key !== null) return
      const session = loadAuth()
      const currentToken = store.getState().auth.token
      if (session?.token === currentToken) return
      if (session) dispatch(setCredentials(session))
      else if (currentToken) dispatch(sessionExpired('You were signed out in another tab.'))
    }
    window.addEventListener('storage', syncFromOtherTab)
    return () => window.removeEventListener('storage', syncFromOtherTab)
  }, [dispatch, store])

  return null
}
