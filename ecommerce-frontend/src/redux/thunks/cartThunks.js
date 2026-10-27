import api from '../../api/axiosInstance'
import { MAX_QUANTITY_PER_ITEM } from '../../utils/constants'
import { selectIsAuthenticated } from '../slices/authSlice'
import {
  addItem,
  clampQuantity,
  replaceCart,
  selectCartItemQuantity,
  selectCartItems,
  toCartItem,
} from '../slices/cartSlice'
import { createApiThunk } from './createApiThunk'

/**
 * Adds a product after re-reading it from the API, so the cart gets the current price and
 * the quantity is checked against live stock. Logged-in adds are reported to the
 * recommendation engine as a `cart_add` signal (best effort).
 */
export const addToCart = createApiThunk('cart/addToCart', async ({ productId, quantity = 1 }, { dispatch, getState }) => {
  const { data } = await api.get(`/products/${productId}`)
  const { product } = data
  const adding = clampQuantity(quantity)
  const inCart = selectCartItemQuantity(getState(), productId)
  const wanted = inCart + adding

  if (product.stock <= 0) throw new Error(`${product.name} is out of stock`)
  if (wanted > product.stock) {
    const alreadyIn = inCart ? ` (you already have ${inCart} in your cart)` : ''
    throw new Error(`Only ${product.stock} left of ${product.name}${alreadyIn}`)
  }
  if (wanted > MAX_QUANTITY_PER_ITEM) {
    throw new Error(`You can order up to ${MAX_QUANTITY_PER_ITEM} units of one product`)
  }

  dispatch(addItem({ product, quantity: adding }))
  if (selectIsAuthenticated(getState())) {
    api.post('/analytics/track', { productId, event: 'cart_add' }).catch(() => {})
  }
  return { product, quantity: adding }
})

/** Mirrors the local cart to the server (PUT /users/cart). Called by the debounced listener. */
export const syncCart = createApiThunk(
  'cart/sync',
  async (_, { getState }) => {
    const items = selectCartItems(getState()).map(({ productId, quantity }) => ({ product: productId, quantity }))
    await api.put('/users/cart', { items })
    return items.length
  },
  { condition: (_, { getState }) => selectIsAuthenticated(getState()) },
)

/**
 * After login, combines the cart saved on the server with what the user added as a guest.
 * Quantities are merged with max() rather than summed: when a session expires the local cart
 * is kept and is already mirrored on the server, so summing would double every line.
 */
export const mergeCartOnLogin = createApiThunk('cart/mergeOnLogin', async (_, { dispatch, getState }) => {
  const { data } = await api.get('/users/cart')
  const merged = new Map(
    (Array.isArray(data.cart) ? data.cart : [])
      .filter((entry) => entry?.product?._id)
      .map(({ product, quantity }) => [product._id, toCartItem(product, quantity)]),
  )

  const localItems = selectCartItems(getState())
  for (const item of localItems) {
    const saved = merged.get(item.productId)
    merged.set(
      item.productId,
      saved ? { ...saved, quantity: clampQuantity(Math.max(saved.quantity, item.quantity), saved.stock) } : item,
    )
  }

  // replaceCart also schedules the debounced sync, which saves the merged cart on the server.
  const items = [...merged.values()]
  dispatch(replaceCart(items))
  return items
})
