import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

type AuthSliceState = {
  auth: {
    backendSession: { token: string; userInfo: unknown } | null;
  };
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: 'https://api.hungrytiger.chatchefs.com/',
    prepareHeaders: (headers, { getState }) => {
      headers.set('Content-Type', 'application/json');
      const token = (getState() as AuthSliceState).auth.backendSession?.token;
      if (token) {
        headers.set('Authorization', `token ${token}`);
      }
      return headers;
    },
  }),
  endpoints: () => ({}),
});
