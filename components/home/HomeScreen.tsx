import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useLocationPicker } from '@/contexts/LocationContext';
import { Brand } from '@/constants/Colors';
import { DEFAULT_MAP_CENTER } from '@/constants/mapDefaults';
import NearbyDealsSection from '@/components/home/NearbyDealsSection';
import CategoryGridSection, { type HomeGridCategory } from '@/components/home/CategoryGridSection';
import RestaurantDealGroupRow from '@/components/home/RestaurantDealGroupRow';
import { type HomeCategory } from '@/constants/homeMockData';
import { buildGrouponFunnelPayload } from '@/lib/grouponTracking';
import { useTrackGrouponFunnelMutation } from '@/store/grouponFunnelApi';
import {
  type GrouponListRow,
  type GrouponRestaurantRow,
  useGetGrouponCategoriesQuery,
  useGetGrouponListQuery,
  useGetRestaurantsWithDealsQuery,
} from '@/store/grouponApi';

const DEAL_TABS = ['Relevance', 'Nearby'] as const;
type DealTab = (typeof DEAL_TABS)[number];

const FILTER_BY_TAB: Record<DealTab, string> = {
  Relevance: 'all',
  Nearby: 'nearby',
};

type HomeDealCard = {
  key: string;
  title: string;
  sold: string;
  price: string;
  originalPrice?: string;
  discountTag?: string;
  image: string;
  /** Place / address without distance */
  placeLabel: string;
  /** Distance from user in km; `null` if unknown */
  distanceKm: number | null;
  restaurantId: number;
  dealId: number;
  totalSales: number;
  rating: number | null;
  categoryLabel: string;
  /** When `discount_type === 'percentage'`, show this in the list (e.g. 10 → -10%) */
  percentOffApi: number | null;
  /** For grouped card header image */
  logoUrl: string | null;
  reviewCount: number | null;
};

type RatingOption = {
  key: 'all' | '1' | '2' | '3' | '4' | '5';
  label: string;
  value: number | null;
  stars?: string;
};
const RATING_OPTIONS: RatingOption[] = [
  { key: 'all', label: 'All ratings', value: null, stars: '' },
  { key: '1', label: 'and up', value: 1, stars: '★' },
  { key: '2', label: 'and up', value: 2, stars: '★★' },
  { key: '3', label: 'and up', value: 3, stars: '★★★' },
  { key: '4', label: 'and up', value: 4, stars: '★★★★' },
  { key: '5', label: 'only', value: 5, stars: '★★★★★' },
];

