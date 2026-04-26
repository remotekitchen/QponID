import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/Colors';

export type RestaurantDealItem = {
  key: string;
  title: string;
  sold: string;
  price: string;
  originalPrice?: string;
  discountTag?: string;
  image: string;
  placeLabel: string;
  distanceKm: number | null;
  restaurantId: number;
  dealId: number;
  totalSales: number;
  categoryLabel: string;
  percentOffApi: number | null;
  logoUrl: string | null;
  reviewCount: number | null;
  rating: number | null;
};

function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const m = Math.max(1, Math.round(km * 1000));
    return `${m.toLocaleString('en-BD')} m away`;
  }
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

function formatPercentAndPriceForLine(d: RestaurantDealItem): { pct: string; price: string; name: string } {
  const parts = d.title.split('|').map((v) => v.trim());
  const name = parts[1] || 'Deal';
  if (d.percentOffApi != null && d.percentOffApi > 0) {
    return { pct: `-${d.percentOffApi}% off`, price: d.price, name };
  }
  const priceNum = Number(String(d.price).replace(/[^\d.]/g, ''));
  const originalNum = d.originalPrice ? Number(String(d.originalPrice).replace(/[^\d.]/g, '')) : NaN;
  if (Number.isFinite(priceNum) && Number.isFinite(originalNum) && originalNum > 0) {
    const p = Math.round(((originalNum - priceNum) / originalNum) * 100);
    if (p > 0) return { pct: `-${p}% off`, price: d.price, name };
  }
  if (d.discountTag) return { pct: d.discountTag, price: d.price, name };
  return { pct: '', price: d.price, name };
}

function formatRatingLine(d: RestaurantDealItem): string {
  if (d.rating != null && d.rating > 0) {
    if (d.reviewCount != null && d.reviewCount > 0) return `${d.rating.toFixed(1)}(${d.reviewCount})`;
    return d.rating.toFixed(1);
  }
  return '—';
}

export default function RestaurantDealGroupRow({
  deals,
  totalDeals,
  onOpenDeal,
}: {
  deals: RestaurantDealItem[];
  totalDeals: number;
  onOpenDeal: (d: RestaurantDealItem) => void;
}) {
  const head = deals[0];
  if (!head) return null;
  const [restaurantName] = head.title.split('|').map((v) => v.trim());
  const thumb = (head.logoUrl && head.logoUrl.length > 4 ? head.logoUrl : null) || head.image;
  const maxSales = Math.max(...deals.map((d) => d.totalSales), 0);
  const soldLabel = maxSales >= 1000 ? `${(maxSales / 1000).toFixed(0).replace(/\.0$/, '')}K+ sold` : `${maxSales}+ sold`;

  return (
    <View style={styles.dealCard}>
      <Image source={{ uri: thumb }} style={styles.dealImg} />
      <View style={styles.dealBody}>
        <Text style={styles.dealTitle} numberOfLines={1}>
          {restaurantName || 'Restaurant'}
        </Text>
        <View style={styles.dealMetaRow}>
          <MaterialCommunityIcons name="star" size={12} color="#F6C035" />
          <Text style={styles.dealMetaText} numberOfLines={1}>
            {formatRatingLine(head)}
          </Text>
          <Text style={styles.dealMetaDot}>•</Text>
          <Text style={styles.dealMetaText} numberOfLines={1}>
            {head.categoryLabel}
          </Text>
        </View>
        <View style={styles.dealTagRow}>
          {maxSales < 5 ? <Text style={styles.dealTagPink}>New user</Text> : null}
          {maxSales < 5 ? <Text style={styles.dealTagSep}> • </Text> : null}
          <Text style={styles.dealTagMuted} numberOfLines={1}>
            {soldLabel}
          </Text>
        </View>
        {deals.map((d) => {
          const { pct, price, name } = formatPercentAndPriceForLine(d);
          return (
            <Pressable key={d.key} onPress={() => onOpenDeal(d)} style={styles.dealLineRow} hitSlop={{ top: 2, bottom: 2 }}>
              {pct ? <Text style={styles.dealDiscountText}>{pct}</Text> : null}
              <Text style={styles.dealPriceLine}>{price}</Text>
              <Text style={styles.dealLineName} numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          );
        })}
        {totalDeals > 0 ? (
          <Text style={styles.dealTotalHint} numberOfLines={1}>
            {totalDeals > deals.length ? `Showing ${deals.length} of ${totalDeals} deals` : `${totalDeals} ${totalDeals === 1 ? 'deal' : 'deals'}`}
          </Text>
        ) : null}
        {head.distanceKm != null ? (
          <View style={styles.dealLocRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={12} color="#8A8A8A" />
            <Text style={styles.dealLocText} numberOfLines={1}>
              {formatDistanceKm(head.distanceKm)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  dealTitle: { fontSize: 14, fontWeight: '800', color: '#191919', marginBottom: 1 },
  dealMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  dealMetaText: { fontSize: 12, color: '#666', fontWeight: '500' },
  dealMetaDot: { fontSize: 11, color: '#A0A0A0' },
  dealTagRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  dealTagPink: { fontSize: 11, color: Brand.magenta, fontWeight: '700' },
  dealTagMuted: { fontSize: 11, color: '#484848', fontWeight: '600' },
  dealTagSep: { fontSize: 12, color: '#9E9E9E' },
  dealLineRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', gap: 4, marginBottom: 1 },
  dealDiscountText: { fontSize: 12, fontWeight: '800', color: '#C62828' },
  dealPriceLine: { fontSize: 11, color: Brand.magenta, fontWeight: '800' },
  dealLineName: { flex: 1, fontSize: 11, color: '#343434', fontWeight: '600' },
  dealTotalHint: { fontSize: 11, color: Brand.grey, fontWeight: '600', marginTop: 2, marginBottom: 2 },
  dealLocRow: { flex: 0, flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  dealLocText: { fontSize: 10, color: '#8A8A8A', fontWeight: '600' },
});

