import api from '../../api/axiosInstance'
import { createApiThunk } from './createApiThunk'

// Catalogue and recommendation endpoints: docs/API_CONTRACT.md §3.4 and §3.6.
// List/detail thunks pass the abort signal to Axios, so a component can cancel a request it
// no longer needs: `const request = dispatch(fetchProducts(params)); return () => request.abort()`.

/** Drops empty filter values so the URL query (and the API request) stays clean. */
function cleanParams(params = {}) {
  const entries = params instanceof URLSearchParams ? params.entries() : Object.entries(params)
  return Object.fromEntries([...entries].filter(([, value]) => value !== undefined && value !== null && value !== ''))
}

/** GET /products with search, filter, sort and pagination params → `{ products, pagination }`. */
export const fetchProducts = createApiThunk('products/fetchList', async (params, { signal }) => {
  const { data } = await api.get('/products', { params: cleanParams(params), signal })
  return { products: data.products, pagination: data.pagination }
})

export const fetchProductById = createApiThunk('products/fetchById', async (id, { signal }) => {
  const { data } = await api.get(`/products/${id}`, { signal })
  return data.product
})

export const fetchCategories = createApiThunk(
  'products/fetchCategories',
  async () => {
    const { data } = await api.get('/products/categories')
    return data.categories
  },
  { condition: (_, { getState }) => getState().products.categories.status !== 'loading' },
)

/** Personalised for a logged-in user (the JWT is sent automatically), trending for guests. */
export const fetchRecommendations = createApiThunk('products/fetchRecommendations', async ({ limit } = {}, { signal }) => {
  const { data } = await api.get('/analytics/recommendations', { params: cleanParams({ limit }), signal })
  return { products: data.products, source: data.source, strategy: data.strategy }
})

export const fetchSimilarProducts = createApiThunk(
  'products/fetchSimilar',
  async ({ productId, limit }, { signal }) => {
    const { data } = await api.get(`/analytics/recommendations/product/${productId}`, {
      params: cleanParams({ limit }),
      signal,
    })
    return { products: data.products, source: data.source }
  },
)

/** Creates or updates the caller's review and returns the recalculated product. */
export const addReview = createApiThunk('products/addReview', async ({ productId, rating, comment }) => {
  const { data } = await api.post(`/products/${productId}/reviews`, { rating: Number(rating), comment: comment?.trim() })
  return data.product
})
