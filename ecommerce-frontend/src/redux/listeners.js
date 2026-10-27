import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { clearAuth, saveAuth, saveCart } from './persistence'
import { selectIsAuthenticated } from './slices/authSlice'
import { addItem, clearCart, removeItem, replaceCart, updateQuantity } from './slices/cartSlice'
import { loginUser, registerUser } from './thunks/authThunks'
import { mergeCartOnLogin, syncCart } from './thunks/cartThunks'

/**
 * Side effects that react to state changes, kept out of reducers and components:
 * persistence to localStorage, the server-side cart mirror and the post-login cart merge.
 */
export const listenerMiddleware = createListenerMiddleware()
const { startListening } = listenerMiddleware

const CART_SYNC_DELAY_MS = 600

// Persist the session whenever the token or user changes (login, register, profile update,
// password change) and forget it when the session ends (logout, expiry, deleted account).
startListening({
  predicate: (_action, current, previous) =>
    current.auth.token !== previous.auth.token || current.auth.user !== previous.auth.user,
  effect: (_action, { getState }) => {
    const { token, user } = getState().auth
    if (token && user) saveAuth({ token, user })
    else clearAuth()
  },
})

// Persist the cart on every change so it survives reloads, guests included.
startListening({
  predicate: (_action, current, previous) => current.cart.items !== previous.cart.items,
  effect: (_action, { getState }) => saveCart(getState().cart.items),
})

// Mirror cart edits (and the post-login merge) to the server for logged-in users, debounced:
// each new edit cancels the pending sync, so a burst of +/- clicks sends a single PUT /users/cart.
// Logout and placing an order empty the cart through their own actions, so they never sync.
startListening({
  matcher: isAnyOf(addItem, updateQuantity, removeItem, clearCart, replaceCart),
  effect: async (_action, { cancelActiveListeners, delay, dispatch, getState }) => {
    cancelActiveListeners()
    await delay(CART_SYNC_DELAY_MS)
    if (selectIsAuthenticated(getState())) await dispatch(syncCart())
  },
})

// Combine the guest cart with the cart saved on the account right after signing in.
startListening({
  matcher: isAnyOf(loginUser.fulfilled, registerUser.fulfilled),
  effect: async (_action, { dispatch }) => {
    await dispatch(mergeCartOnLogin())
  },
})
