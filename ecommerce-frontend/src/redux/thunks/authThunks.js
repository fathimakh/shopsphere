import api from '../../api/axiosInstance'
import { logout, selectToken } from '../slices/authSlice'
import { createApiThunk } from './createApiThunk'

// Auth endpoints: docs/API_CONTRACT.md §3.2 (/auth) and §3.3 (/users/profile).

export const loginUser = createApiThunk('auth/login', async ({ email, password }) => {
  const { data } = await api.post('/auth/login', { email: email.trim(), password })
  return { user: data.user, token: data.token }
})

export const registerUser = createApiThunk('auth/register', async ({ name, email, password }) => {
  const { data } = await api.post('/auth/register', { name: name.trim(), email: email.trim(), password })
  return { user: data.user, token: data.token }
})

/** Validates the persisted token on app load and refreshes the user (GET /auth/me). */
export const fetchCurrentUser = createApiThunk(
  'auth/fetchCurrentUser',
  async (_, { getState, signal }) => {
    const token = selectToken(getState())
    const { data } = await api.get('/auth/me', { signal })
    // The token is returned so the reducer can ignore the answer if the session changed meanwhile.
    return { user: data.user, token }
  },
  { condition: (_, { getState }) => Boolean(selectToken(getState())) },
)

/**
 * Ends the session. A normal logout is instant: JWTs are stateless, so the server is only
 * told in the background. "Log out of all devices" must reach the server first, because
 * that is what revokes every other token.
 */
export const logoutUser = createApiThunk('auth/logoutUser', async ({ allDevices = false } = {}, { dispatch, getState }) => {
  const token = selectToken(getState())
  if (allDevices) {
    await api.post('/auth/logout', { allDevices: true })
  } else if (token) {
    // The explicit header keeps the request authenticated after the local logout below.
    api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
  }
  dispatch(logout())
  return { allDevices }
})

export const updateProfile = createApiThunk('auth/updateProfile', async (fields) => {
  const { data } = await api.put('/users/profile', fields)
  return data.user
})

/** The server revokes older tokens and returns a new one, which the auth slice stores. */
export const changePassword = createApiThunk('auth/changePassword', async ({ currentPassword, newPassword }) => {
  const { data } = await api.put('/users/profile/password', { currentPassword, newPassword })
  return { token: data.token, message: data.message }
})

export const deleteAccount = createApiThunk('auth/deleteAccount', async ({ password }, { dispatch }) => {
  const { data } = await api.delete('/users/profile', { data: { password } })
  dispatch(logout())
  return data.message
})
