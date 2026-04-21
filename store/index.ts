import { configureStore } from '@reduxjs/toolkit';

import authReducer from '@/store/authSlice';
import { apiSlice } from '@/store/apiSlice';
import '@/store/grouponFunnelApi';
import grouponPurchaseReducer from '@/store/grouponPurchaseSlice';
import '@/store/grouponApi';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    grouponPurchase: grouponPurchaseReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
