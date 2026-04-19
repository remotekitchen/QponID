import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
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
import { HOME_BANNERS, HOME_CATEGORIES, type HomeCategory } from '@/constants/homeMockData';
import {
  type GrouponRestaurantRow,
  useGetRestaurantsWithDealsQuery,
} from '@/store/grouponApi';

const DEAL_TABS = ['Relevance', 'Nearby', 'Deals'] as const;
type DealTab = (typeof DEAL_TABS)[number];

const FILTER_BY_TAB: Record<DealTab, string> = {
  Relevance: 'all',
  Nearby: 'nearby',
  Deals: 'deals',
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
};

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
      });
    }
  }
  return rows.sort((a, b) => b.totalSales - a.totalSales);
}

const { width: SCREEN_W } = Dimensions.get('window');
const BANNER_W = Math.round(SCREEN_W * 0.78);
const BANNER_GAP = 12;
const H_PAD = 16;

const categoryIcon = (icon: HomeCategory['icon']) => {
  const map: Record<HomeCategory['icon'], keyof typeof MaterialCommunityIcons.glyphMap> = {
    cup: 'cup-outline',
    food: 'silverware-fork-knife',
    store: 'storefront-outline',
    gamepad: 'gamepad-variant-outline',
    gift: 'gift-outline',
  };
  return map[icon];
};

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
        placeholder="What sounds good today?"
        placeholderTextColor="#9E9E9E"
        style={styles.searchInput}
        returnKeyType="search"
      />
    </View>
  );
}

function CategoryItem({ item }: { item: HomeCategory }) {
  return (
    <Pressable style={styles.catItem}>
      <View style={styles.catCircle}>
        <MaterialCommunityIcons name={categoryIcon(item.icon)} size={26} color={Brand.black} />
      </View>
      <Text style={styles.catLabel} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
}

function PromoBanner({ variant }: { variant: 'coupon' | 'flash' | 'brands' }) {
  if (variant === 'coupon') {
    return (
      <View style={[styles.bannerCard, styles.bannerYellow]}>
        <View style={styles.bannerTextCol}>
          <Text style={styles.bannerTitle}>Special offer for you</Text>
          <Text style={styles.bannerSub}>Join now</Text>
          <Pressable style={styles.bannerCtaCircle}>
            <MaterialCommunityIcons name="arrow-right" size={22} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.bannerEmoji} accessibilityLabel="Mascot">
          🐯
        </Text>
      </View>
    );
  }
  if (variant === 'flash') {
    return (
      <LinearGradient colors={[Brand.pinkHot, Brand.magenta]} style={[styles.bannerCard, styles.bannerGradient]}>
        <View style={styles.bannerTextCol}>
          <Text style={styles.bannerTitleLight}>Flash sale</Text>
          <Text style={styles.bannerSubLight}>Up to 95% off</Text>
          <View style={styles.timerPill}>
            <MaterialCommunityIcons name="alarm" size={18} color={Brand.black} />
            <Text style={styles.timerText}>02:44:02</Text>
          </View>
        </View>
        <Text style={styles.bannerEmoji}>⏰</Text>
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.bannerCard, styles.bannerOrange]}>
      <View style={styles.bannerTextCol}>
        <Text style={styles.bannerTitle}>Brands</Text>
        <Text style={styles.bannerSub}>Great offers</Text>
        <View style={styles.brandDots}>
          <View style={[styles.brandDot, { backgroundColor: '#E4002B' }]} />
          <View style={[styles.brandDot, { backgroundColor: '#4CAF50' }]} />
          <View style={[styles.brandDot, { backgroundColor: Brand.magenta }]} />
        </View>
      </View>
      <Text style={styles.bannerEmoji}>🏷️</Text>
    </View>
  );
}

