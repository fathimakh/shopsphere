import api from '../../api/axiosInstance'
import { selectCartItems } from '../slices/cartSlice'
import { createApiThunk } from './createApiThunk'

// Order endpoints: docs/API_CONTRACT.md §3.5.

/**
 * Places an order. Only product ids and quantities are sent — the server reads names and
 * prices from the database. `items` defaults to the cart; the cart is emptied on success.
 */
export const placeOrder = createApiThunk(
  'orders/place',
  async ({ items, shippingAddress, paymentMethod }, { getState }) => {
    const lines = (items ?? selectCartItems(getState())).map(({ product, productId, quantity }) => ({
      product: product ?? productId,
      quantity,
    }))
    const { data } = await api.post('/orders', { items: lines, shippingAddress, paymentMethod })
    return data.order
  },
)

export const fetchMyOrders = createApiThunk('orders/fetchMine', async (_, { signal }) => {
  const { data } = await api.get('/orders/my', { signal })
  return data.orders
})

export const fetchOrderById = createApiThunk('orders/fetchById', async (id, { signal }) => {
  const { data } = await api.get(`/orders/${id}`, { signal })
  return data.order
})

export const cancelOrder = createApiThunk('orders/cancel', async (id) => {
  const { data } = await api.put(`/orders/${id}/cancel`)
  return data.order
})
