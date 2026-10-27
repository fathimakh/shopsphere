import { createAsyncThunk } from '@reduxjs/toolkit'
import { toApiError } from '../../api/apiErrors'

/**
 * createAsyncThunk with the app's error convention: any failure (Axios error or a thrown
 * Error) is rejected as a serializable `{ message, status, code, fieldErrors }` payload, so
 * components can write `dispatch(thunk(arg)).unwrap().catch(({ message, fieldErrors }) => …)`.
 */
export function createApiThunk(type, request, options) {
  return createAsyncThunk(
    type,
    async (arg, thunkApi) => {
      try {
        return await request(arg, thunkApi)
      } catch (error) {
        return thunkApi.rejectWithValue(toApiError(error))
      }
    },
    options,
  )
}
