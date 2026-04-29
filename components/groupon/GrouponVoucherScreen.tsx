import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { Brand } from '@/constants/Colors';
import {
  type GrouponVoucherRedeemStatusResponse,
  useLazyGetVoucherRedeemStatusQuery,
} from '@/store/grouponApi';
import { setGrouponPurchase } from '@/store/grouponPurchaseSlice';
import type { RootState } from '@/store';

const PAGE_BG = '#F6F6F6';
const FALLBACK_QR =
  'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=hungry-tiger';
const FALLBACK_RESTAURANT_IMAGE =
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=400&q=80';

function formatTk(value: number) {
  const n = Number(value);
  if (Number.isNaN(n)) return '৳0';
  const hasFraction = Math.abs(n % 1) > 0.001;
  return `৳${n.toLocaleString('en-BD', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function isPaidPayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const vouchers = (data as { vouchers?: Array<{ is_paid?: boolean }> }).vouchers;
  return Array.isArray(vouchers) && vouchers.some((v) => v?.is_paid === true);
}

function extractOrderId(purchase: unknown): string | number | null {
  if (!purchase || typeof purchase !== 'object') return null;
  const obj = purchase as Record<string, unknown>;
  const directId = obj.id;
  if (typeof directId === 'number' && Number.isFinite(directId)) return directId;
  if (typeof directId === 'string' && directId.trim()) return directId.trim();

  const orderId = obj.order_id;
  if (typeof orderId === 'number' && Number.isFinite(orderId)) return orderId;
  if (typeof orderId === 'string' && orderId.trim()) return orderId.trim();

  const orderIds = obj.order_ids;
  if (Array.isArray(orderIds) && orderIds.length > 0) {
    const first = orderIds[0];
    if (typeof first === 'number' && Number.isFinite(first)) return first;
    if (typeof first === 'string' && first.trim()) return first.trim();
  }

  return null;
}

export default function GrouponVoucherScreen() {
  const router = useRouter();
  const [redeemStatus, setRedeemStatus] = useState<GrouponVoucherRedeemStatusResponse | null>(null);
  const purchaseData = useSelector((s: RootState) => s.grouponPurchase.purchase);
  const dealInfo = useSelector((s: RootState) => s.grouponPurchase.deal);
  const [checkRedeemStatus] = useLazyGetVoucherRedeemStatusQuery();
  const dispatch = useDispatch();

  const voucher = useMemo(() => {
    if (!purchaseData || typeof purchaseData !== 'object') return null;
    const v = (purchaseData as { vouchers?: unknown[] }).vouchers;
    return Array.isArray(v) && v.length > 0 ? (v[0] as Record<string, unknown>) : null;
  }, [purchaseData]);

  const voucherCode =
    voucher && typeof voucher.code === 'string' ? voucher.code : undefined;

  const qrUrl = useMemo(() => {
    if (!voucher) return FALLBACK_QR;
    const qr = voucher.qr_url || voucher.qr_text;
    if (typeof qr === 'string' && qr.length > 4) return qr;
    if (voucherCode) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(voucherCode)}`;
    }
    return FALLBACK_QR;
  }, [voucher, voucherCode]);

  const restaurantName = dealInfo?.restaurant_name || 'Restaurant';
  const restaurantLocation =
    (dealInfo?.restaurant_location || '').trim() || 'Address on voucher';
  const restaurantImage =
    dealInfo?.restaurant_image || dealInfo?.groupon_image || FALLBACK_RESTAURANT_IMAGE;

  const validityRaw =
    (voucher?.expires_at as string | undefined) || dealInfo?.valid_to || '';

  const paidOk = isPaidPayload(purchaseData);

  useEffect(() => {
    if (!purchaseData) return;
    console.log('[Groupon Voucher] purchase payload:', purchaseData);
  }, [purchaseData]);

  useEffect(() => {
    if (!voucherCode) return;
    let stopped = false;
    let authHtmlBlocked = false;
    const poll = async () => {
      if (authHtmlBlocked) return;
      try {
        const data = await checkRedeemStatus({ code: voucherCode }).unwrap();
        console.log('[Groupon Voucher] redeem-status response:', data);
        if (stopped) return;
        setRedeemStatus(data);
        if (data?.is_redeemed === true) {
          // Keep summary payload in purchase slice for the summary screen.
          dispatch(setGrouponPurchase({ purchase: data as Record<string, unknown>, deal: dealInfo }));
          router.replace('/groupon-order-summary' as never);
        }
      } catch (e) {
        console.log('[Groupon Voucher] redeem-status error:', e);
        // Backend returned admin login HTML instead of JSON.
        // Prevent noisy repeated logs every interval and guide backend fix.
        if (
          e &&
          typeof e === 'object' &&
          'status' in e &&
          (e as { status?: unknown }).status === 'PARSING_ERROR' &&
          'data' in e &&
          typeof (e as { data?: unknown }).data === 'string' &&
          (e as { data: string }).data.includes('Django administration')
        ) {
          authHtmlBlocked = true;
          console.warn(
            '[Groupon Voucher] redeem-status endpoint returned admin login HTML. ' +
              'Use app/public endpoint or provide authenticated API access.'
          );
        }
      }
    };
    void poll();
    const id = setInterval(() => {
      void poll();
    }, 4000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [voucherCode, checkRedeemStatus, router, dealInfo, dispatch]);

  if (!purchaseData || !dealInfo) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <Text style={styles.muted}>Voucher information not found. Complete a purchase first.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={22} color="#1F2933" />
        </Pressable>
        <Text style={styles.headerTitle}>Dine-in Voucher</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.dealTitle}>{dealInfo.name || 'Voucher'}</Text>
          {validityRaw ? (
            <Text style={styles.validSmall}>Valid until {new Date(validityRaw).toLocaleDateString()}</Text>
          ) : null}
          {!paidOk && paymentMethodSsl(purchaseData) ? (
            <Text style={styles.pendingHint}>Payment may still be processing. Pull to refresh from orders later.</Text>
          ) : null}
        </View>

        <View style={[styles.card, styles.centerCard]}>
          <Text style={styles.sectionHint}>VOUCHER CODE</Text>
          <Text style={styles.codeLarge}>{voucherCode || 'N/A'}</Text>
          <Image source={{ uri: qrUrl }} style={styles.qr} resizeMode="contain" />
          <Text style={styles.sectionHint}>Unique redemption code</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.restRow}>
            <Image
              source={{ uri: String(restaurantImage || FALLBACK_RESTAURANT_IMAGE) }}
              style={styles.restThumb}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.restName}>{restaurantName}</Text>
              <Text style={styles.restAddr} numberOfLines={3}>
                {restaurantLocation}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.instructionsTitle}>Instructions</Text>
          <Text style={styles.rulesText}>
            {(dealInfo.rules && dealInfo.rules.trim()) ||
              'Show this code at the restaurant. The invoice may be issued by the restaurant.'}
          </Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Paid</Text>
            <Text style={styles.totalVal}>
              {formatTk(
                Number((purchaseData as { paid_amount?: number }).paid_amount) ||
                  Number(dealInfo.sale_price) ||
                  0
              )}
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function paymentMethodSsl(purchase: unknown): boolean {
  if (!purchase || typeof purchase !== 'object') return false;
  return (purchase as { payment_method?: string }).payment_method === 'sslcommerz';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: PAGE_BG,
    gap: 12,
  },
  muted: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: Brand.yellow,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryBtnText: { fontWeight: '800', color: Brand.black },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Brand.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    elevation: 2,
  },
  dealTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  validSmall: { fontSize: 12, color: '#6B7280', marginTop: 6 },
  pendingHint: { fontSize: 12, color: Brand.orangePromo, marginTop: 8, fontWeight: '600' },
  centerCard: { alignItems: 'center' },
  sectionHint: {
    fontSize: 11,
    color: '#9CA3AF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  codeLarge: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginVertical: 12,
  },
  qr: { width: 160, height: 160, marginVertical: 8 },
  restRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  restThumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#F3F4F6' },
  restName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  restAddr: { fontSize: 12, color: '#6B7280', marginTop: 6, lineHeight: 18 },
  instructionsTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },
  rulesText: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F3F4F6',
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  totalVal: { fontSize: 14, fontWeight: '800', color: '#111827' },
});
