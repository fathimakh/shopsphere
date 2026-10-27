import { createSlice, isAnyOf } from '@reduxjs/toolkit'
import { PRODUCTS_PER_PAGE } from '../../utils/constants'
import {
  addReview,
  fetchCategories,
  fetchProductById,
  fetchProducts,
  fetchRecommendations,
  fetchSimilarProducts,
} from '../thunks/productThunks'
import { logout, sessionExpired } from './authSlice'

/*
 * Catalogue state. Each request-driven branch remembers the id of its latest request
 * (`requestId`), so when filters change quickly only the newest response is stored and
 * older, slower answers are dropped instead of overwriting fresher data.
 */

const emptyPagination = { page: 1, limit: PRODUCTS_PER_PAGE, total: 0, pages: 0 }

const initialRecommendations = {
  items: [],
  source: null,
  strategy: null,
  status: 'idle',
  error: null,
  requestId: null,
}

const initialState = {
  list: { items: [], pagination: emptyPagination, status: 'idle', error: null, requestId: null },
  current: { item: null, status: 'idle', error: null, requestId: null },
  categories: { items: [], status: 'idle' },
  recommendations: initialRecommendations,
  similar: { productId: null, items: [], source: null, status: 'idle', error: null },
}

const errorMessage = (action) => action.payload?.message ?? action.error.message ?? 'Something went wrong'

/** After a review, shows the recalculated product and refreshes its rating in the list. */
function applyReviewedProduct(state, product) {
  if (state.current.item?._id === product._id) state.current.item = product
  const listed = state.list.items.find((item) => item._id === product._id)
  if (listed) Object.assign(listed, { rating: product.rating, numReviews: product.numReviews })
}

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Product list (catalogue page)
      .addCase(fetchProducts.pending, (state, action) => {
        state.list.status = 'loading'
        state.list.error = null
        state.list.requestId = action.meta.requestId
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) return
        state.list.items = action.payload.products
        state.list.pagination = action.payload.pagination ?? emptyPagination
        state.list.status = 'succeeded'
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        if (state.list.requestId !== action.meta.requestId || action.meta.aborted) return
        state.list.status = 'failed'
        state.list.error = errorMessage(action)
      })

      // Single product (detail page)
      .addCase(fetchProductById.pending, (state, action) => {
        // Never flash the previous product while another one loads.
        if (state.current.item?._id !== action.meta.arg) state.current.item = null
        state.current.status = 'loading'
        state.current.error = null
        state.current.requestId = action.meta.requestId
      })
      .addCase(fetchProductById.fulfilled, (state, action) => {
        if (state.current.requestId !== action.meta.requestId) return
        state.current.item = action.payload
        state.current.status = 'succeeded'
      })
      .addCase(fetchProductById.rejected, (state, action) => {
        if (state.current.requestId !== action.meta.requestId || action.meta.aborted) return
        state.current.status = 'failed'
        state.current.error = errorMessage(action)
      })

      // Categories (filter sidebar)
      .addCase(fetchCategories.pending, (state) => {
        state.categories.status = 'loading'
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories.items = action.payload
        state.categories.status = 'succeeded'
      })
      .addCase(fetchCategories.rejected, (state) => {
        state.categories.status = 'failed'
      })

      // Personalised recommendations (RapidMiner-backed engine)
      .addCase(fetchRecommendations.pending, (state, action) => {
        state.recommendations.status = 'loading'
        state.recommendations.error = null
        state.recommendations.requestId = action.meta.requestId
      })
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        if (state.recommendations.requestId !== action.meta.requestId) return
        const { products, source, strategy } = action.payload
        Object.assign(state.recommendations, { items: products, source, strategy, status: 'succeeded' })
      })
      .addCase(fetchRecommendations.rejected, (state, action) => {
        if (state.recommendations.requestId !== action.meta.requestId || action.meta.aborted) return
        state.recommendations.status = 'failed'
        state.recommendations.error = errorMessage(action)
      })

      // "You may also like" for one product
      .addCase(fetchSimilarProducts.pending, (state, action) => {
        const { productId } = action.meta.arg
        if (state.similar.productId !== productId) {
          state.similar.items = []
          state.similar.source = null
        }
        state.similar.productId = productId
        state.similar.status = 'loading'
        state.similar.error = null
      })
      .addCase(fetchSimilarProducts.fulfilled, (state, action) => {
        if (state.similar.productId !== action.meta.arg.productId) return
        state.similar.items = action.payload.products
        state.similar.source = action.payload.source
        state.similar.status = 'succeeded'
      })
      .addCase(fetchSimilarProducts.rejected, (state, action) => {
        if (state.similar.productId !== action.meta.arg.productId || action.meta.aborted) return
        state.similar.status = 'failed'
        state.similar.error = errorMessage(action)
      })

      .addCase(addReview.fulfilled, (state, action) => {
        applyReviewedProduct(state, action.payload)
      })

      // Personalised picks belong to the previous user; drop them when the session ends.
      .addMatcher(isAnyOf(logout, sessionExpired), (state) => {
        state.recommendations = initialRecommendations
      })
  },
})

export const selectProductList = (state) => state.products.list
export const selectCurrentProduct = (state) => state.products.current
export const selectCategories = (state) => state.products.categories
export const selectRecommendations = (state) => state.products.recommendations
export const selectSimilarProducts = (state) => state.products.similar

export default productSlice.reducer
