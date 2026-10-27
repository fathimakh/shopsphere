import { configureStore } from '@reduxjs/toolkit'
import { listenerMiddleware } from './listeners'
import { loadAuth, loadCart } from './persistence'
import authReducer from './slices/authSlice'
import cartReducer from './slices/cartSlice'
import orderReducer from './slices/orderSlice'
import productReducer from './slices/productSlice'

/**
 * Rehydrates the session and cart saved by the listeners. Expired or malformed sessions are
 * dropped by loadAuth(); a restored token still has to be confirmed by GET /auth/me
 * (dispatched in main.jsx), so `initialized` starts false until that check finishes.
 */
function loadPreloadedState() {
  const session = loadAuth()
  return {
    auth: {
      ...authReducer.getInitialState(),
      ...session,
      initialized: !session,
    },
    cart: { ...cartReducer.getInitialState(), items: loadCart() },
  }
}

export const store = configureStore({
  reducer: {
    auth: authReducer,
    products: productReducer,
    cart: cartReducer,
    orders: orderReducer,
  },
  preloadedState: loadPreloadedState(),
  // The listener middleware goes first so its effects see every action, thunks included.
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listenerMiddleware.middleware),
  devTools: import.meta.env.DEV,
})

export default store
