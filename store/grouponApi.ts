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

export type GrouponCategory = {
  id?: number;
  key: string;
  label: string;
  image?: string | null;
  is_active?: boolean;
  sort_order?: number;
  active_deal_count: number;
};

export type GrouponListRow = Record<string, unknown>;

export type GrouponDealRow = {
  id: number;
  restaurant?: number;
  name: string;
  sale_price: number | string;
  original_price?: number | string | null;
  groupon_image?: string | null;
  discount_type?: string;
  restaurant_discount?: number | string;
  discount?: number | string;
  ht_discount?: number;
  total_sales?: number;
  is_available?: boolean;
  is_deleted?: boolean;
  total_available?: number;
  description?: string;
  highlights?: string[];
  valid_from?: string;
  valid_to?: string;
  person?: number | null;
  /** Max vouchers per checkout; 0 often means no limit server-side */
  max_qty_per_purchase?: number;
};

/** Single deal detail — `GET api/groupon/v1/deals/:id` */
export type GrouponDealCategoryItem = {
  name: string;
  price: number;
  itemId: number | null;
  qty: number;
  image: string | null | undefined;
};

export type GrouponDealCategory = {
  category_name: string;
  items: GrouponDealCategoryItem[];
};

export type GrouponLocation = {
  id: number;
  name: string;
  details: string;
  address: string;
  phone: string;
  email: string;
  latitude: number;
  longitude: number;
  distance_km: number | null;
  opening_hours: unknown[];
};

export type GrouponDealDetail = {
  id?: number;
  restaurant: number;
  groupon_image: string | null;
  name: string;
  person: number | null;
  original_price: string;
  restaurant_discount: number;
  discount_type?: string;
  ht_discount: number;
  sale_price: number;
  sslcommerz_sale_price?: number;
  description: string;
  highlights: string[];
  badge: string;
  rules?: string;
  valid_from: string;
  valid_to: string;
  categories: GrouponDealCategory[];
  reviews: unknown[];
  restaurant_name: string;
  restaurant_location: string;
  discount: string;
  restaurant_image: string | null;
  reviews_count: number;
  distance_km: number | null;
  locations: GrouponLocation[];
  total_sales?: number;
  total_available?: number;
  /** From detail API — caps checkout quantity selector */
  max_qty_per_purchase?: number;
};

/** Sibling deals in same store */
export type GrouponDealSummary = {
  id: number;
  restaurant: number;
  groupon_image: string | null;
  name: string;
  person: number | null;
  original_price: string;
  restaurant_discount: number;
  discount_type?: string;
  discount: string;
  sale_price: number;
  description?: string;
  highlights: string[];
  total_sales?: number;
  valid_from?: string;
  valid_to?: string;
};

export type GrouponDetailResponse = {
  deal: GrouponDealDetail;
  more_in_store: GrouponDealSummary[];
};

export type GrouponDealReview = {
  id?: number;
  rating?: number;
  comment?: string;
  user_name?: string;
  user?: { name?: string } | null;
  created_at?: string;
  [key: string]: unknown;
};

/**
 * When `GET .../deals/:id` returns 401 (anonymous), build a detail-shaped object
 * from the public list endpoint (same rows as home).
 */
export function buildGrouponDetailFromListCache(
  dealIdNum: number,
  restaurants: GrouponRestaurantRow[] | undefined
): GrouponDetailResponse | null {
  if (!Array.isArray(restaurants) || !Number.isFinite(dealIdNum)) return null;

  for (const r of restaurants) {
    const deals = r.deals ?? [];
    const d = deals.find((x) => x.id === dealIdNum);
    if (!d || d.is_deleted) continue;

    const siblings = deals.filter((x) => x.id !== dealIdNum && !x.is_deleted);

    const dealDetail: GrouponDealDetail = {
      id: d.id,
      restaurant: d.restaurant ?? r.id,
      groupon_image: d.groupon_image ?? null,
      name: d.name,
      person: d.person ?? null,
      original_price: String(d.original_price ?? ''),
      restaurant_discount: Number(d.restaurant_discount ?? 0),
      discount_type: d.discount_type,
      ht_discount: Number(d.ht_discount ?? 0),
      sale_price: Number(d.sale_price),
      description: d.description ?? '',
      highlights: d.highlights ?? [],
      badge: '',
      valid_from: d.valid_from ?? '',
      valid_to: d.valid_to ?? '',
      categories: [],
      reviews: [],
      restaurant_name: r.name,
      restaurant_location: (r.location || r.address || '').trim(),
      discount: String(d.discount ?? ''),
      restaurant_image: r.logo_url ?? null,
      reviews_count: 0,
      distance_km:
        r.distance_km != null && r.distance_km !== '' ? Number(r.distance_km) : null,
      locations: [],
      total_sales: d.total_sales,
      total_available: d.total_available,
      max_qty_per_purchase:
        typeof d.max_qty_per_purchase === 'number' ? d.max_qty_per_purchase : undefined,
    };

    const more: GrouponDealSummary[] = siblings.map((s) => ({
      id: s.id,
      restaurant: s.restaurant ?? r.id,
      groupon_image: s.groupon_image ?? null,
      name: s.name,
      person: s.person ?? null,
      original_price: String(s.original_price ?? ''),
      restaurant_discount: Number(s.restaurant_discount ?? 0),
      discount_type: s.discount_type,
      discount: String(s.discount ?? ''),
      sale_price: Number(s.sale_price),
      description: s.description,
      highlights: s.highlights ?? [],
      total_sales: s.total_sales,
      valid_from: s.valid_from,
      valid_to: s.valid_to,
    }));

    return { deal: dealDetail, more_in_store: more };
  }

  return null;
}

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