/** Deal sort + Categories, Coupon, Ratings, Refresh — one horizontal line (scrollable) */
function HomeFilterStrip({
  dealTab,
  onDealTab,
  onRefresh,
}: {
  dealTab: DealTab;
  onDealTab: (t: DealTab) => void;
  onRefresh: () => void;
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
              name={tab === 'Nearby' ? 'map-marker-radius' : tab === 'Deals' ? 'fire' : 'sort-variant'}
              size={15}
              color={active ? Brand.magenta : Brand.grey}
            />
            <Text style={[styles.stripChipText, active && styles.stripChipTextActive]}>{tab}</Text>
          </Pressable>
        );
      })}
      <View style={styles.stripDivider} />
      <Pressable style={styles.stripChip}>
        <Text style={styles.stripChipText}>Categories</Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color={Brand.black} />
      </Pressable>
      <Pressable style={[styles.stripChip, styles.stripChipCoupon]}>
        <MaterialCommunityIcons name="ticket-percent-outline" size={16} color={Brand.magenta} />
        <Text style={[styles.stripChipText, styles.stripCouponText]}>Coupon</Text>
      </Pressable>
      <Pressable style={styles.stripChip}>
        <MaterialCommunityIcons name="star-outline" size={16} color={Brand.black} />
        <Text style={styles.stripChipText}>Ratings</Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color={Brand.black} />
      </Pressable>
      <Pressable style={styles.stripChip} onPress={onRefresh}>
        <MaterialCommunityIcons name="refresh" size={16} color={Brand.black} />
        <Text style={styles.stripChipText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

function DealCardRow({
  deal,
  onPress,
}: {
  deal: HomeDealCard;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.dealCard} onPress={onPress}>
      <Image source={{ uri: deal.image }} style={styles.dealImg} />
      <View style={styles.dealBody}>
        <Text style={styles.dealTitle} numberOfLines={2}>
          {deal.title}
        </Text>
        <Text style={styles.dealSold}>{deal.sold}</Text>
        <View style={styles.dealPriceRow}>
          <Text style={styles.dealPrice}>{deal.price}</Text>
          {deal.discountTag ? (
            <View style={styles.dealDiscountPill}>
              <Text style={styles.dealDiscountText}>{deal.discountTag}</Text>
            </View>
          ) : null}
          {deal.originalPrice ? (
            <Text style={styles.dealStrike}>{deal.originalPrice}</Text>
          ) : null}
        </View>
        <View style={styles.dealLocDistanceRow}>
          <View style={styles.dealLocRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={15} color={Brand.grey} />
            <Text style={styles.dealLocText} numberOfLines={2}>
              {deal.placeLabel || 'Inside store'}
            </Text>
          </View>
          {deal.distanceKm != null ? (
            <View style={styles.distancePill}>
              <LinearGradient
                colors={['rgba(252,210,0,0.55)', Brand.yellowMuted]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.distancePillGradient}>
                <MaterialCommunityIcons name="navigation-variant" size={14} color={Brand.magenta} />
                <Text style={styles.distancePillText}>{formatDistanceKm(deal.distanceKm)}</Text>
              </LinearGradient>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
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
  const lat = savedLocation?.latitude ?? DEFAULT_MAP_CENTER.latitude;
  const lon = savedLocation?.longitude ?? DEFAULT_MAP_CENTER.longitude;
  const filter = FILTER_BY_TAB[dealTab];

  const {
    data: restaurantsWithDeals = [],
    isLoading: dealsLoading,
    isFetching: dealsFetching,
    error: dealsError,
    refetch: refetchDeals,
  } = useGetRestaurantsWithDealsQuery(
    { lat, lon, filter },
    { skip: !locationReady }
  );

  const dealCards = useMemo(
    () => normalizeDealsFromApi(restaurantsWithDeals),
    [restaurantsWithDeals]
  );

  const openGrouponDeal = (dealId: number) => {
    router.push(`/groupon/${dealId}` as never);
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catList}>
          {HOME_CATEGORIES.map((item) => (
            <CategoryItem key={item.id} item={item} />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bannerList}>
          {HOME_BANNERS.map((item) => (
            <View key={item.id} style={{ width: BANNER_W, marginRight: BANNER_GAP }}>
              <PromoBanner variant={item.variant} />
            </View>
          ))}
        </ScrollView>

        <View style={styles.nearbySection}>
          <Text style={styles.nearbyTitle}>Recommended for you</Text>
          <HomeFilterStrip
            dealTab={dealTab}
            onDealTab={setDealTab}
            onRefresh={() => void refetchDeals()}
          />
          {!locationReady || dealsLoading ? (
            <View style={styles.dealsState}>
              <ActivityIndicator size="small" color={Brand.magenta} />
              <Text style={styles.dealsStateText}>Loading nearby deals…</Text>
            </View>
          ) : dealsError ? (
            <View style={styles.dealsState}>
              <Text style={styles.dealsStateTitle}>Could not load deals</Text>
              <Text style={styles.dealsStateSub}>Check your connection and try again.</Text>
              <Pressable style={styles.dealsRetryBtn} onPress={() => void refetchDeals()}>
                <Text style={styles.dealsRetryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : dealCards.length === 0 ? (
            <View style={styles.dealsState}>
              <Text style={styles.dealsStateText}>No deals found near this location.</Text>
            </View>
          ) : (
            <>
              {dealsFetching && !dealsLoading ? (
                <Text style={styles.refreshHint}>Updating…</Text>
              ) : null}
              {dealCards.map((deal) => (
                <DealCardRow
                  key={deal.key}
                  deal={deal}
                  onPress={() => openGrouponDeal(deal.dealId)}
                />
              ))}
            </>
          )}
        </View>
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
    gap: 4,
  },
  catItem: {
    width: 76,
    alignItems: 'center',
    marginRight: 6,
  },
  catCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  catLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.black,
    textAlign: 'center',
  },
  bannerList: {
    paddingLeft: H_PAD,
    paddingBottom: 20,
  },
  bannerCard: {
    height: 132,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 16,
    fontWeight: '800',
    color: Brand.black,
  },
  bannerSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  bannerTitleLight: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  bannerSubLight: {
    fontSize: 13,
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
    fontSize: 13,
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
    fontSize: 20,
    fontWeight: '800',
    color: Brand.black,
    marginBottom: 12,
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
  stripDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
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
  dealImg: {
    width: 128,
    height: 128,
    borderRadius: 12,
    backgroundColor: '#EEE',
  },
  dealBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-start',
  },
  dealTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6B4423',
    marginBottom: 4,
  },
  dealSold: {
    fontSize: 11,
    color: Brand.grey,
    marginBottom: 8,
  },
  dealPriceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dealPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: Brand.orangePromo,
  },
  dealDiscountPill: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dealDiscountText: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.orangePromo,
  },
  dealStrike: {
    fontSize: 13,
    color: '#BDBDBD',
    textDecorationLine: 'line-through',
  },
  dealLocDistanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  dealLocRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    minWidth: 0,
  },
  dealLocText: {
    fontSize: 12,
    color: Brand.grey,
    flex: 1,
    lineHeight: 17,
    fontWeight: '500',
  },
  distancePill: {
    flexShrink: 0,
    borderRadius: 14,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    maxWidth: 148,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  distancePillGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(216,27,96,0.22)',
  },
  distancePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: Brand.black,
    letterSpacing: -0.3,
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
