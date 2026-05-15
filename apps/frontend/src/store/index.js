import { configureStore } from '@reduxjs/toolkit'
import dataReducer from './slice/DashboardSlice'

// import other reducers as needed

export const store = configureStore({
  reducer: {
    data: dataReducer,

  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: false
    })
})