/** Pretty distance: meters when under 1 km, otherwise km */
function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const m = Math.max(1, Math.round(km * 1000));
    return `${m.toLocaleString('en-BD')} m away`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} km away`;
  }
  return `${Math.round(km)} km away`;
}

function normalizeDealsFromApi(restaurants: GrouponRestaurantRow[]): HomeDealCard[] {
  const rows: HomeDealCard[] = [];
  for (const restaurant of restaurants) {
    const deals = restaurant.deals ?? [];
    for (const deal of deals) {
      if (deal.is_deleted) continue;
      const discountTag =
        deal.discount_type === 'percentage' && deal.restaurant_discount != null
          ? `${deal.restaurant_discount}% off`
          : deal.discount != null
            ? `৳${deal.discount} off`
            : undefined;
      const totalSales = deal.total_sales ?? 0;
      const rawDist = restaurant.distance_km;
      let distanceKm: number | null = null;
      if (rawDist != null && rawDist !== '') {
        const n = Number(rawDist);
        if (Number.isFinite(n)) distanceKm = n;
      }
      const placeLabel = (restaurant.location || restaurant.address || '').trim();
      rows.push({
        key: `${restaurant.id}-${deal.id}`,
        title: `${restaurant.name} | ${deal.name}`,
        sold: `${totalSales}+ sold`,
        price: `৳${Number(deal.sale_price).toLocaleString('en-BD', {
          maximumFractionDigits: Number(deal.sale_price) % 1 === 0 ? 0 : 2,
        })}`,
        originalPrice:
          deal.original_price != null && deal.original_price !== ''
            ? `৳${Number(deal.original_price).toLocaleString('en-BD', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : undefined,
        discountTag,
        image:
          deal.groupon_image ||
          restaurant.banner_url ||
          restaurant.logo_url ||
          'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=400&q=80',
        placeLabel,
        distanceKm,
        restaurantId: restaurant.id,
        dealId: deal.id,
        totalSales,
        rating:
          Number.isFinite(Number((deal as { rating?: unknown }).rating))
            ? Number((deal as { rating?: unknown }).rating)
            : Number.isFinite(Number((restaurant as { groupon_rating?: unknown }).groupon_rating))
              ? Number((restaurant as { groupon_rating?: unknown }).groupon_rating)
              : Number.isFinite(Number((restaurant as { average_rating?: unknown }).average_rating))
                ? Number((restaurant as { average_rating?: unknown }).average_rating)
                : null,
        categoryLabel:
          Array.isArray((restaurant as { cuisines?: unknown[] }).cuisines) &&
          (restaurant as { cuisines?: unknown[] }).cuisines!.length > 0
            ? String((restaurant as { cuisines?: unknown[] }).cuisines![0] ?? 'Food')
            : 'Food',
        percentOffApi:
          deal.discount_type === 'percentage' && deal.restaurant_discount != null
            ? Math.round(Number(deal.restaurant_discount))
            : null,
        logoUrl:
          typeof (restaurant as { logo_url?: unknown }).logo_url === 'string'
            ? (restaurant as { logo_url: string | null }).logo_url
            : null,
        reviewCount: (() => {
          const r = restaurant as unknown as { reviews_count?: unknown };
          if (r.reviews_count != null && Number.isFinite(Number(r.reviews_count))) {
            return Math.max(0, Math.round(Number(r.reviews_count)));
          }
          return null;
        })(),
      });
    }
  }
  return rows;
}

