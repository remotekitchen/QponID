import { apiSlice } from '@/store/apiSlice';

/** Raw restaurant row from `restaurants-with-deals` */
export type GrouponRestaurantRow = {
  id: number;
  name: string;
  deals?: GrouponDealRow[];
  location?: string;
  address?: string;
  distance_km?: number | string;
  banner_url?: string | null;
  logo_url?: string | null;
};

export type GrouponDealRow = {
  id: number;
  name: string;
  sale_price: number | string;
  original_price?: number | string | null;
  groupon_image?: string | null;
  discount_type?: string;
  restaurant_discount?: number | string;
  discount?: number | string;
  total_sales?: number;
  is_available?: boolean;
  is_deleted?: boolean;
};

function normalizeRestaurantsPayload(response: unknown): GrouponRestaurantRow[] {
  if (Array.isArray(response)) return response as GrouponRestaurantRow[];
  if (
    response &&
    typeof response === 'object' &&
    'results' in response &&
    Array.isArray((response as { results: unknown }).results)
  ) {
    return (response as { results: GrouponRestaurantRow[] }).results;
  }
  return [];
}

export const grouponApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRestaurantsWithDeals: builder.query<
      GrouponRestaurantRow[],
      { lat: number; lon: number; filter: string }
    >({
      query: ({ lat, lon, filter }) => ({
        url: `api/groupon/v1/deals/restaurants-with-deals/?lat=${lat}&lon=${lon}&filter=${encodeURIComponent(filter)}`,
        method: 'GET',
      }),
      transformResponse: normalizeRestaurantsPayload,
    }),
  }),
  overrideExisting: false,
});

export const { useGetRestaurantsWithDealsQuery } = grouponApi;