function normalizeCategoriesPayload(response: unknown): GrouponCategory[] {
  if (
    response &&
    typeof response === 'object' &&
    'categories' in response &&
    Array.isArray((response as { categories: unknown }).categories)
  ) {
    return (response as { categories: GrouponCategory[] }).categories;
  }
  return [];
}

function normalizeDealReviewsPayload(response: unknown): GrouponDealReview[] {
  if (Array.isArray(response)) return response as GrouponDealReview[];
  if (
    response &&
    typeof response === 'object' &&
    'results' in response &&
    Array.isArray((response as { results: unknown }).results)
  ) {
    return (response as { results: GrouponDealReview[] }).results;
  }
  return [];
}

function normalizeGrouponListPayload(response: unknown): GrouponListRow[] {
  if (Array.isArray(response)) return response as GrouponListRow[];
  if (
    response &&
    typeof response === 'object' &&
    'results' in response &&
    Array.isArray((response as { results: unknown }).results)
  ) {
    return (response as { results: GrouponListRow[] }).results;
  }
  return [];
}

export const grouponApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRestaurantsWithDeals: builder.query<
      GrouponRestaurantRow[],
      { lat: number; lon: number; filter: string; category?: string }
    >({
      query: ({ lat, lon, filter, category }) => {
        const params = new URLSearchParams({
          lat: String(lat),
          lon: String(lon),
          filter,
        });
        if (category && category !== 'all') params.set('category', category);
        return {
          url: `api/groupon/v1/deals/restaurants-with-deals/?${params.toString()}`,
          method: 'GET',
        };
      },
      transformResponse: normalizeRestaurantsPayload,
    }),
    getGrouponCategories: builder.query<GrouponCategory[], void>({
      query: () => ({
        url: 'api/groupon/v1/categories/deals',
        method: 'GET',
      }),
      transformResponse: normalizeCategoriesPayload,
    }),
    getGrouponList: builder.query<
      GrouponListRow[],
      { category?: string; rating?: number | null }
    >({
      query: ({ category, rating }) => {
        const params = new URLSearchParams();
        if (category && category !== 'all') params.set('category', category);
        if (typeof rating === 'number') params.set('rating', String(rating));
        const qs = params.toString();
        return {
          url: `api/groupon/v1/grouponList${qs ? `?${qs}` : ''}`,
          method: 'GET',
        };
      },
      transformResponse: normalizeGrouponListPayload,
    }),
    getGrouponDetails: builder.query<GrouponDetailResponse, { dealId: string }>({
      query: ({ dealId }) => ({
        url: `api/groupon/v1/deals/${dealId}`,
        method: 'GET',
      }),
    }),
    /** Same contract as Hungry Tiger / Remote Kitchen checkout */
    purchaseGroupon: builder.mutation<
      {
        payment_method?: string;
        gateway_url?: string;
        transaction_id?: string;
        session_key?: string;
        [key: string]: unknown;
      },
      { dealId: string; qty: number; payment_method: string }
    >({
      query: ({ dealId, qty, payment_method }) => ({
        url: `api/groupon/v1/deals/${dealId}/buy`,
        method: 'POST',
        body: { qty, payment_method },
      }),
    }),
    checkGrouponPaymentStatus: builder.query<
      unknown,
      { dealId: string; transactionId: string }
    >({
      query: ({ dealId, transactionId }) => ({
        url: `api/groupon/v1/deals/${dealId}/payment-status/?transaction_id=${encodeURIComponent(transactionId)}`,
        method: 'GET',
      }),
    }),
    getGrouponDealReviews: builder.query<GrouponDealReview[], { dealId: number }>({
      query: ({ dealId }) => ({
        url: `api/groupon/v1/reviews/deal?deal_id=${dealId}`,
        method: 'GET',
      }),
      transformResponse: normalizeDealReviewsPayload,
    }),
    submitGrouponStoreReview: builder.mutation<
      unknown,
      { order_id: string | number; rating: number; comment?: string }
    >({
      query: (body) => ({
        url: 'api/groupon/v1/reviews/store',
        method: 'POST',
        body,
      }),
    }),
  }),
  // Dev (Fast Refresh) re-runs this file; allow re-injecting the same endpoint name
  overrideExisting: true,
});

export const {
  useGetRestaurantsWithDealsQuery,
  useGetGrouponCategoriesQuery,
  useGetGrouponListQuery,
  useGetGrouponDetailsQuery,
  usePurchaseGrouponMutation,
  useLazyCheckGrouponPaymentStatusQuery,
  useGetGrouponDealReviewsQuery,
  useSubmitGrouponStoreReviewMutation,
} = grouponApi;