function normalizeDealsFromGrouponList(rows: GrouponListRow[]): HomeDealCard[] {
  const out: HomeDealCard[] = [];
  rows.forEach((raw, idx) => {
    const dealId = Number(raw.deal_id ?? raw.id);
    const restaurantId = Number(raw.restaurant_id ?? raw.restaurant);
    if (!Number.isFinite(dealId) || !Number.isFinite(restaurantId)) return;
    const title =
      String(raw.title ?? raw.name ?? '').trim() ||
      `${String(raw.restaurant_name ?? 'Restaurant')} | ${String(raw.deal_name ?? 'Deal')}`;
    const salePriceNum = Number(raw.sale_price ?? raw.price ?? 0);
    const originalPriceNum = Number(raw.original_price ?? raw.list_price ?? NaN);
    const totalSales = Number(raw.total_sales ?? raw.sales_count ?? 0) || 0;
    const distanceRaw = raw.distance_km ?? raw.restaurant_distance_km;
    const distanceKm =
      distanceRaw != null && distanceRaw !== '' && Number.isFinite(Number(distanceRaw))
        ? Number(distanceRaw)
        : null;
    const discountTag =
      typeof raw.discount_label === 'string' && raw.discount_label.trim()
        ? raw.discount_label
        : typeof raw.discount === 'string' && raw.discount.trim()
          ? raw.discount
          : undefined;
    out.push({
      key: `filtered-${restaurantId}-${dealId}-${idx}`,
      title,
      sold: `${totalSales}+ sold`,
      price: `৳${salePriceNum.toLocaleString('en-BD', {
        maximumFractionDigits: salePriceNum % 1 === 0 ? 0 : 2,
      })}`,
      originalPrice:
        Number.isFinite(originalPriceNum) && originalPriceNum > 0
          ? `৳${originalPriceNum.toLocaleString('en-BD', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : undefined,
      discountTag,
      image:
        String(raw.groupon_image || raw.image || raw.banner_url || raw.logo_url || '').trim() ||
        'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=400&q=80',
      placeLabel: String(raw.location || raw.address || raw.restaurant_location || '').trim(),
      distanceKm,
      restaurantId,
      dealId,
      totalSales,
      rating:
        raw.rating != null && Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : null,
      categoryLabel:
        typeof raw.cuisine === 'string' && raw.cuisine.trim()
          ? raw.cuisine
          : typeof raw.category === 'string' && raw.category.trim()
            ? raw.category
            : 'Food',
      percentOffApi: null,
      logoUrl: typeof raw.logo_url === 'string' ? raw.logo_url : null,
      reviewCount:
        raw.reviews_count != null && Number.isFinite(Number(raw.reviews_count))
          ? Math.max(0, Math.round(Number(raw.reviews_count)))
          : null,
    });
  });
  return out;
}

function sortDealsByTab(cards: HomeDealCard[], tab: DealTab): HomeDealCard[] {
  const list = [...cards];
  if (tab === 'Nearby') {
    return list.sort((a, b) => {
      const ad = a.distanceKm;
      const bd = b.distanceKm;
      if (ad == null && bd == null) return b.totalSales - a.totalSales;
      if (ad == null) return 1;
      if (bd == null) return -1;
      return ad - bd;
    });
  }
  // "Deals" and "Relevance" both keep sales-weighted relevance from backend/business.
  return list.sort((a, b) => b.totalSales - a.totalSales);
}

const MAX_DEALS_SHOWN_PER_RESTAURANT = 2;

/** Qpon list: max 2 deal lines, but we keep total count for UI ("Showing 2 of 5"). */
function groupDealsByRestaurantQpon(
  cards: HomeDealCard[]
): { key: string; deals: HomeDealCard[]; totalDeals: number }[] {
  const map = new Map<number, HomeDealCard[]>();
  const order: number[] = [];
  const seen = new Set<number>();
  for (const c of cards) {
    if (!seen.has(c.restaurantId)) {
      seen.add(c.restaurantId);
      order.push(c.restaurantId);
    }
    const arr = map.get(c.restaurantId) ?? [];
    arr.push(c);
    map.set(c.restaurantId, arr);
  }
  return order.map((id) => {
    const allSorted = [...(map.get(id) ?? [])].sort((a, b) => b.totalSales - a.totalSales);
    const totalDeals = allSorted.length;
    return {
      key: `grp-${id}`,
      deals: allSorted.slice(0, MAX_DEALS_SHOWN_PER_RESTAURANT),
      totalDeals,
    };
  });
}


const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 16;
const TOP_CARD_GAP = 6;
const TOP_CARD_W = Math.floor((SCREEN_W - H_PAD * 2 - TOP_CARD_GAP * 2) / 3);
const QUICK_CATEGORY_FALLBACKS: HomeCategory[] = [
  { id: '1', label: 'Coffee & Tea', icon: 'cup' },
  { id: '2', label: 'Dessert & Bakery', icon: 'food' },
  { id: '3', label: 'Gourmet Food', icon: 'food' },
  { id: '4', label: 'Leisure', icon: 'gamepad' },
  { id: '5', label: 'Welfare', icon: 'gift' },
  { id: '6', label: 'Invite Friends', icon: 'gift' },
  { id: '7', label: 'Buy More Get More', icon: 'store' },
  { id: '8', label: 'New Store', icon: 'store' },
];

/** Top 3 cards — fixed Qpon-style layout (do not override with live deal titles). */
const QPON_STYLE_TOP_PROMOS = [
  {
    id: 'qpon-1',
    variant: 'coupon' as const,
    title: 'Tofu Singapore',
    subtitle: 'Up to 35% off',
    image:
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'qpon-2',
    variant: 'flash' as const,
    title: 'Flash Sale',
    subtitle: 'Up to 62% off',
  },
  {
    id: 'qpon-3',
    variant: 'brands' as const,
    title: 'Brand pavilion',
    subtitle: 'Surprise big brand deals',
  },
] as const;


function LogoMark() {
  return (
    <View style={styles.logoBlock}>
      <Text style={styles.logoText}>
        hungry <Text style={styles.logoTiger}>tiger</Text>
      </Text>
      <View style={styles.logoSmile} />
    </View>
  );
}

function SearchField() {
  const [q, setQ] = useState('');
  return (
    <View style={styles.searchWrap}>
      <MaterialCommunityIcons name="magnify" size={22} color={Brand.grey} />
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="J Chicken"
        placeholderTextColor="#9E9E9E"
        style={styles.searchInput}
        returnKeyType="search"
      />
      <MaterialCommunityIcons name="line-scan" size={18} color="#9E9E9E" />
    </View>
  );
}

/** Countdown for flash-sale card (visual only). */
function useFlashCountdown(initialSec = 1551) {
  const [sec, setSec] = useState(initialSec);
  useEffect(() => {
    const id = setInterval(() => {
      setSec((s) => (s <= 0 ? initialSec : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [initialSec]);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function QponSandCard({ item }: { item: Extract<(typeof QPON_STYLE_TOP_PROMOS)[number], { variant: 'coupon' }> }) {
  return (
    <View style={[styles.qponCard, styles.qponCardSand]}>
      <View style={styles.qponCardHeader}>
        <Text style={styles.qponCardTitleDark} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.qponCardSubDark} numberOfLines={2}>
          {item.subtitle}
        </Text>
      </View>
      <View style={styles.qponCardImageWrap}>
        <Image source={{ uri: item.image }} style={styles.qponCardImage} resizeMode="cover" />
        <Pressable style={styles.qponCardFab} accessibilityRole="button">
          <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

function QponFlashCard({ item }: { item: Extract<(typeof QPON_STYLE_TOP_PROMOS)[number], { variant: 'flash' }> }) {
  const flashClock = useFlashCountdown(1551);
  return (
    <LinearGradient
      colors={['#FF7A9A', '#E91E63', '#C2185B']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.qponCard, styles.qponCardFlash]}>
      <View style={styles.qponFlashTimerBar}>
        <Text style={styles.qponFlashTimerText}>{flashClock}</Text>
      </View>
      <Text style={styles.qponCardTitleLight} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.qponCardSubLight} numberOfLines={2}>
        {item.subtitle}
      </Text>
      <View style={styles.qponFlashArtRow}>
        <MaterialCommunityIcons name="alarm-light" size={44} color="#FFEB3B" />
      </View>
    </LinearGradient>
  );
}

function QponBrandsCard({ item }: { item: Extract<(typeof QPON_STYLE_TOP_PROMOS)[number], { variant: 'brands' }> }) {
  return (
    <View style={[styles.qponCard, styles.qponCardOrange]}>
      <Text style={styles.qponCardTitleOnOrange} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.qponCardSubOnOrange} numberOfLines={2}>
        {item.subtitle}
      </Text>
      <View style={styles.qponBrandRow}>
        <View style={[styles.qponBrandChip, { backgroundColor: '#E4002B' }]}>
          <Text style={styles.qponBrandChipText}>KFC</Text>
        </View>
        <View style={[styles.qponBrandChip, { backgroundColor: '#F57C00' }]}>
          <Text style={styles.qponBrandChipText}>BK</Text>
        </View>
        <View style={[styles.qponBrandChip, { backgroundColor: '#43A047' }]}>
          <Text style={styles.qponBrandChipText}>+</Text>
        </View>
      </View>
    </View>
  );
}

function QponTopPromoCard({ item }: { item: (typeof QPON_STYLE_TOP_PROMOS)[number] }) {
  if (item.variant === 'coupon') return <QponSandCard item={item} />;
  if (item.variant === 'flash') return <QponFlashCard item={item} />;
  return <QponBrandsCard item={item} />;
}

/** Deal sort + Categories, Coupon, Ratings, Refresh — one horizontal line (scrollable) */
function HomeFilterStrip({
  dealTab,
  onDealTab,
  selectedRatingLabel,
  onRatingPress,
}: {
  dealTab: DealTab;
  onDealTab: (t: DealTab) => void;
  selectedRatingLabel: string;
  onRatingPress: () => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterScrollContent}>
      {DEAL_TABS.map((tab) => {
        const active = dealTab === tab;
        return (
          <Pressable
            key={tab}
            onPress={() => onDealTab(tab)}
            style={[styles.stripChip, active ? styles.stripChipDealActive : styles.stripChipDeal]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}>
            <MaterialCommunityIcons
              name={tab === 'Nearby' ? 'map-marker-radius' : 'sort-variant'}
              size={15}
              color={active ? Brand.magenta : Brand.grey}
            />
            <Text style={[styles.stripChipText, active && styles.stripChipTextActive]}>{tab}</Text>
          </Pressable>
        );
      })}
      <Pressable style={styles.stripChip} onPress={onRatingPress}>
        <MaterialCommunityIcons name="star-outline" size={16} color={Brand.black} />
        <Text style={styles.stripChipText}>{selectedRatingLabel}</Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color={Brand.black} />
      </Pressable>
    </ScrollView>
  );
}

export default function HomeScreen() {
  const { user, openLogin } = useAuth();
  const { savedLocation, openLocationPicker, locationReady } = useLocationPicker();
  const router = useRouter();
  const tabBarH = useBottomTabBarHeight();
  const loginBarOffset = tabBarH + 10;
  const scrollBottomPad = tabBarH + (user ? 24 : 88);

  const [dealTab, setDealTab] = useState<DealTab>('Relevance');
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [selectedRatingKey, setSelectedRatingKey] = useState<RatingOption['key']>('all');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>('all');
  const [trackGrouponFunnel] = useTrackGrouponFunnelMutation();
  const lat = savedLocation?.latitude ?? DEFAULT_MAP_CENTER.latitude;
  const lon = savedLocation?.longitude ?? DEFAULT_MAP_CENTER.longitude;
  const { data: grouponCategories = [] } = useGetGrouponCategoriesQuery();
  const selectedRating = RATING_OPTIONS.find((r) => r.key === selectedRatingKey) || RATING_OPTIONS[0];
  const selectedRatingLabel = selectedRating.label;
  const hasExtraFilters = selectedRating.value !== null;
  const filter = FILTER_BY_TAB[dealTab];

  const {
    data: restaurantsWithDeals = [],
    isLoading: baseDealsLoading,
    isFetching: baseDealsFetching,
    error: baseDealsError,
    refetch: refetchDeals,
  } = useGetRestaurantsWithDealsQuery(
    {
      lat,
      lon,
      filter: selectedRating.value !== null ? 'rating' : filter,
      category: selectedCategoryKey !== 'all' ? selectedCategoryKey : undefined,
    },
    { skip: !locationReady || hasExtraFilters }
  );

  const {
    data: grouponListDeals = [],
    isLoading: listLoading,
    isFetching: listFetching,
    error: listError,
    refetch: refetchGrouponList,
  } = useGetGrouponListQuery(
    {
      category: selectedCategoryKey !== 'all' ? selectedCategoryKey : undefined,
      rating: selectedRating.value,
    },
    { skip: !hasExtraFilters }
  );

  const dealCards = useMemo(() => {
    const base = hasExtraFilters
      ? normalizeDealsFromGrouponList(grouponListDeals)
      : normalizeDealsFromApi(restaurantsWithDeals);
    return sortDealsByTab(base, dealTab);
  }, [hasExtraFilters, grouponListDeals, restaurantsWithDeals, dealTab]);
  const dealsLoading = hasExtraFilters ? listLoading : baseDealsLoading;
  const dealsFetching = hasExtraFilters ? listFetching : baseDealsFetching;
  const dealsError = hasExtraFilters ? listError : baseDealsError;
  const quickCategories = useMemo<HomeGridCategory[]>(() => {
    if (grouponCategories.length > 0) {
      const sorted = [...grouponCategories].sort(
        (a, b) => Number(a.sort_order ?? 999) - Number(b.sort_order ?? 999)
      );
      return sorted.slice(0, 8).map((cat, idx) => ({
        id: String(cat.key),
        label: cat.label,
        image: cat.image ?? null,
        icon: QUICK_CATEGORY_FALLBACKS[idx % QUICK_CATEGORY_FALLBACKS.length].icon,
      }));
    }
    return QUICK_CATEGORY_FALLBACKS;
  }, [grouponCategories]);
  const groupedDealRows = useMemo(() => groupDealsByRestaurantQpon(dealCards), [dealCards]);

  const openGrouponDeal = (deal: HomeDealCard) => {
    void buildGrouponFunnelPayload({
      step: 'front_page',
      restaurantId: deal.restaurantId,
      dealId: deal.dealId,
      meta: {
        source: 'home_recommended_card',
        deal_name: deal.title,
      },
    })
      .then((payload) => trackGrouponFunnel(payload).unwrap())
      .catch(() => {
        // Tracking failures should not block navigation.
      });
    router.push(`/groupon/${deal.dealId}` as never);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.yellowHeader}>
        <View style={styles.headerTop}>
          <LogoMark />
          <Pressable
            style={styles.locationRow}
            onPress={openLocationPicker}
            hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Choose location on map">
            <MaterialCommunityIcons name="map-marker-outline" size={18} color={Brand.black} />
            <Text style={styles.locationText} numberOfLines={1}>
              {!locationReady
                ? 'Loading…'
                : savedLocation
                  ? savedLocation.label
                  : 'Tap for map & location'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color={Brand.black} />
          </Pressable>
        </View>
        <SearchField />
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator={false}>
        <CategoryGridSection
          categories={quickCategories}
          selectedCategoryKey={selectedCategoryKey}
          onSelectCategory={(key) => {
            setSelectedCategoryKey((prev) => (prev === key ? 'all' : key));
          }}
        />

        <View style={styles.bannerList}>
          {QPON_STYLE_TOP_PROMOS.map((item) => (
            <View key={item.id} style={styles.bannerItem}>
              <QponTopPromoCard item={item} />
            </View>
          ))}
        </View>

        <NearbyDealsSection
          dealTab={dealTab}
          dealTabs={DEAL_TABS}
          onDealTab={setDealTab}
          selectedRatingLabel={selectedRatingLabel}
          onRatingPress={() => setIsRatingOpen((v) => !v)}
          isRatingOpen={isRatingOpen}
          ratingOptions={RATING_OPTIONS.map((r) => ({ key: r.key, label: r.label }))}
          selectedRatingKey={selectedRatingKey}
          onSelectRating={(key) => {
            setSelectedRatingKey(key as RatingOption['key']);
            setIsRatingOpen(false);
          }}
          locationReady={locationReady}
          dealsLoading={dealsLoading}
          dealsFetching={dealsFetching}
          dealsError={Boolean(dealsError)}
          groupedDealRows={groupedDealRows}
          onRetry={() => void refetchDeals()}
          renderRow={(g) => (
            <RestaurantDealGroupRow
              key={g.key}
              deals={g.deals}
              totalDeals={g.totalDeals}
              onOpenDeal={openGrouponDeal}
            />
          )}
        />
      </ScrollView>

      {!user ? (
        <View style={[styles.loginBar, { bottom: loginBarOffset }]}>
          <Text style={styles.loginGift}>🎁</Text>
          <Text style={styles.loginText} numberOfLines={1}>
            Log in to Hungry Tiger to unlock promos
          </Text>
          <Pressable style={styles.loginBtn} onPress={openLogin}>
            <Text style={styles.loginBtnText}>Login</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.greyLight,
  },
  yellowHeader: {
    backgroundColor: Brand.yellow,
    paddingHorizontal: H_PAD,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  logoBlock: {
    flexShrink: 1,
    maxWidth: SCREEN_W * 0.44,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.black,
    textTransform: 'lowercase',
    letterSpacing: -0.5,
  },
  logoTiger: {
    color: Brand.redSmile,
  },
  logoSmile: {
    marginTop: 2,
    width: 56,
    height: 3,
    backgroundColor: Brand.redSmile,
    borderRadius: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    minWidth: 120,
    maxWidth: SCREEN_W * 0.52,
    gap: 4,
    paddingVertical: 6,
    zIndex: 2,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Brand.black,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.white,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Brand.black,
    paddingVertical: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
  },
  catList: {
    paddingHorizontal: H_PAD,
    paddingBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  catItem: {
    width: '25%',
    alignItems: 'center',
  },
  catItemActive: {
    opacity: 0.96,
  },
  catCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F7F1F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  catImage: {
    width: '100%',
    height: '100%',
  },
  catLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.black,
    textAlign: 'center',
  },
  bannerList: {
    paddingHorizontal: H_PAD,
    paddingBottom: 14,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  bannerItem: {
    width: TOP_CARD_W,
  },
  qponCard: {
    width: '100%',
    minHeight: 168,
    borderRadius: 12,
    overflow: 'hidden',
  },
  qponCardSand: {
    backgroundColor: '#E8E0D4',
  },
  qponCardHeader: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  qponCardTitleDark: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  qponCardSubDark: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: '#4A4A4A',
  },
  qponCardImageWrap: {
    flex: 1,
    minHeight: 88,
    marginHorizontal: 6,
    marginBottom: 6,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  qponCardImage: {
    width: '100%',
    height: '100%',
    minHeight: 88,
  },
  qponCardFab: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qponCardFlash: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  qponFlashTimerBar: {
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: '#FFEB3B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  qponFlashTimerText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  qponCardTitleLight: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  qponCardSubLight: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
  },
  qponFlashArtRow: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qponCardOrange: {
    backgroundColor: '#FF7A1A',
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
  },
  qponCardTitleOnOrange: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  qponCardSubOnOrange: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },
  qponBrandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  qponBrandChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  qponBrandChipText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  bannerCard: {
    height: 108,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 9,
    overflow: 'hidden',
  },
  bannerYellow: {
    backgroundColor: '#FFE566',
  },
  bannerGradient: {},
  bannerOrange: {
    backgroundColor: Brand.orangePromo,
  },
  bannerTextCol: {
    flex: 1,
    gap: 4,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Brand.black,
  },
  bannerSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  bannerMeta: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#5B5B5B',
  },
  bannerTitleLight: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  bannerSubLight: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },
  bannerCtaCircle: {
    marginTop: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerPill: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  timerText: {
    fontWeight: '800',
    fontSize: 12,
    color: Brand.black,
  },
  bannerEmoji: {
    fontSize: 44,
    marginLeft: 8,
  },
  brandDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  brandDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  nearbySection: {
    paddingHorizontal: H_PAD,
    paddingBottom: 8,
  },
  nearbyTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Brand.black,
    marginBottom: 10,
  },
  filterScroll: {
    marginHorizontal: -H_PAD,
    marginBottom: 14,
  },
  filterScrollContent: {
    paddingHorizontal: H_PAD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 2,
  },
  stripChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  stripChipDeal: {
    borderColor: 'rgba(252,210,0,0.85)',
    backgroundColor: 'rgba(252,210,0,0.22)',
  },
  stripChipDealActive: {
    borderColor: Brand.magenta,
    backgroundColor: '#FFF5F8',
    shadowColor: Brand.magenta,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  stripChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.black,
  },
  stripChipTextActive: {
    color: Brand.magenta,
  },
  stripCouponText: {
    color: Brand.magenta,
  },
  stripChipCoupon: {
    borderColor: 'rgba(216,27,96,0.35)',
    backgroundColor: '#FFF5F8',
  },
  categoryDropdown: {
    marginTop: -6,
    marginBottom: 12,
    backgroundColor: Brand.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
  },
  categoryOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F1F1',
  },
  categoryOptionRowActive: {
    backgroundColor: '#FFF5F8',
  },
  categoryOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.black,
  },
  categoryOptionTextActive: {
    color: Brand.magenta,
  },
  ratingOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingStarsText: {
    minWidth: 56,
    fontSize: 12,
    fontWeight: '800',
    color: '#F6C035',
  },
  dealsState: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  dealsStateText: {
    fontSize: 13,
    color: Brand.grey,
    fontWeight: '600',
  },
  dealsStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Brand.black,
  },
  dealsStateSub: {
    fontSize: 13,
    color: Brand.grey,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  dealsRetryBtn: {
    marginTop: 4,
    backgroundColor: Brand.yellow,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  dealsRetryBtnText: {
    fontWeight: '800',
    fontSize: 13,
    color: Brand.black,
  },
  refreshHint: {
    fontSize: 11,
    color: Brand.grey,
    marginBottom: 8,
    fontWeight: '600',
  },
  dealCard: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 0,
    marginBottom: 0,
    gap: 8,
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E9E9E9',
  },
  dealImg: {
    width: 126,
    height: 126,
    borderRadius: 10,
    backgroundColor: '#EEE',
  },
  dealBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-start',
    minHeight: 126,
    paddingBottom: 2,
  },
  dealTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#191919',
    marginBottom: 1,
  },
  dealMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  dealMetaText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  dealMetaDot: {
    fontSize: 11,
    color: '#A0A0A0',
  },
  dealTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  dealTagPink: {
    fontSize: 11,
    color: Brand.magenta,
    fontWeight: '700',
  },
  dealTagMuted: {
    fontSize: 11,
    color: '#484848',
    fontWeight: '600',
  },
  dealTagSep: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  dealAddressText: {
    fontSize: 10,
    color: '#777',
    marginTop: 2,
    marginBottom: 2,
  },
  dealTotalHint: {
    fontSize: 11,
    color: Brand.grey,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 2,
  },
  dealLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 4,
    marginBottom: 1,
  },
  dealPriceLine: {
    fontSize: 11,
    color: Brand.magenta,
    fontWeight: '800',
  },
  dealOriginalPriceLine: {
    fontSize: 12,
    color: '#8A8A8A',
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  dealLineName: {
    flex: 1,
    fontSize: 11,
    color: '#343434',
    fontWeight: '600',
  },
  dealPriceRow: { display: 'none' },
  priceCol: {
    justifyContent: 'center',
    gap: 1,
  },
  priceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dealPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#C62828',
  },
  dealDiscountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C62828',
  },
  dealStrike: {
    fontSize: 13,
    lineHeight: 14,
    color: '#BDBDBD',
    fontWeight: '600',
    textDecorationLine: 'line-through',
    textDecorationColor: '#BDBDBD',
    textDecorationStyle: 'solid',
    marginBottom: 1,
  },
  dealLocDistanceRow: { display: 'none' },
  dealLocRow: {
    flex: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  dealLocText: {
    fontSize: 10,
    color: '#8A8A8A',
    fontWeight: '600',
  },
  distanceTextRow: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  distanceTextPlain: {
    fontSize: 12,
    fontWeight: '900',
    color: Brand.magenta,
    letterSpacing: 0,
  },
  promoCard: {
    flexDirection: 'row',
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  promoImg: {
    width: 92,
    height: 92,
    borderRadius: 12,
  },
  promoBody: {
    flex: 1,
    minWidth: 0,
  },
  promoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Brand.black,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    color: Brand.grey,
  },
  metaDot: {
    fontSize: 12,
    color: Brand.grey,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FCE4EC',
  },
  tagPink: {
    backgroundColor: '#FCE4EC',
  },
  tagOrange: {
    backgroundColor: '#FFF3E0',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333',
  },
  addressText: {
    color: Brand.grey,
    fontSize: 12,
    lineHeight: 17,
  },
  stateCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  stateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Brand.black,
  },
  stateSub: {
    fontSize: 13,
    color: Brand.grey,
    lineHeight: 18,
  },
  stateBtn: {
    backgroundColor: Brand.yellow,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stateBtnText: {
    fontWeight: '700',
    color: Brand.black,
  },
  loginBar: {
    position: 'absolute',
    left: H_PAD,
    right: H_PAD,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.loginBarBg,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  loginGift: {
    fontSize: 22,
  },
  loginText: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loginBtn: {
    backgroundColor: Brand.yellow,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  loginBtnText: {
    fontWeight: '800',
    fontSize: 13,
    color: Brand.black,
  },
});
