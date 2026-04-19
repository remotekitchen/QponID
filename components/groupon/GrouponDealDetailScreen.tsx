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
import {
  buildGrouponDetailFromListCache,
  type GrouponDealCategoryItem,
  type GrouponDealSummary,
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

type Props = {
  dealId: string;
};

export default function GrouponDealDetailScreen({ dealId }: Props) {
  const router = useRouter();
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

        <View style={styles.metaCard}>
          {usingListFallback ? (
            <View style={styles.fallbackBanner}>
              <MaterialCommunityIcons name="information-outline" size={18} color={Brand.black} />
              <Text style={styles.fallbackBannerText}>
                Showing deal from nearby list. Log in to load full detail (menu breakdown & locations).
              </Text>
            </View>
          ) : null}
          <Text style={styles.restaurantTitle}>{deal.restaurant_name}</Text>
          <Text style={styles.dealName}>{deal.name}</Text>
          {deal.highlights?.length ? (
            <Text style={styles.categoryHint}>{deal.highlights.join(' · ')}</Text>
          ) : null}

          {deal.reviews_count > 0 ? (
            <View style={styles.ratingRow}>
              <View style={styles.ratingBlock}>
                <Text style={styles.ratingNum}>4.5</Text>
                <MaterialCommunityIcons name="star" size={22} color={Brand.yellow} />
              </View>
              <Text style={styles.reviewCount}>{deal.reviews_count} reviews</Text>
            </View>
          ) : (
            <Text style={styles.noRating}>No reviews yet</Text>
          )}

          <View style={styles.openRow}>
            <Text style={styles.validText}>
              Valid {deal.valid_from} → {deal.valid_to}
            </Text>
            <Pressable>
              <Text style={styles.detailChevron}>Details {'>'}</Text>
            </Pressable>
          </View>

          <View style={styles.addressRow}>
            <Text style={styles.address} numberOfLines={4}>
              {addressLine || 'Address on request'}
            </Text>
            <View style={styles.contactCol}>
              {deal.distance_km != null ? (
                <Text style={styles.distanceTxt}>
                  {Number(deal.distance_km) < 10
                    ? `${Number(deal.distance_km).toFixed(1)} km`
                    : `${Math.round(Number(deal.distance_km))} km`}
                </Text>
              ) : null}
              {phone ? (
                <Pressable
                  style={styles.phoneFab}
                  onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)}>
                  <MaterialCommunityIcons name="phone" size={20} color={Brand.black} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.tabsRow}>
          <Pressable
            style={[styles.mainTab, sectionTab === 'deals' && styles.mainTabActive]}
            onPress={() => setSectionTab('deals')}>
            <Text style={[styles.mainTabText, sectionTab === 'deals' && styles.mainTabTextActive]}>Deals</Text>
          </Pressable>
          <Pressable
            style={[styles.mainTab, sectionTab === 'reviews' && styles.mainTabActive]}
            onPress={() => setSectionTab('reviews')}>
            <Text style={[styles.mainTabText, sectionTab === 'reviews' && styles.mainTabTextActive]}>Reviews</Text>
          </Pressable>
        </View>

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
          <ReviewsSection reviews={deal.reviews} />
        )}

        <View style={{ height: 88 }} />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <Pressable style={styles.bottomBtnGhost}>
          <MaterialCommunityIcons name="pencil-outline" size={22} color={Brand.black} />
          <Text style={styles.bottomBtnText}>Write review</Text>
        </Pressable>
        <Pressable style={styles.bottomBtnGhost}>
          <MaterialCommunityIcons name="bookmark-outline" size={22} color={Brand.black} />
          <Text style={styles.bottomBtnText}>Save</Text>
        </Pressable>
      </SafeAreaView>
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

function ReviewsSection({ reviews }: { reviews: unknown }) {
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
    <View style={styles.reviewCard}>
      <Text style={styles.reviewBody}>
        {list.length} review{list.length === 1 ? '' : 's'} · detailed list can be wired when review objects are finalized.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.greyLight },
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
  metaCard: {
    backgroundColor: Brand.white,
    paddingHorizontal: H_PAD,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 6,
  },
  restaurantTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Brand.black,
    letterSpacing: -0.3,
    textTransform: 'uppercase',
  },
  dealName: { fontSize: 17, fontWeight: '700', color: Brand.grey, marginTop: 2 },
  categoryHint: { fontSize: 13, color: Brand.grey, fontWeight: '600' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  ratingBlock: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  ratingNum: { fontSize: 36, fontWeight: '900', color: Brand.black, lineHeight: 38 },
  reviewCount: { fontSize: 15, color: Brand.grey, fontWeight: '600', marginBottom: 4 },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  validText: { fontSize: 15, fontWeight: '700', color: '#2E7D32' },
  detailChevron: { fontSize: 14, color: Brand.grey, fontWeight: '700' },
  addressRow: { flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'flex-start' },
  address: { flex: 1, fontSize: 14, color: Brand.black, lineHeight: 21, fontWeight: '600' },
  contactCol: { alignItems: 'flex-end', gap: 8 },
  distanceTxt: { fontSize: 14, fontWeight: '800', color: Brand.grey },
  phoneFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.yellowMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Brand.white,
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    gap: 28,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  mainTab: { borderBottomWidth: 3, borderBottomColor: 'transparent', paddingBottom: 12 },
  mainTabActive: { borderBottomColor: Brand.black },
  mainTabText: { fontSize: 20, color: '#BDBDBD', fontWeight: '800' },
  mainTabTextActive: { color: Brand.black },
  categoryRow: {
    paddingHorizontal: H_PAD,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: Brand.white,
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
  noRating: { fontSize: 14, color: Brand.grey, fontWeight: '600', marginTop: 8 },
  voucherFoot: { fontSize: 12, color: Brand.grey, fontWeight: '600', marginTop: 6 },
  backFloating: {
    position: 'absolute',
    left: H_PAD,
    zIndex: 2,
    backgroundColor: Brand.white,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: H_PAD,
    backgroundColor: Brand.white,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  bottomBtnGhost: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12 },
  bottomBtnText: { fontSize: 14, fontWeight: '700', color: Brand.black },
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
