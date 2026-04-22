import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/Colors';
import { DEFAULT_MAP_CENTER } from '@/constants/mapDefaults';
import { useLocationPicker } from '@/contexts/LocationContext';
import { buildGrouponFunnelPayload } from '@/lib/grouponTracking';
import { useTrackGrouponFunnelMutation } from '@/store/grouponFunnelApi';
import {
  buildGrouponDetailFromListCache,
  type GrouponDealCategoryItem,
  type GrouponDealReview,
  type GrouponDealDetail,
  type GrouponDealSummary,
  useGetGrouponDealReviewsQuery,
  useGetGrouponDetailsQuery,
  useGetRestaurantsWithDealsQuery,
} from '@/store/grouponApi';

const SCREEN_W = Dimensions.get('window').width;
const H_PAD = 16;

function formatTk(value: number) {
  const n = Number(value);
  if (Number.isNaN(n)) return '৳0';
  const hasFraction = Math.abs(n % 1) > 0.001;
  return `৳${n.toLocaleString('en-BD', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function discountPercent(original: string, sale: number): number | null {
  const o = Number(original);
  if (!Number.isFinite(o) || o <= 0) return null;
  const s = Number(sale);
  if (!Number.isFinite(s)) return null;
  return Math.round((1 - s / o) * 100);
}

function soldLabel(total?: number) {
  const t = total ?? 0;
  if (t >= 1000) return `Sold ${(t / 1000).toFixed(t % 1000 === 0 ? 0 : 1)}K+`;
  if (t > 0) return `Sold ${t}+`;
  return 'New';
}

/** Deal price, savings, breakdown (below restaurant block) */
function DealPricingSection({ deal }: { deal: GrouponDealDetail }) {
  const discountAmount = Number(deal.discount);
  const originalNum = Number(deal.original_price);
  const htNum = Number(deal.ht_discount ?? 0);
  const saveLine =
    Number.isFinite(discountAmount) && discountAmount > 0
      ? `Save instantly ${formatTk(discountAmount)}`
      : 'Save on this deal';

  const avail = deal.total_available;
  const limitedLabel =
    avail != null && Number.isFinite(avail)
      ? `Limited · ${Math.round(avail).toLocaleString('en-BD')} sets avail.`
      : 'Limited-time offer';

  return (
    <View>
      <View style={priceStyles.topRow}>
        <Text style={priceStyles.flashLabel}>Flash Deal</Text>
        <LinearGradient
          colors={['#FF7A00', '#FF2D55']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={priceStyles.limitedPill}>
          <Text style={priceStyles.limitedPillText} numberOfLines={1}>
            {limitedLabel}
          </Text>
        </LinearGradient>
      </View>

      <Text style={priceStyles.dealTitle}>{deal.name}</Text>
      {deal.highlights?.length ? (
        <Text style={priceStyles.highlights}>{deal.highlights.join(' · ')}</Text>
      ) : null}

      <View style={priceStyles.priceRow}>
        <Text style={priceStyles.saleHuge}>{formatTk(deal.sale_price)}</Text>
        <Text style={priceStyles.originalStrike}>{formatTk(originalNum)}</Text>
      </View>

      <LinearGradient
        colors={['#FF7A00', '#FF2D55']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={priceStyles.savePill}>
        <Text style={priceStyles.savePillText}>{saveLine}</Text>
      </LinearGradient>

      <View style={priceStyles.breakRow}>
        <View style={priceStyles.breakCol}>
          <Text style={priceStyles.breakLabel}>Original Price</Text>
          <Text style={priceStyles.breakValue}>{formatTk(originalNum)}</Text>
        </View>
        <View style={priceStyles.breakCol}>
          <Text style={priceStyles.breakLabel}>Restaurant Discount</Text>
          <Text style={priceStyles.breakValue}>
            {Number.isFinite(discountAmount) ? formatTk(discountAmount) : '—'}
          </Text>
        </View>
        <View style={priceStyles.breakCol}>
          <Text style={priceStyles.breakLabel}>Hungry Tiger Discount</Text>
          <Text style={priceStyles.breakValue}>{formatTk(htNum)}</Text>
        </View>
      </View>
    </View>
  );
}

/** Logo, restaurant name, deal subtitle, rating, sold / deals — sits on page bg (no card) */
function RestaurantIdentitySection({
  deal,
  dealsAtStoreCount,
  onStorePress,
}: {
  deal: GrouponDealDetail;
  dealsAtStoreCount: number;
  onStorePress: () => void;
}) {
  const soldCompact = () => {
    const t = deal.total_sales ?? 0;
    if (t >= 1000) return `${(t / 1000).toFixed(t % 1000 === 0 ? 0 : 1)}K+ sold`;
    if (t > 0) return `${t}+ sold`;
    return '0+ sold';
  };

  const subline =
    (deal.highlights?.length ? deal.highlights.join(' · ') : '') ||
    deal.categories?.[0]?.category_name ||
    deal.name;

  return (
    <View>
      <Pressable
        style={restaurantCardStyles.identityRow}
        onPress={onStorePress}
        accessibilityRole="button"
        accessibilityLabel={`${deal.restaurant_name}, view store`}>
        {deal.restaurant_image ? (
          <Image source={{ uri: deal.restaurant_image }} style={restaurantCardStyles.logo} />
        ) : (
          <View style={restaurantCardStyles.logoPlaceholder}>
            <MaterialCommunityIcons name="storefront-outline" size={26} color="#9E9E9E" />
          </View>
        )}
        <View style={restaurantCardStyles.identityMid}>
          <Text style={restaurantCardStyles.storeName} numberOfLines={3}>
            {deal.restaurant_name}
          </Text>
          <Text style={restaurantCardStyles.storeSub} numberOfLines={2}>
            {subline}
          </Text>
        </View>
        <View style={restaurantCardStyles.ratingCol}>
          {deal.reviews_count > 0 ? (
            <>
              <Text style={restaurantCardStyles.ratingBig}>4.5</Text>
              <View style={restaurantCardStyles.starReviewsRow}>
                <MaterialCommunityIcons name="star" size={16} color={Brand.yellow} />
                <Text style={restaurantCardStyles.reviewsTiny}>{deal.reviews_count} reviews</Text>
              </View>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="star-outline" size={22} color="#E0E0E0" />
              <Text style={restaurantCardStyles.noReviewsYet}>No reviews yet</Text>
            </>
          )}
        </View>
      </Pressable>

      <View style={restaurantCardStyles.soldDealsRow}>
        <Text style={restaurantCardStyles.soldLine}>
          <Text style={priceStyles.soldAccent}>{soldCompact()}</Text>
          <Text style={priceStyles.idMuted}> · ID: {deal.restaurant}</Text>
        </Text>
        <View style={priceStyles.dealsCountPill}>
          <Text style={priceStyles.dealsCountText}>
            {dealsAtStoreCount} Deal{dealsAtStoreCount === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function DealValidityLocationSection({
  deal,
  addressLine,
  phone,
}: {
  deal: GrouponDealDetail;
  addressLine: string;
  phone: string;
}) {
  return (
    <View>
      <View style={restaurantCardStyles.validRow}>
        <View style={restaurantCardStyles.validTextWrap}>
          <Text style={restaurantCardStyles.validGreen}>Active</Text>
          <Text style={restaurantCardStyles.validBlack}>
            {' '}
            · Valid {deal.valid_from} → {deal.valid_to}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color="#BDBDBD" />
      </View>

      <View style={priceStyles.divider} />

      <View style={restaurantCardStyles.addressBlock}>
        <Text style={styles.address} numberOfLines={5}>
          {addressLine || 'Address on request'}
        </Text>
        <View style={restaurantCardStyles.addressVDivider} />
        <View style={restaurantCardStyles.contactActions}>
          {deal.distance_km != null ? (
            <View style={restaurantCardStyles.contactItem}>
              <MaterialCommunityIcons name="map-marker-outline" size={22} color={Brand.black} />
              <Text style={restaurantCardStyles.contactCaption}>
                {Number(deal.distance_km) < 10
                  ? `${Number(deal.distance_km).toFixed(1)} km`
                  : `${Math.round(Number(deal.distance_km))} km`}
              </Text>
            </View>
          ) : (
            <View style={restaurantCardStyles.contactItem}>
              <MaterialCommunityIcons name="map-marker-outline" size={22} color="#BDBDBD" />
              <Text style={restaurantCardStyles.contactCaptionMuted}>Map</Text>
            </View>
          )}
          {phone ? (
            <Pressable
              style={restaurantCardStyles.contactItem}
              onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)}
              accessibilityRole="link">
              <MaterialCommunityIcons name="phone-outline" size={22} color={Brand.black} />
              <Text style={restaurantCardStyles.contactCaption}>Phone</Text>
            </Pressable>
          ) : (
            <View style={restaurantCardStyles.contactItem}>
              <MaterialCommunityIcons name="phone-off-outline" size={22} color="#BDBDBD" />
              <Text style={restaurantCardStyles.contactCaptionMuted}>Phone</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/** Below hero: restaurant first, then deal pricing, validity/location, tabs — flat on screen bg */
function DealHeaderUnifiedCard({
  deal,
  dealsAtStoreCount,
  usingListFallback,
  addressLine,
  phone,
  onStorePress,
  sectionTab,
  onTabDeals,
  onTabReviews,
}: {
  deal: GrouponDealDetail;
  dealsAtStoreCount: number;
  usingListFallback: boolean;
  addressLine: string;
  phone: string;
  onStorePress: () => void;
  sectionTab: 'deals' | 'reviews';
  onTabDeals: () => void;
  onTabReviews: () => void;
}) {
  return (
    <View style={detailStyles.headerStack}>
      {usingListFallback ? (
        <View style={[styles.fallbackBanner, { marginBottom: 14 }]}>
          <MaterialCommunityIcons name="information-outline" size={18} color={Brand.black} />
          <Text style={styles.fallbackBannerText}>
            Showing deal from nearby list. Log in to load full detail (menu breakdown & locations).
          </Text>
        </View>
      ) : null}

      <RestaurantIdentitySection
        deal={deal}
        dealsAtStoreCount={dealsAtStoreCount}
        onStorePress={onStorePress}
      />

      <View style={priceStyles.sectionDivider} />

      <DealPricingSection deal={deal} />

      <View style={priceStyles.sectionDivider} />

      <DealValidityLocationSection deal={deal} addressLine={addressLine} phone={phone} />

      <View style={styles.tabsRowInner}>
        <Pressable
          style={[styles.mainTab, sectionTab === 'deals' && styles.mainTabActive]}
          onPress={onTabDeals}>
          <Text style={[styles.mainTabText, sectionTab === 'deals' && styles.mainTabTextActive]}>Deals</Text>
        </Pressable>
        <Pressable
          style={[styles.mainTab, sectionTab === 'reviews' && styles.mainTabActive]}
          onPress={onTabReviews}>
          <Text style={[styles.mainTabText, sectionTab === 'reviews' && styles.mainTabTextActive]}>Reviews</Text>
        </Pressable>
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  headerStack: {
    marginHorizontal: H_PAD,
    marginTop: -14,
    paddingTop: 12,
    paddingBottom: 6,
  },
});

const restaurantCardStyles = StyleSheet.create({
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityMid: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  storeName: {
    fontSize: 17,
    fontWeight: '900',
    color: Brand.black,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    lineHeight: 22,
  },
  storeSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.grey,
    lineHeight: 18,
  },
  ratingCol: {
    alignItems: 'flex-end',
    minWidth: 72,
  },
  ratingBig: {
    fontSize: 28,
    fontWeight: '900',
    color: Brand.black,
    lineHeight: 30,
  },
  starReviewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  reviewsTiny: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.grey,
  },
  noReviewsYet: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: Brand.grey,
    textAlign: 'right',
    maxWidth: 76,
    lineHeight: 14,
  },
  soldDealsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14,
  },
  soldLine: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  validRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  validTextWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingRight: 8,
  },
  validGreen: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2E7D32',
  },
  validBlack: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.black,
  },
  addressBlock: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
  },
  addressVDivider: {
    width: 1,
    backgroundColor: '#E8E8E8',
    marginHorizontal: 12,
    alignSelf: 'stretch',
    minHeight: 56,
  },
  contactActions: {
    alignItems: 'flex-end',
    gap: 14,
  },
  contactItem: {
    alignItems: 'center',
    minWidth: 48,
  },
  contactCaption: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    color: Brand.black,
  },
  contactCaptionMuted: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#BDBDBD',
  },
});

const priceStyles = StyleSheet.create({
  sectionDivider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  flashLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Brand.orangePromo,
    letterSpacing: 0.3,
  },
  limitedPill: {
    maxWidth: '58%',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  limitedPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dealTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Brand.black,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  highlights: {
    fontSize: 13,
    color: Brand.grey,
    fontWeight: '600',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  saleHuge: {
    fontSize: 34,
    fontWeight: '900',
    color: Brand.orangePromo,
    letterSpacing: -1,
  },
  originalStrike: {
    fontSize: 17,
    fontWeight: '600',
    color: '#BDBDBD',
    textDecorationLine: 'line-through',
    marginBottom: 4,
  },
  savePill: {
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 18,
  },
  savePillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  breakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  breakCol: {
    flex: 1,
    alignItems: 'center',
  },
  breakLabel: {
    fontSize: 11,
    color: Brand.grey,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  breakValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Brand.black,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 14,
  },
  soldAccent: {
    color: Brand.orangePromo,
    fontWeight: '800',
  },
  idMuted: {
    color: Brand.grey,
    fontWeight: '600',
  },
  dealsCountPill: {
    backgroundColor: '#FFE8E0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    flexShrink: 0,
  },
  dealsCountText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C62828',
  },
});

type Props = {
  dealId: string;
};

function checkoutHref(dealIdProp: string, deal: GrouponDealDetail) {
  const id = deal.id != null ? String(deal.id) : dealIdProp;
  const q = new URLSearchParams();
  q.set('deal', id);
  q.set('restaurant', String(deal.restaurant));
  return `/groupon-checkout?${q.toString()}`;
}

export default function GrouponDealDetailScreen({ dealId }: Props) {
  const router = useRouter();
  const [trackGrouponFunnel] = useTrackGrouponFunnelMutation();
  const insets = useSafeAreaInsets();
  const { savedLocation, locationReady } = useLocationPicker();
  const lat = savedLocation?.latitude ?? DEFAULT_MAP_CENTER.latitude;
  const lon = savedLocation?.longitude ?? DEFAULT_MAP_CENTER.longitude;

  const dealIdNum = Number(dealId);
  const validDealId = Boolean(dealId) && Number.isFinite(dealIdNum) && dealIdNum > 0;

  /** Authenticated: full detail. Anonymous: API returns 401 — we merge list-cache fallback (same public feed as home). */
  const detailQuery = useGetGrouponDetailsQuery({ dealId }, { skip: !validDealId });
  const listQuery = useGetRestaurantsWithDealsQuery(
    { lat, lon, filter: 'all' },
    { skip: !locationReady || !validDealId }
  );

  const listFallback = useMemo(
    () => buildGrouponDetailFromListCache(dealIdNum, listQuery.data),
    [dealIdNum, listQuery.data]
  );

  const merged = detailQuery.data ?? listFallback ?? null;
  const deal = merged?.deal;
  const moreInStore = merged?.more_in_store ?? [];
  const usingListFallback = Boolean(!detailQuery.data && listFallback);

  const stillLoading =
    !merged &&
    (detailQuery.isLoading ||
      detailQuery.isFetching ||
      listQuery.isLoading ||
      listQuery.isFetching);

  const loadFailed =
    !merged &&
    !detailQuery.isLoading &&
    !detailQuery.isFetching &&
    !listQuery.isLoading &&
    !listQuery.isFetching;

  const [sectionTab, setSectionTab] = useState<'deals' | 'reviews'>('deals');
  const [menuCategory, setMenuCategory] = useState<string>('All');
  const {
    data: dealReviews = [],
    isLoading: isDealReviewsLoading,
    isFetching: isDealReviewsFetching,
  } = useGetGrouponDealReviewsQuery(
    { dealId: dealIdNum },
    { skip: !validDealId || sectionTab !== 'reviews' }
  );

  const categoryNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of deal?.categories ?? []) {
      if (c.category_name) names.add(c.category_name);
    }
    return ['All', ...Array.from(names)];
  }, [deal?.categories]);

  const flattenedItems = useMemo(() => {
    const rows: { category: string; item: GrouponDealCategoryItem }[] = [];
    for (const c of deal?.categories ?? []) {
      for (const it of c.items ?? []) {
        rows.push({ category: c.category_name, item: it });
      }
    }
    return rows;
  }, [deal?.categories]);

  const visibleIncluded = useMemo(() => {
    if (menuCategory === 'All') return flattenedItems;
    return flattenedItems.filter((r) => r.category === menuCategory);
  }, [flattenedItems, menuCategory]);

  const primaryImage = deal?.groupon_image || deal?.restaurant_image;
  const addressLine =
    (deal?.restaurant_location || '').trim() ||
    deal?.locations?.[0]?.details?.trim() ||
    deal?.locations?.[0]?.name?.trim() ||
    '';

  const phone = deal?.locations?.[0]?.phone?.trim() ?? '';

  const handleShare = async () => {
    if (!deal) return;
    try {
      await Share.share({
        message: `${deal.restaurant_name} — ${deal.name}\n${formatTk(deal.sale_price)}`,
      });
    } catch {
      /* ignore */
    }
  };

  if (!dealId) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.muted}>Missing deal.</Text>
        <Pressable style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (stillLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <Pressable
          style={[styles.circleBtn, styles.backFloating, { top: insets.top + 8 }]}
          onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.black} />
        </Pressable>
        <ActivityIndicator size="large" color={Brand.magenta} />
        <Text style={styles.loadingHint}>Loading deal…</Text>
      </SafeAreaView>
    );
  }

  if (loadFailed || !deal) {
    return (
      <SafeAreaView style={styles.centered}>
        <Pressable
          style={[styles.circleBtn, styles.backFloating, { top: insets.top + 8 }]}
          onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.black} />
        </Pressable>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.grey} />
        <Text style={styles.errorTitle}>Could not load deal</Text>
        <Text style={styles.errorSub}>Pull to refresh on home, or log in for full deal details.</Text>
        <Pressable
          style={styles.retryBtn}
          onPress={() => {
            void detailQuery.refetch();
            void listQuery.refetch();
          }}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.linkBack}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const pct = discountPercent(deal.original_price, deal.sale_price);

  const handleBuyNow = () => {
    void buildGrouponFunnelPayload({
      step: 'add_to_cart',
      restaurantId: deal.restaurant,
      dealId: Number(deal.id ?? dealId),
      meta: {
        source: 'deal_details_buy_now',
        sale_price: deal.sale_price,
      },
    })
      .then((payload) => trackGrouponFunnel(payload).unwrap())
      .catch(() => {
        // Ignore telemetry failures; continue checkout flow.
      });
    router.push(checkoutHref(dealId, deal) as never);
  };

  const handleStorePress = () => {
    void buildGrouponFunnelPayload({
      step: 'store_visit',
      restaurantId: deal.restaurant,
      dealId: Number(deal.id ?? dealId),
      meta: { source: 'deal_details_store_cta' },
    })
      .then((payload) => trackGrouponFunnel(payload).unwrap())
      .catch(() => {
        // Ignore telemetry failures; continue navigation.
      });
    router.push(`/restaurant/${deal.restaurant}` as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable style={styles.circleBtn} onPress={() => router.back()} accessibilityRole="button">
          <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.black} />
        </Pressable>
        <View style={styles.topActions}>
          <Pressable style={styles.circleBtn}>
            <MaterialCommunityIcons name="bookmark-outline" size={20} color={Brand.black} />
          </Pressable>
          <Pressable style={styles.circleBtn} onPress={handleShare}>
            <MaterialCommunityIcons name="share-variant-outline" size={20} color={Brand.black} />
          </Pressable>
          <Pressable style={styles.circleBtn}>
            <MaterialCommunityIcons name="dots-vertical" size={20} color={Brand.black} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollFill}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Image
            source={{
              uri:
                primaryImage ||
                'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=800&q=80',
            }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.45)']}
            style={styles.heroGradient}
          />
        </View>

        <DealHeaderUnifiedCard
          deal={deal}
          dealsAtStoreCount={1 + moreInStore.length}
          usingListFallback={usingListFallback}
          addressLine={addressLine}
          phone={phone}
          onStorePress={handleStorePress}
          sectionTab={sectionTab}
          onTabDeals={() => setSectionTab('deals')}
          onTabReviews={() => setSectionTab('reviews')}
        />

        {sectionTab === 'deals' ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}>
              {categoryNames.map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.categoryChip, menuCategory === cat && styles.categoryChipActive]}
                  onPress={() => setMenuCategory(cat)}>
                  <Text style={[styles.categoryText, menuCategory === cat && styles.categoryTextActive]}>{cat}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.sectionLabelWrap}>
              <Text style={styles.sectionLabel}>Included with this deal</Text>
            </View>
            <View style={styles.menuList}>
              {visibleIncluded.length === 0 ? (
                <Text style={styles.emptyInline}>No breakdown items for this category.</Text>
              ) : (
                visibleIncluded.map((row, idx) => (
                  <IncludedItemRow
                    key={`${row.category}-${row.item.name}-${idx}`}
                    item={row.item}
                    primaryThumb={deal.groupon_image}
                    restaurantThumb={deal.restaurant_image}
                    voucherSalePrice={deal.sale_price}
                    voucherPct={pct}
                    totalSales={deal.total_sales}
                  />
                ))
              )}
            </View>

            {moreInStore.length > 0 ? (
              <>
                <View style={styles.sectionLabelWrap}>
                  <Text style={styles.sectionLabel}>More in store</Text>
                </View>
                <View style={styles.menuList}>
                  {moreInStore.map((item) => (
                    <MoreDealRow
                      key={item.id}
                      item={item}
                      onBuy={() => router.push(`/groupon/${item.id}` as never)}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : (
          <ReviewsSection
            reviews={dealReviews.length ? dealReviews : deal.reviews}
            loading={isDealReviewsLoading || isDealReviewsFetching}
          />
        )}

        <View style={{ height: 100 + insets.bottom }} />
      </ScrollView>

      <View style={[styles.buyBarOuter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={styles.storeCol} onPress={handleStorePress} accessibilityRole="button">
          <MaterialCommunityIcons name="storefront-outline" size={22} color="#1F2933" />
          <Text style={styles.storeLabel}>Store</Text>
        </Pressable>
        <Pressable style={styles.buyNowTouchable} onPress={handleBuyNow} accessibilityRole="button">
          <LinearGradient
            colors={['#FF7A00', '#FF2D55']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.buyNowGradient}>
            <Text style={styles.buyNowTitle}>Buy Now {formatTk(deal.sale_price)}</Text>
            <Text style={styles.buyNowSub}>Instant discount applied at checkout</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function IncludedItemRow({
  item,
  primaryThumb,
  restaurantThumb,
  voucherSalePrice,
  voucherPct,
  totalSales,
}: {
  item: GrouponDealCategoryItem;
  primaryThumb: string | null;
  restaurantThumb: string | null;
  voucherSalePrice: number;
  voucherPct: number | null;
  totalSales?: number;
}) {
  const img =
    item.image && item.image.length > 4 ? item.image : primaryThumb || restaurantThumb || '';

  const listPrice = Number(item.price);

  return (
    <View style={styles.menuCard}>
      <Image
        source={{
          uri:
            img ||
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80',
        }}
        style={styles.menuImage}
      />
      <View style={styles.menuBody}>
        <Text style={styles.menuTitle} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.badgesRow}>
          <View style={[styles.badge, styles.badgePink]}>
            <Text style={styles.badgePinkText}>Included item</Text>
          </View>
          {item.qty > 1 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>×{item.qty}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.priceMain}>{formatTk(listPrice)}</Text>
        <Text style={styles.voucherFoot}>
          Full voucher · Pay {formatTk(voucherSalePrice)}
          {voucherPct != null ? ` · Save ~${voucherPct}%` : ''}
        </Text>
        <View style={[styles.priceRow, { marginTop: 10 }]}>
          <View />
          <Pressable style={styles.buyBtn}>
            <Text style={styles.buyBtnText}>Buy now</Text>
          </Pressable>
        </View>
        <Text style={styles.soldText}>{soldLabel(totalSales)}</Text>
      </View>
    </View>
  );
}

function MoreDealRow({ item, onBuy }: { item: GrouponDealSummary; onBuy: () => void }) {
  const pct = discountPercent(item.original_price, item.sale_price);
  const img =
    item.groupon_image ||
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';

  return (
    <View style={styles.menuCard}>
      <Image source={{ uri: img }} style={styles.menuImage} />
      <View style={styles.menuBody}>
        <Text style={styles.menuTitle} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.badgesRow}>
          {item.highlights?.map((h) => (
            <View key={h} style={styles.badge}>
              <Text style={styles.badgeText}>{h}</Text>
            </View>
          ))}
        </View>
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceMain}>{formatTk(item.sale_price)}</Text>
            <View style={styles.priceSubRow}>
              <Text style={styles.priceOriginal}>{formatTk(Number(item.original_price))}</Text>
              {pct != null ? <Text style={styles.discountText}>-{pct}%</Text> : null}
            </View>
          </View>
          <Pressable style={styles.buyBtn} onPress={onBuy}>
            <Text style={styles.buyBtnText}>Buy now</Text>
          </Pressable>
        </View>
        <Text style={styles.soldText}>{soldLabel(item.total_sales)}</Text>
      </View>
    </View>
  );
}

function ReviewsSection({ reviews, loading = false }: { reviews: unknown; loading?: boolean }) {
  if (loading) {
    return (
      <View style={styles.reviewCard}>
        <Text style={styles.reviewBody}>Loading reviews...</Text>
      </View>
    );
  }
  const list = Array.isArray(reviews) ? reviews : [];
  if (list.length === 0) {
    return (
      <View style={styles.reviewCard}>
        <Text style={styles.reviewTitle}>No reviews yet</Text>
        <Text style={styles.reviewBody}>Be the first to review this deal after your visit.</Text>
      </View>
    );
  }
  return (
    <>
      <View style={styles.reviewCard}>
        <Text style={styles.reviewTitle}>
          {list.length} review{list.length === 1 ? '' : 's'}
        </Text>
      </View>
      {list.slice(0, 10).map((raw, index) => {
        const review = raw as GrouponDealReview;
        const userName =
          (typeof review.user_name === 'string' && review.user_name) ||
          (typeof review.user?.name === 'string' && review.user.name) ||
          'Guest';
        const rating =
          typeof review.rating === 'number' ? Math.max(0, Math.min(5, review.rating)) : 0;
        const comment =
          typeof review.comment === 'string' && review.comment.trim()
            ? review.comment.trim()
            : 'No written comment.';
        return (
          <View key={`${review.id ?? 'review'}-${index}`} style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>{userName}</Text>
            <Text style={styles.reviewBody}>Rating: {rating.toFixed(1)} / 5</Text>
            <Text style={styles.reviewBody}>{comment}</Text>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.greyLight },
  scrollFill: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: H_PAD,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topActions: { flexDirection: 'row', gap: 8 },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  scrollContent: { paddingBottom: 8 },
  heroWrap: {
    width: SCREEN_W,
    height: 220,
    backgroundColor: '#EEE',
  },
  heroImage: { width: '100%', height: '100%' },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  address: { flex: 1, fontSize: 14, color: Brand.black, lineHeight: 21, fontWeight: '600' },
  /** Deals / Reviews — beneath header sections */
  tabsRowInner: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 8,
    gap: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDE1E4',
  },
  mainTab: { borderBottomWidth: 3, borderBottomColor: 'transparent', paddingBottom: 12 },
  mainTabActive: { borderBottomColor: Brand.black },
  mainTabText: { fontSize: 20, color: '#BDBDBD', fontWeight: '800' },
  mainTabTextActive: { color: Brand.black },
  categoryRow: {
    marginTop: 10,
    paddingHorizontal: H_PAD,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: Brand.greyLight,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
  },
  categoryChipActive: { backgroundColor: Brand.black },
  categoryText: { fontSize: 14, fontWeight: '700', color: Brand.black },
  categoryTextActive: { color: Brand.white },
  sectionLabelWrap: { paddingHorizontal: H_PAD, paddingTop: 8, paddingBottom: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: Brand.grey, textTransform: 'uppercase', letterSpacing: 0.6 },
  menuList: { paddingHorizontal: H_PAD, paddingTop: 6, gap: 12 },
  menuCard: {
    flexDirection: 'row',
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  menuImage: { width: 96, height: 96, borderRadius: 12, backgroundColor: '#EEE' },
  menuBody: { flex: 1, minWidth: 0 },
  menuTitle: { fontSize: 17, fontWeight: '900', color: Brand.black, lineHeight: 22 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: { backgroundColor: '#F4F4F4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgePink: { backgroundColor: '#FCE4EC' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#424242' },
  badgePinkText: { fontSize: 11, fontWeight: '800', color: Brand.magenta },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  priceMain: { fontSize: 22, fontWeight: '900', color: Brand.magenta, lineHeight: 24 },
  priceSubRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 },
  priceOriginal: { fontSize: 14, color: '#BDBDBD', textDecorationLine: 'line-through', fontWeight: '600' },
  discountText: { fontSize: 15, color: Brand.magenta, fontWeight: '900' },
  buyBtn: {
    backgroundColor: Brand.yellow,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buyBtnText: { fontSize: 14, fontWeight: '900', color: Brand.black },
  soldText: { textAlign: 'right', color: Brand.grey, fontSize: 12, marginTop: 6, fontWeight: '600' },
  emptyInline: { color: Brand.grey, fontSize: 14, paddingVertical: 12 },
  reviewCard: {
    marginHorizontal: H_PAD,
    marginTop: 8,
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  reviewTitle: { fontSize: 17, fontWeight: '800', color: Brand.black },
  reviewBody: { fontSize: 14, color: Brand.grey, lineHeight: 21 },
  errorSub: {
    fontSize: 13,
    color: Brand.grey,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 19,
  },
  fallbackBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Brand.yellowMuted,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(252,210,0,0.8)',
  },
  fallbackBannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: Brand.black, lineHeight: 17 },
  voucherFoot: { fontSize: 12, color: Brand.grey, fontWeight: '600', marginTop: 6 },
  backFloating: {
    position: 'absolute',
    left: H_PAD,
    zIndex: 2,
    backgroundColor: Brand.white,
  },
  buyBarOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    backgroundColor: Brand.white,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
  },
  storeCol: {
    alignItems: 'center',
    marginRight: 14,
    minWidth: 44,
  },
  storeLabel: { fontSize: 10, color: Brand.grey, marginTop: 2, fontWeight: '600' },
  buyNowTouchable: {
    flex: 1,
    minWidth: 0,
  },
  buyNowGradient: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyNowTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  buyNowSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12, backgroundColor: Brand.greyLight },
  loadingHint: { color: Brand.grey, fontWeight: '600', marginTop: 8 },
  errorTitle: { fontSize: 17, fontWeight: '800', color: Brand.black },
  muted: { color: Brand.grey },
  retryBtn: {
    backgroundColor: Brand.yellow,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 8,
  },
  retryBtnText: { fontWeight: '900', color: Brand.black },
  linkBack: { marginTop: 8, color: Brand.magenta, fontWeight: '700' },
});
