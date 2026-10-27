import { createSlice, isAnyOf } from '@reduxjs/toolkit'
import {
  changePassword,
  fetchCurrentUser,
  loginUser,
  registerUser,
  updateProfile,
} from '../thunks/authThunks'

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.'

/**
 * Authentication state.
 *  - `status` / `error` describe the current login or registration request.
 *  - `initialized` turns true once a persisted token has been checked with GET /auth/me
 *    (or immediately when there is none); protected routes wait for it.
 *  - `sessionMessage` is set when the server or the expiry timer ends the session, so the
 *    login page can explain why the user was signed out.
 */
const initialState = {
  user: null,
  token: null,
  status: 'idle',
  error: null,
  initialized: true,
  sessionMessage: null,
}

const signedOut = (sessionMessage = null) => ({ ...initialState, sessionMessage })

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action) {
      const { user, token } = action.payload
      state.user = user
      state.token = token
      state.status = 'succeeded'
      state.error = null
      state.initialized = true
      state.sessionMessage = null
    },
    logout() {
      return signedOut()
    },
    sessionExpired: {
      reducer(state, action) {
        // Several in-flight requests can fail with 401 at once; only the first one counts.
        if (!state.token) return state
        return signedOut(action.payload || SESSION_EXPIRED_MESSAGE)
      },
      prepare: (message) => ({ payload: typeof message === 'string' ? message : null }),
    },
    clearAuthError(state) {
      state.error = null
      if (state.status === 'failed') state.status = 'idle'
    },
    clearSessionMessage(state) {
      state.sessionMessage = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        // Ignore a stale answer if the user logged in or out while /auth/me was in flight.
        if (action.payload.token === state.token) state.user = action.payload.user
        state.initialized = true
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        // A 401 has already ended the session through the axios interceptor. Other failures
        // (offline, server waking up) keep the stored session so the shop stays usable.
        if (!action.meta.aborted) state.initialized = true
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        // The server revokes every older token, so switch to the new one immediately.
        state.token = action.payload.token
      })
      .addMatcher(isAnyOf(loginUser.pending, registerUser.pending), (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addMatcher(isAnyOf(loginUser.fulfilled, registerUser.fulfilled), (state, action) => {
        state.user = action.payload.user
        state.token = action.payload.token
        state.status = 'succeeded'
        state.initialized = true
        state.sessionMessage = null
      })
      .addMatcher(isAnyOf(loginUser.rejected, registerUser.rejected), (state, action) => {
        state.status = 'failed'
        state.error = action.payload?.message ?? action.error.message ?? 'Something went wrong'
      })
  },
})

export const { setCredentials, logout, sessionExpired, clearAuthError, clearSessionMessage } = authSlice.actions

export const selectCurrentUser = (state) => state.auth.user
export const selectToken = (state) => state.auth.token
export const selectIsAuthenticated = (state) => Boolean(state.auth.token && state.auth.user)
export const selectIsAdmin = (state) => state.auth.user?.role === 'admin'
export const selectAuthStatus = (state) => state.auth.status
export const selectAuthError = (state) => state.auth.error
export const selectAuthInitialized = (state) => state.auth.initialized
export const selectSessionMessage = (state) => state.auth.sessionMessage

export default authSlice.reducer
