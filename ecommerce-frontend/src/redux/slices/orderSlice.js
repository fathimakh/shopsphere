import { createSlice, isAnyOf } from '@reduxjs/toolkit'
import { cancelOrder, fetchMyOrders, fetchOrderById, placeOrder } from '../thunks/orderThunks'
import { logout, sessionExpired } from './authSlice'

/*
 * The signed-in user's orders: `mine` (order history), `current` (detail page) and
 * `placing` (checkout submission). Cleared on logout because orders are private.
 */

const initialState = {
  mine: { items: [], status: 'idle', error: null },
  current: { item: null, status: 'idle', error: null, requestId: null },
  placing: { status: 'idle', error: null },
}

const errorMessage = (action) => action.payload?.message ?? action.error.message ?? 'Something went wrong'

/** Keeps the history list and the detail view in sync after an order changes. */
function upsertOrder(state, order) {
  const index = state.mine.items.findIndex((item) => item._id === order._id)
  if (index !== -1) state.mine.items[index] = order
  else if (state.mine.status === 'succeeded') state.mine.items.unshift(order)
  if (state.current.item?._id === order._id) state.current.item = order
}

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(placeOrder.pending, (state) => {
        state.placing = { status: 'loading', error: null }
      })
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.placing = { status: 'succeeded', error: null }
        upsertOrder(state, action.payload)
        state.current = { item: action.payload, status: 'succeeded', error: null, requestId: null }
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.placing = { status: 'failed', error: errorMessage(action) }
      })

      .addCase(fetchMyOrders.pending, (state) => {
        state.mine.status = 'loading'
        state.mine.error = null
      })
      .addCase(fetchMyOrders.fulfilled, (state, action) => {
        state.mine.items = action.payload
        state.mine.status = 'succeeded'
      })
      .addCase(fetchMyOrders.rejected, (state, action) => {
        if (action.meta.aborted) return
        state.mine.status = 'failed'
        state.mine.error = errorMessage(action)
      })

      .addCase(fetchOrderById.pending, (state, action) => {
        if (state.current.item?._id !== action.meta.arg) state.current.item = null
        state.current.status = 'loading'
        state.current.error = null
        state.current.requestId = action.meta.requestId
      })
      .addCase(fetchOrderById.fulfilled, (state, action) => {
        if (state.current.requestId !== action.meta.requestId) return
        state.current.item = action.payload
        state.current.status = 'succeeded'
      })
      .addCase(fetchOrderById.rejected, (state, action) => {
        if (state.current.requestId !== action.meta.requestId || action.meta.aborted) return
        state.current.status = 'failed'
        state.current.error = errorMessage(action)
      })

      .addCase(cancelOrder.fulfilled, (state, action) => {
        upsertOrder(state, action.payload)
      })

      .addMatcher(isAnyOf(logout, sessionExpired), () => initialState)
  },
})

export const selectMyOrders = (state) => state.orders.mine
export const selectCurrentOrder = (state) => state.orders.current
export const selectPlacingOrder = (state) => state.orders.placing

export default orderSlice.reducer
