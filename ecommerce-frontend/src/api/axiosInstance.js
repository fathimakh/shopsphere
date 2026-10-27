import axios from 'axios'
import { sessionExpired } from '../redux/slices/authSlice'
import { trackRequestEnd, trackRequestStart } from './serverStatus'

// Error helpers live in a dependency-free module so thunks can use them without importing
// this file (which imports the auth slice). Re-exported here as the contract's public API.
export { getErrorMessage, getFieldErrors, toApiError } from './apiErrors'

/**
 * Single Axios instance used for every call to the ShopSphere API (docs/API_CONTRACT.md §6).
 *  - baseURL comes from VITE_API_URL (includes the /api suffix), inlined by Vite at build time.
 *  - The request interceptor attaches the JWT from the Redux store.
 *  - The response interceptor ends the session when the server rejects the token.
 */

const API_URL = import.meta.env.VITE_API_URL

if (!API_URL && import.meta.env.DEV) {
  console.warn(
    '[ShopSphere] VITE_API_URL is not set — falling back to "/api". ' +
      'Copy .env.example to .env (VITE_API_URL=http://localhost:5050/api) and restart Vite.',
  )
}

/** 401 codes meaning the stored session is no longer valid (contract §2). */
const SESSION_ERROR_CODES = new Set(['TOKEN_EXPIRED', 'TOKEN_INVALID', 'TOKEN_REVOKED', 'USER_NOT_FOUND'])

const api = axios.create({
  baseURL: API_URL || '/api',
  timeout: 20000,
  headers: { Accept: 'application/json' },
})

// The store is injected at startup (main.jsx) instead of imported: the store imports the
// listeners and thunks, which import this module, so a direct import would be circular.
let store

export function injectStore(appStore) {
  store = appStore
}

api.interceptors.request.use((config) => {
  const token = store?.getState().auth.token
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  config.requestId = trackRequestStart()
  return config
})

api.interceptors.response.use(
  (response) => {
    trackRequestEnd(response.config.requestId)
    return response
  },
  (error) => {
    const { config, response } = error
    trackRequestEnd(config?.requestId)

    // Only a request that actually carried our token can prove the session is dead;
    // e.g. a wrong password on /auth/login (INVALID_CREDENTIALS) must not log anyone out.
    const sentToken = Boolean(config?.headers?.has?.('Authorization'))
    if (response?.status === 401 && sentToken && SESSION_ERROR_CODES.has(response.data?.code)) {
      store?.dispatch(sessionExpired())
    }
    return Promise.reject(error)
  },
)

export default api
