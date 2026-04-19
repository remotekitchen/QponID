import { configureStore } from '@reduxjs/toolkit';

import authReducer from '@/store/authSlice';
import { apiSlice } from '@/store/apiSlice';
import '@/store/grouponApi';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
