import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000'

/* =======================
   FETCH PRODUCTS
======================= */
export const fetchProducts = createAsyncThunk(
  'data/fetchProducts',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/products`)
      return res.data.data
    } catch (err) {
      return rejectWithValue('Failed to fetch products')
    }
  }
)

/* =======================
   FETCH INVOICES
======================= */
export const fetchInvoices = createAsyncThunk(
  'data/fetchInvoices',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_BASE_URL}/api/invoices`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      return res.data.data || []
    } catch (err) {
      return rejectWithValue('Failed to fetch invoices')
    }
  }
)

/* =======================
   SLICE
======================= */
const initialState = {
  products: [],
  invoices: [],
  loading: false,
  error: null
}

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      /* PRODUCTS */
      .addCase(fetchProducts.pending, state => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false
        state.products = action.payload
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      /* INVOICES */
      .addCase(fetchInvoices.pending, state => {
        state.loading = true
      })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.loading = false
        state.invoices = action.payload
      })
      .addCase(fetchInvoices.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

export default dataSlice.reducer
