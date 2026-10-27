import { createSelector, createSlice } from '@reduxjs/toolkit'
import { FREE_SHIPPING_THRESHOLD, MAX_QUANTITY_PER_ITEM, SHIPPING_FEE } from '../../utils/constants'
import { placeOrder } from '../thunks/orderThunks'
import { logout } from './authSlice'

/*
 * Shopping cart: one line per product, `{ productId, name, price, image, stock, quantity }`.
 * Name, price, image and stock are a snapshot for display; the server re-reads every product
 * when an order is placed, so these values are never trusted for pricing.
 */

/** Whole quantity between 1 and the available stock (when known) and the per-line maximum. */
export function clampQuantity(quantity, stock) {
  let value = Math.floor(Number(quantity))
  if (!Number.isFinite(value) || value < 1) value = 1
  if (Number.isFinite(stock) && stock > 0) value = Math.min(value, stock)
  return Math.min(value, MAX_QUANTITY_PER_ITEM)
}

/** Builds a cart line from an API product object. */
export function toCartItem(product, quantity = 1) {
  const stock = Number(product.stock)
  return {
    productId: product._id,
    name: product.name,
    price: Number(product.price) || 0,
    image: product.thumbnail || product.images?.[0] || '',
    stock: Number.isFinite(stock) ? stock : 0,
    quantity: clampQuantity(quantity, stock),
  }
}

/** Validates untrusted cart lines (localStorage, replaceCart) and merges duplicates. */
export function sanitizeCartItems(items) {
  const byId = new Map()
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item.productId !== 'string' || typeof item.name !== 'string') continue
    const price = Number(item.price)
    if (!Number.isFinite(price) || price < 0) continue
    const stock = Number.isFinite(Number(item.stock)) ? Number(item.stock) : 0
    const previous = byId.get(item.productId)
    byId.set(item.productId, {
      productId: item.productId,
      name: item.name,
      price,
      image: typeof item.image === 'string' ? item.image : '',
      stock,
      quantity: clampQuantity((previous?.quantity ?? 0) + Number(item.quantity || 0), stock),
    })
  }
  return [...byId.values()]
}

const initialState = { items: [] }

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem(state, action) {
      const { product, quantity = 1 } = action.payload
      const fresh = toCartItem(product, quantity)
      const existing = state.items.find((item) => item.productId === fresh.productId)
      if (existing) {
        // Refresh the snapshot (price or stock may have changed) and add to the quantity.
        Object.assign(existing, fresh, { quantity: clampQuantity(existing.quantity + fresh.quantity, fresh.stock) })
      } else {
        state.items.push(fresh)
      }
    },
    updateQuantity(state, action) {
      const { productId, quantity } = action.payload
      const item = state.items.find((line) => line.productId === productId)
      if (!item) return
      if (Number(quantity) < 1) {
        state.items = state.items.filter((line) => line.productId !== productId)
      } else {
        item.quantity = clampQuantity(quantity, item.stock)
      }
    },
    removeItem(state, action) {
      state.items = state.items.filter((item) => item.productId !== action.payload)
    },
    clearCart(state) {
      state.items = []
    },
    replaceCart(state, action) {
      state.items = sanitizeCartItems(action.payload)
    },
  },
  extraReducers: (builder) => {
    builder
      // An explicit logout empties the local cart (it stays saved on the server for next time).
      // A session that merely expires keeps it, so nothing is lost before logging back in.
      .addCase(logout, () => initialState)
      .addCase(placeOrder.fulfilled, () => initialState)
  },
})

export const { addItem, updateQuantity, removeItem, clearCart, replaceCart } = cartSlice.actions

export const selectCartItems = (state) => state.cart.items

export const selectCartCount = createSelector([selectCartItems], (items) =>
  items.reduce((count, item) => count + item.quantity, 0),
)

export const selectCartSubtotal = createSelector([selectCartItems], (items) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0),
)

/** Same rule as the server (contract §2): free from ₹999, otherwise ₹49; nothing for an empty cart. */
export const selectShippingFee = createSelector([selectCartSubtotal], (subtotal) =>
  subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE,
)

export const selectCartTotal = createSelector(
  [selectCartSubtotal, selectShippingFee],
  (subtotal, shipping) => subtotal + shipping,
)

export const selectCartItemQuantity = (state, productId) =>
  state.cart.items.find((item) => item.productId === productId)?.quantity ?? 0

export default cartSlice.reducer
