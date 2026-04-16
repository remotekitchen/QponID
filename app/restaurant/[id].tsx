import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/Colors';
import { NEARBY_PROMOS, RESTAURANT_DETAILS } from '@/constants/homeMockData';

type SectionTab = 'discount' | 'reviews';

const formatRupiah = (value: number) => `Rp${value.toLocaleString('id-ID')}`;

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const restaurant = NEARBY_PROMOS.find((item) => item.id === id);
  const detail = id ? RESTAURANT_DETAILS[id] : undefined;
  const [sectionTab, setSectionTab] = useState<SectionTab>('discount');
  const [menuCategory, setMenuCategory] = useState(detail?.menuCategories[0]?.id ?? 'all');

  const visibleItems = useMemo(() => {
    if (!detail) return [];
    if (menuCategory === 'all') return detail.menuItems;
    return detail.menuItems.filter((item) => item.categoryId === menuCategory);
  }, [detail, menuCategory]);

  if (!restaurant || !detail) {
    return (
      <SafeAreaView style={styles.emptyWrap}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.emptyTitle}>Restaurant not found</Text>
        <Pressable style={styles.emptyBtn} onPress={() => router.back()}>
          <Text style={styles.emptyBtnText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable style={styles.circleBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.black} />
        </Pressable>
        <View style={styles.topActions}>
          <Pressable style={styles.circleBtn}>
            <MaterialCommunityIcons name="bookmark-outline" size={20} color={Brand.black} />
          </Pressable>
          <Pressable style={styles.circleBtn}>
            <MaterialCommunityIcons name="share-variant-outline" size={20} color={Brand.black} />
          </Pressable>
          <Pressable style={styles.circleBtn}>
            <MaterialCommunityIcons name="dots-vertical" size={20} color={Brand.black} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={{ uri: detail.coverImage }} style={styles.heroImage} />
        <View style={styles.metaWrap}>
          {restaurant.isHalal ? (
            <View style={styles.halalPill}>
              <Text style={styles.halalText}>HALAL</Text>
            </View>
          ) : null}
          <Text style={styles.title}>{restaurant.title}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingValue}>{restaurant.rating}</Text>
            <Text style={styles.reviewText}>{restaurant.reviewCount} reviews</Text>
          </View>
          <View style={styles.openRow}>
            <Text style={styles.openText}>Open {restaurant.openHours}</Text>
            <Pressable>
              <Text style={styles.detailLink}>Details</Text>
            </Pressable>
          </View>
          <View style={styles.addressRow}>
            <Text style={styles.address} numberOfLines={2}>
              {restaurant.address}
            </Text>
            <View style={styles.contactCol}>
              <Text style={styles.distance}>{restaurant.distance}</Text>
              <Text style={styles.contact}>Phone</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabsRow}>
          <Pressable
            style={[styles.mainTab, sectionTab === 'discount' && styles.mainTabActive]}
            onPress={() => setSectionTab('discount')}>
            <Text style={[styles.mainTabText, sectionTab === 'discount' && styles.mainTabTextActive]}>Discount</Text>
          </Pressable>
          <Pressable
            style={[styles.mainTab, sectionTab === 'reviews' && styles.mainTabActive]}
            onPress={() => setSectionTab('reviews')}>
            <Text style={[styles.mainTabText, sectionTab === 'reviews' && styles.mainTabTextActive]}>Reviews</Text>
          </Pressable>
        </View>

        {sectionTab === 'discount' ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {detail.menuCategories.map((cat) => (
                <Pressable
                  key={cat.id}
                  style={[styles.categoryChip, menuCategory === cat.id && styles.categoryChipActive]}
                  onPress={() => setMenuCategory(cat.id)}>
                  <Text style={[styles.categoryText, menuCategory === cat.id && styles.categoryTextActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.menuList}>
              {visibleItems.map((item) => (
                <View key={item.id} style={styles.menuCard}>
                  <Image source={{ uri: item.image }} style={styles.menuImage} />
                  <View style={styles.menuBody}>
                    <Text style={styles.menuTitle}>{item.name}</Text>
                    {item.promoLabel ? <Text style={styles.newPriceText}>{item.promoLabel}</Text> : null}
                    <View style={styles.badgesRow}>
                      {item.badges.map((badge) => (
                        <View key={badge} style={styles.badge}>
                          <Text style={styles.badgeText}>{badge}</Text>
                        </View>
                      ))}
                      {item.bundleLabel ? (
                        <View style={[styles.badge, styles.bundleBadge]}>
                          <Text style={styles.badgeText}>{item.bundleLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.priceRow}>
                      <View>
                        <Text style={styles.priceMain}>{formatRupiah(item.price)}</Text>
                        {item.originalPrice ? (
                          <View style={styles.priceSubRow}>
                            <Text style={styles.priceOriginal}>{formatRupiah(item.originalPrice)}</Text>
                            {item.discountPercent ? <Text style={styles.discountText}>-{item.discountPercent}%</Text> : null}
                          </View>
                        ) : null}
                      </View>
                      <Pressable
                        style={styles.buyBtn}
                        onPress={() => Alert.alert('Added to cart', `${item.name} has been added.`)}>
                        <Text style={styles.buyBtnText}>Buy now</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.soldText}>{item.soldText}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>Reviews coming soon</Text>
            <Text style={styles.reviewBody}>
              This is static frontend only for now. Real reviews can be connected when you add your API.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.greyLight },
  topBar: {
    backgroundColor: Brand.greyLight,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topActions: { flexDirection: 'row', gap: 8 },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingBottom: 24 },
  heroImage: { width: '100%', height: 190, backgroundColor: '#EEE' },
  metaWrap: { backgroundColor: Brand.white, padding: 16, gap: 8 },
  halalPill: { alignSelf: 'flex-start', backgroundColor: '#4CAF50', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  halalText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  title: { fontSize: 31, fontWeight: '900', color: Brand.black, lineHeight: 35 },
  ratingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  ratingValue: { fontSize: 42, fontWeight: '900', color: Brand.black, lineHeight: 44 },
  reviewText: { fontSize: 16, color: Brand.grey, fontWeight: '600' },
  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  openText: { fontSize: 18, fontWeight: '700', color: '#2E7D32' },
  detailLink: { fontSize: 14, color: Brand.grey, fontWeight: '700' },
  addressRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  address: { flex: 1, fontSize: 15, color: Brand.black, lineHeight: 22, fontWeight: '600' },
  contactCol: { minWidth: 72, alignItems: 'flex-end' },
  distance: { fontSize: 18, fontWeight: '800', color: Brand.grey },
  contact: { fontSize: 13, color: Brand.grey, marginTop: 2 },
  tabsRow: { flexDirection: 'row', backgroundColor: Brand.white, paddingHorizontal: 16, paddingTop: 14, gap: 20 },
  mainTab: { borderBottomWidth: 2, borderBottomColor: 'transparent', paddingBottom: 10 },
  mainTabActive: { borderBottomColor: Brand.black },
  mainTabText: { fontSize: 26, color: '#9E9E9E', fontWeight: '800' },
  mainTabTextActive: { color: Brand.black },
  categoryRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 10, backgroundColor: Brand.white },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
  },
  categoryChipActive: { backgroundColor: Brand.black },
  categoryText: { fontSize: 15, fontWeight: '700', color: Brand.black },
  categoryTextActive: { color: Brand.white },
  menuList: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  menuCard: { flexDirection: 'row', backgroundColor: Brand.white, borderRadius: 14, padding: 10, gap: 10 },
  menuImage: { width: 92, height: 92, borderRadius: 10, backgroundColor: '#EEE' },
  menuBody: { flex: 1 },
  menuTitle: { fontSize: 21, fontWeight: '900', color: Brand.black, lineHeight: 24 },
  newPriceText: { fontSize: 14, color: '#D81B60', fontWeight: '700', marginTop: 2 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: { backgroundColor: '#F4F4F4', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  bundleBadge: { backgroundColor: '#E0E0E0' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#2E2E2E' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  priceMain: { fontSize: 35, fontWeight: '900', color: '#C62828', lineHeight: 36 },
  priceSubRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  priceOriginal: { fontSize: 26, color: '#9E9E9E', textDecorationLine: 'line-through', lineHeight: 29 },
  discountText: { fontSize: 29, color: '#D81B60', fontWeight: '900', lineHeight: 30 },
  buyBtn: {
    backgroundColor: '#FCD200',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buyBtnText: { fontSize: 18, fontWeight: '900', color: Brand.black },
  soldText: { textAlign: 'right', color: Brand.grey, fontSize: 14, marginTop: 4 },
  reviewCard: { marginHorizontal: 16, marginTop: 8, backgroundColor: Brand.white, borderRadius: 14, padding: 14, gap: 8 },
  reviewTitle: { fontSize: 18, fontWeight: '800', color: Brand.black },
  reviewBody: { fontSize: 14, color: Brand.grey, lineHeight: 20 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.greyLight, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Brand.black },
  emptyBtn: { backgroundColor: Brand.black, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  emptyBtnText: { color: Brand.white, fontWeight: '700' },
});
