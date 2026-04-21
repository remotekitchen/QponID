import { apiSlice } from '@/store/apiSlice';

export type GrouponFunnelStep =
  | 'scan'
  | 'front_page'
  | 'store_visit'
  | 'add_to_cart'
  | 'place_order';

export type GrouponFunnelPayload = {
  step: GrouponFunnelStep;
  device_id: string;
  session_id?: string;
  restaurant_id?: number;
  deal_id?: number;
  voucher_code?: string;
  order_id?: number;
  meta?: Record<string, unknown>;
};

export const grouponFunnelApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    trackGrouponFunnel: builder.mutation<{ result: string }, GrouponFunnelPayload>({
      query: (body) => ({
        url: 'api/groupon/v1/funnel/track',
        method: 'POST',
        body,
      }),
    }),
  }),
  overrideExisting: true,
});

export const { useTrackGrouponFunnelMutation } = grouponFunnelApi;
