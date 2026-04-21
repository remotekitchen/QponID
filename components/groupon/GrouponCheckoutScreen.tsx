import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useDispatch } from 'react-redux';

import { Brand } from '@/constants/Colors';
import { DEFAULT_MAP_CENTER } from '@/constants/mapDefaults';
import { useLocationPicker } from '@/contexts/LocationContext';
import { buildGrouponFunnelPayload } from '@/lib/grouponTracking';
import { useTrackGrouponFunnelMutation } from '@/store/grouponFunnelApi';
import { setGrouponPurchase } from '@/store/grouponPurchaseSlice';
import type { GrouponDealDetail } from '@/store/grouponApi';
import {
  buildGrouponDetailFromListCache,
  useGetGrouponDetailsQuery,
  useGetRestaurantsWithDealsQuery,
  useLazyCheckGrouponPaymentStatusQuery,
  usePurchaseGrouponMutation,
} from '@/store/grouponApi';

/**
 * Checkout data (aligned with remotekitchen `GrouponCheckoutScreen.jsx`):
 * - Primary: GET api/groupon/v1/deals/:dealId → `deal`
 * - Restaurant row: deal.restaurant_name, restaurant_location, restaurant_image, distance_km / restaurant_distance
 * - Line items: built from deal.categories[].items (name, price, qty); if empty → fallback banner
 * - Pricing: computed from original_price, sale_price, sslcommerz_sale_price + local service fee when sslcommerz
 * - Order ID UI: route param `deal`; timestamp: client Date (not API)
 */

const H_PAD = 16;
const PAGE_BG = '#F6F6F6';
const FALLBACK_ITEM_IMAGE =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';
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

function distanceDisplayFromDeal(deal: GrouponDealDetail) {
  const ext = deal as GrouponDealDetail & {
    restaurant_distance?: number | null;
    distance?: number | string | null;
  };
  const raw =
    ext.restaurant_distance ??
    deal.distance_km ??
    ext.distance ??
    null;
  if (raw === null || raw === undefined || raw === '') return '368m away from you';

  const numeric = Number(raw);
  if (Number.isNaN(numeric)) return String(raw);

  if (numeric >= 1) return `${numeric.toFixed(1)} km away from you`;
  return `${Math.round(numeric * 1000)}m away from you`;
}

function isPaymentStatusPaid(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const vouchers = (data as { vouchers?: Array<{ is_paid?: boolean }> }).vouchers;
  return Array.isArray(vouchers) && vouchers.some((v) => v?.is_paid === true);
}

function PaymentOptionRow({
  icon,
  label,
  subLabel,
  selected,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  subLabel: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.paymentRow} onPress={onPress}>
      <View style={styles.paymentLeft}>
        <View style={[styles.paymentIconBg, selected && styles.paymentIconBgOn]}>{icon}</View>
        <View style={styles.paymentTextCol}>
          <Text style={styles.paymentLabel}>{label}</Text>
          <Text style={styles.paymentSub}>{subLabel}</Text>
        </View>
      </View>
      <View style={[styles.radioOuter, selected && styles.radioOuterOn]} accessibilityRole="radio" accessibilityState={{ selected }}>
        {selected ? (
          <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
        ) : null}
      </View>
    </Pressable>
  );
}

export default function GrouponCheckoutScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [trackGrouponFunnel] = useTrackGrouponFunnelMutation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ deal?: string | string[] }>();
  const rawDeal = params.deal;
  const dealParam = rawDeal ? String(Array.isArray(rawDeal) ? rawDeal[0] : rawDeal) : '';

  const [paymentMethod, setPaymentMethod] = useState<'sslcommerz' | 'cash'>('sslcommerz');
  const [orderQty, setOrderQty] = useState(1);

  const [gatewaySession, setGatewaySession] = useState<{
    gatewayUrl: string;
    transactionId: string;
    sessionKey?: string;
  } | null>(null);
  const [isGatewayModalVisible, setIsGatewayModalVisible] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<Record<string, unknown> | null>(null);

  const paymentPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingPurchaseRef = useRef<Record<string, unknown> | null>(null);

  const { savedLocation, locationReady } = useLocationPicker();
  const lat = savedLocation?.latitude ?? DEFAULT_MAP_CENTER.latitude;
  const lon = savedLocation?.longitude ?? DEFAULT_MAP_CENTER.longitude;

  const dealIdNum = Number(dealParam);
  const validDealId = Boolean(dealParam) && Number.isFinite(dealIdNum) && dealIdNum > 0;

  const detailQuery = useGetGrouponDetailsQuery({ dealId: dealParam }, { skip: !validDealId });
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

  const categories = deal?.categories ?? [];

  const orderItems = useMemo(() => {
    if (!deal) return [];
    return categories.flatMap((category) =>
      (category.items ?? []).map((item, index) => ({
        id: `${category.category_name || 'c'}-${item.itemId ?? index}`,
        name: item.name || 'Deal item',
        price: Number(item.price) || 0,
        quantity: item.qty || 1,
        image: item.image && item.image.length > 4 ? item.image : FALLBACK_ITEM_IMAGE,
      }))
    );
  }, [deal, categories]);

  const pricing = useMemo(() => {
    const originalPrice = Number(deal?.original_price) || 0;
    const salePrice = Number(deal?.sale_price) || 0;
    const discountAmount = Math.max(originalPrice - salePrice, 0);
    const discountPercent = originalPrice ? Math.round((discountAmount / originalPrice) * 100) : 0;
    return {
      originalPrice,
      salePrice,
      discountAmount,
      discountPercent,
      packingFee: 0,
    };
  }, [deal]);

  /** Per-unit max from detail API; fall back to 99 when unset / 0 (treated as unlimited) */
  const maxQtyAllowed = useMemo(() => {
    const m = deal?.max_qty_per_purchase;
    if (m == null || m === undefined || m <= 0) return 99;
    return Math.min(99, Math.max(1, m));
  }, [deal?.max_qty_per_purchase]);

  useEffect(() => {
    setOrderQty((q) => Math.min(Math.max(1, q), maxQtyAllowed));
  }, [deal?.id, maxQtyAllowed]);

  /** Line totals scale with voucher quantity */
  const scaled = useMemo(() => {
    const q = orderQty;
    const totalOriginal = pricing.originalPrice * q;
    const totalDiscount = pricing.discountAmount * q;
    const saleSubtotal = pricing.salePrice * q;
    const sslFeeSingleBase = pricing.salePrice * 0.025;
    const sslServiceTotal = paymentMethod === 'sslcommerz' ? sslFeeSingleBase * q : 0;
    const sslUnitPrice = Number(deal?.sslcommerz_sale_price);

    let finalPay = saleSubtotal;
    if (paymentMethod === 'cash') {
      finalPay = saleSubtotal;
    } else if (!Number.isNaN(sslUnitPrice) && sslUnitPrice > 0) {
      finalPay = sslUnitPrice * q;
    } else {
      finalPay = saleSubtotal + sslServiceTotal;
    }

    return {
      totalOriginal,
      totalDiscount,
      packingTotal: pricing.packingFee * q,
      sslServiceTotal,
      finalPay,
    };
  }, [
    orderQty,
    pricing.originalPrice,
    pricing.discountAmount,
    pricing.salePrice,
    pricing.packingFee,
    paymentMethod,
    deal?.sslcommerz_sale_price,
  ]);

  const restaurantName = deal?.restaurant_name ?? 'Restaurant';
  const restaurantLocation =
    (deal?.restaurant_location || '').trim() ||
    deal?.locations?.[0]?.details?.trim() ||
    deal?.locations?.[0]?.name?.trim() ||
    '';
  const restaurantImage = deal?.restaurant_image || FALLBACK_RESTAURANT_IMAGE;
  const distanceLine = deal ? distanceDisplayFromDeal(deal) : '';

  const stillLoading =
    validDealId &&
    !merged &&
    (detailQuery.isLoading ||
      detailQuery.isFetching ||
      listQuery.isLoading ||
      listQuery.isFetching);

  const loadFailed =
    validDealId &&
    !merged &&
    !detailQuery.isLoading &&
    !detailQuery.isFetching &&
    !listQuery.isLoading &&
    !listQuery.isFetching;

  const [purchaseGroupon, { isLoading: isPurchasing }] = usePurchaseGrouponMutation();
  const [checkPaymentStatus] = useLazyCheckGrouponPaymentStatusQuery();

  const trackOrderPlaced = useCallback(
    (paymentMethodForEvent: 'sslcommerz' | 'cash', orderId?: string) => {
      if (!deal) return;
      const numericOrderId =
        typeof orderId === 'string' && Number.isFinite(Number(orderId))
          ? Number(orderId)
          : undefined;
      void buildGrouponFunnelPayload({
        step: 'place_order',
        restaurantId: deal.restaurant,
        dealId: Number(deal.id ?? dealParam),
        orderId: numericOrderId,
        meta: {
          payment_method: paymentMethodForEvent,
          source: 'groupon_checkout_complete_payment',
        },
      })
        .then((payload) => trackGrouponFunnel(payload).unwrap())
        .catch(() => {
          // Silent fail: tracking should not interrupt checkout completion.
        });
    },
    [deal, dealParam, trackGrouponFunnel]
  );

  useEffect(() => {
    pendingPurchaseRef.current = pendingPurchase;
  }, [pendingPurchase]);

  const cleanupGatewayFlow = useCallback(() => {
    if (paymentPollIntervalRef.current) {
      clearInterval(paymentPollIntervalRef.current);
      paymentPollIntervalRef.current = null;
    }
    setIsGatewayModalVisible(false);
    setGatewaySession(null);
    setPendingPurchase(null);
  }, []);

  const navigateToVoucher = useCallback(
    (purchasePayload: Record<string, unknown> | null) => {
      if (!purchasePayload || !deal) return;
      dispatch(setGrouponPurchase({ purchase: purchasePayload, deal }));
      router.replace('/groupon-voucher');
      cleanupGatewayFlow();
    },
    [deal, dispatch, router, cleanupGatewayFlow]
  );

  const pollPaymentStatus = useCallback(
    async (transactionId: string) => {
      if (!transactionId) return;
      try {
        const latestStatus = await checkPaymentStatus({
          dealId: dealParam,
          transactionId,
        }).unwrap();

        if (isPaymentStatusPaid(latestStatus)) {
          const latest = latestStatus as Record<string, unknown>;
          const orderId =
            typeof latest.id === 'string'
              ? latest.id
              : typeof latest.transaction_id === 'string'
                ? latest.transaction_id
                : transactionId;
          trackOrderPlaced('sslcommerz', orderId);
          const payload =
            latestStatus && typeof latestStatus === 'object'
              ? (latestStatus as Record<string, unknown>)
              : pendingPurchaseRef.current;
          if (payload) navigateToVoucher(payload);
        }
      } catch {
        /* transient poll errors */
      }
    },
    [checkPaymentStatus, cleanupGatewayFlow, dealParam, navigateToVoucher]
  );

  useEffect(() => {
    if (!gatewaySession?.transactionId || !isGatewayModalVisible) return;

    void pollPaymentStatus(gatewaySession.transactionId);
    paymentPollIntervalRef.current = setInterval(() => {
      void pollPaymentStatus(gatewaySession.transactionId);
    }, 5000);

    return () => {
      if (paymentPollIntervalRef.current) {
        clearInterval(paymentPollIntervalRef.current);
        paymentPollIntervalRef.current = null;
      }
    };
  }, [gatewaySession?.transactionId, isGatewayModalVisible, pollPaymentStatus]);

  useEffect(() => {
    return () => {
      if (paymentPollIntervalRef.current) {
        clearInterval(paymentPollIntervalRef.current);
      }
    };
  }, []);

  const handleGatewayDismiss = useCallback(() => {
    Alert.alert(
      'Cancel online payment?',
      'Closing will cancel the online payment session. You can choose Pay by Cash or try again.',
      [
        { text: 'Continue payment', style: 'cancel' },
        { text: 'Cancel payment', style: 'destructive', onPress: cleanupGatewayFlow },
      ]
    );
  }, [cleanupGatewayFlow]);

  const handleGatewayNavigation = useCallback(
    (navState: { url?: string }) => {
      const url = navState?.url?.toLowerCase() ?? '';
      const tid = gatewaySession?.transactionId;
      if (!tid) return;

      if (url.includes('/sslcommerz/success')) {
        navigateToVoucher(pendingPurchaseRef.current);
        return;
      }

      if (url.includes('success') || url.includes('complete') || url.includes('approved')) {
        void pollPaymentStatus(tid);
      }

      if (url.includes('failed') || url.includes('cancel')) {
        Alert.alert(
          'Payment not completed',
          'The payment was cancelled. You can retry or switch to Pay by Cash.',
          [{ text: 'OK', onPress: cleanupGatewayFlow }]
        );
      }
    },
    [gatewaySession?.transactionId, cleanupGatewayFlow, navigateToVoucher, pollPaymentStatus]
  );

  const handleCompletePayment = async () => {
    if (!deal || !dealParam) return;
    try {
      const response = await purchaseGroupon({
        dealId: dealParam,
        qty: orderQty,
        payment_method: paymentMethod,
      }).unwrap();

      const record = response as Record<string, unknown>;
      const gatewayUrl = typeof record.gateway_url === 'string' ? record.gateway_url : '';
      const resolvedMethod =
        typeof record.payment_method === 'string' ? record.payment_method : paymentMethod;
      const transactionId =
        typeof record.transaction_id === 'string' ? record.transaction_id : '';

      const requiresGateway =
        resolvedMethod === 'sslcommerz' && gatewayUrl.length > 4 && transactionId.length > 0;

      if (requiresGateway) {
        setPendingPurchase(record);
        setGatewaySession({
          gatewayUrl,
          transactionId,
          sessionKey: typeof record.session_key === 'string' ? record.session_key : undefined,
        });
        setIsGatewayModalVisible(true);
        return;
      }

      const orderId =
        typeof record.id === 'string'
          ? record.id
          : typeof record.transaction_id === 'string'
            ? record.transaction_id
            : undefined;
      trackOrderPlaced(resolvedMethod === 'sslcommerz' ? 'sslcommerz' : 'cash', orderId);
      navigateToVoucher(record);
    } catch (e: unknown) {
      const detail =
        e &&
        typeof e === 'object' &&
        'data' in e &&
        (e as { data?: { detail?: string } }).data?.detail;
      Alert.alert(
        'Payment failed',
        typeof detail === 'string' ? detail : 'Please try again.'
      );
    }
  };

  if (!validDealId) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <Text style={styles.errorTitle}>No deal selected.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (stillLoading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <ActivityIndicator size="large" color="#FF7A00" />
        <Text style={styles.hint}>Loading checkout…</Text>
      </SafeAreaView>
    );
  }

  if (loadFailed || !deal) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <Text style={styles.errorTitle}>Unable to load checkout details</Text>
        <Text style={styles.errorSub}>Please try again from the deals page.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const orderStamp = new Date().toLocaleString();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
            <MaterialCommunityIcons name="chevron-left" size={22} color="#1F2933" />
          </Pressable>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 22 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollInner, { paddingBottom: 140 + insets.bottom }]}>
          {/* Order summary card */}
          <View style={styles.card}>
            <View style={styles.restaurantRow}>
              <View style={styles.restaurantTextCol}>
                <Text style={styles.restaurantName}>{restaurantName}</Text>
                {restaurantLocation ? (
                  <Text style={styles.restaurantAddr}>{restaurantLocation}</Text>
                ) : null}
                <View style={styles.distRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.distText}>{distanceLine}</Text>
                </View>
              </View>
              <Image source={{ uri: restaurantImage }} style={styles.restLogo} />
            </View>

            <View style={styles.rule} />

            <View style={styles.orderMetaRow}>
              <Text style={styles.metaMuted}>Order ID {dealParam}</Text>
              <Text style={styles.metaMuted}>{orderStamp}</Text>
            </View>

            <View style={styles.itemsBlock}>
              {orderItems.length > 0 ? (
                orderItems.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.itemMain}>
                      <View style={styles.itemTitleRow}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={styles.itemPrice}>{formatTk(item.price)}</Text>
                      </View>
                      <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.fallbackBanner}>
                  <Text style={styles.fallbackBannerText}>
                    Item details for this deal are unavailable. You will receive the bundle included in
                    the offer.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.rule} />

            <View style={styles.qtySection}>
              <Text style={styles.qtyLabel}>Quantity</Text>
              <View style={styles.qtyControls}>
                <Pressable
                  style={[styles.qtyBtn, orderQty <= 1 && styles.qtyBtnDisabled]}
                  onPress={() => setOrderQty((q) => Math.max(1, q - 1))}
                  disabled={orderQty <= 1}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease quantity">
                  <MaterialCommunityIcons name="minus" size={20} color={orderQty <= 1 ? '#CCC' : '#374151'} />
                </Pressable>
                <Text style={styles.qtyNum}>{orderQty}</Text>
                <Pressable
                  style={[styles.qtyBtn, orderQty >= maxQtyAllowed && styles.qtyBtnDisabled]}
                  onPress={() => setOrderQty((q) => Math.min(maxQtyAllowed, q + 1))}
                  disabled={orderQty >= maxQtyAllowed}
                  accessibilityRole="button"
                  accessibilityLabel="Increase quantity">
                  <MaterialCommunityIcons
                    name="plus"
                    size={20}
                    color={orderQty >= maxQtyAllowed ? '#CCC' : '#374151'}
                  />
                </Pressable>
              </View>
            </View>
            {maxQtyAllowed < 99 ? (
              <Text style={styles.qtyLimit}>Limit {maxQtyAllowed} per purchase</Text>
            ) : null}

            <View style={styles.rule} />

            <View style={styles.breakdown}>
              <View style={styles.breakRow}>
                <Text style={styles.breakLabel}>Total Price</Text>
                <Text style={styles.breakVal}>{formatTk(scaled.totalOriginal)}</Text>
              </View>
              <View style={styles.breakRow}>
                <Text style={styles.breakLabel}>Discounts Applied</Text>
                <Text style={styles.breakDiscount}>-{formatTk(scaled.totalDiscount)}</Text>
              </View>
              {paymentMethod === 'sslcommerz' ? (
                <View style={styles.breakRow}>
                  <Text style={styles.breakLabel}>Service Fee</Text>
                  <Text style={styles.breakVal}>{formatTk(scaled.sslServiceTotal)}</Text>
                </View>
              ) : null}
              <View style={styles.breakRow}>
                <Text style={styles.breakLabel}>Packing Fee</Text>
                <Text style={styles.breakVal}>{formatTk(scaled.packingTotal)}</Text>
              </View>
            </View>

            <View style={styles.rule} />

            <View style={styles.finalPayRow}>
              <View>
                <Text style={styles.finalPayHint}>Final payment amount</Text>
                <Text style={styles.finalPayAmt}>{formatTk(scaled.finalPay)}</Text>
              </View>
              {pricing.discountPercent > 0 ? (
                <Text style={styles.savingPct}>You're saving {pricing.discountPercent}%</Text>
              ) : null}
            </View>
          </View>

          {/* Payment method — switching to Cash hides Service Fee row above */}
          <View style={[styles.card, styles.cardGap]}>
            <Text style={styles.cardSectionTitle}>Payment method</Text>
            <PaymentOptionRow
              icon={<MaterialCommunityIcons name="cellphone-check" size={22} color="#E2136E" />}
              label="bKash"
              subLabel="Pay with mobile wallet"
              selected={paymentMethod === 'sslcommerz'}
              onPress={() => setPaymentMethod('sslcommerz')}
            />
            <PaymentOptionRow
              icon={<MaterialCommunityIcons name="cash-multiple" size={22} color="#0F9D58" />}
              label="Pay by Cash"
              subLabel="Pay at pickup"
              selected={paymentMethod === 'cash'}
              onPress={() => setPaymentMethod('cash')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={[styles.completeBtn, isPurchasing && styles.completeBtnDisabled]}
          onPress={handleCompletePayment}
          disabled={isPurchasing}>
          <Text style={styles.completeBtnText}>
            {isPurchasing
              ? 'Finalizing your order…'
              : `Complete Payment ${formatTk(scaled.finalPay)}`}
          </Text>
        </Pressable>
      </View>

      {gatewaySession ? (
        <Modal
          visible={isGatewayModalVisible}
          animationType="slide"
          transparent
          hardwareAccelerated
          statusBarTranslucent
          onRequestClose={handleGatewayDismiss}>
          <View style={[styles.gatewayOverlay, { paddingTop: Platform.OS === 'android' ? 28 : 44 }]}>
            <View style={styles.gatewaySheet}>
              <View style={styles.gatewayHeader}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.gatewayTitle}>Complete bKash payment</Text>
                  <Text style={styles.gatewaySub}>Keep this screen open until payment finishes.</Text>
                </View>
                <Pressable
                  style={styles.gatewayCloseBtn}
                  onPress={handleGatewayDismiss}
                  accessibilityRole="button">
                  <MaterialCommunityIcons name="close" size={18} color="#DB2777" />
                </Pressable>
              </View>
              {gatewaySession.gatewayUrl ? (
                <WebView
                  source={{ uri: gatewaySession.gatewayUrl }}
                  onNavigationStateChange={handleGatewayNavigation}
                  startInLoadingState
                  style={styles.gatewayWebView}
                />
              ) : (
                <View style={styles.gatewayLoading}>
                  <ActivityIndicator size="large" color="#FF7A00" />
                  <Text style={styles.gatewayLoadingText}>Preparing secure payment…</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  flex: { flex: 1 },
  safeTop: { backgroundColor: Brand.white },
  headerBar: {
    paddingHorizontal: H_PAD,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
    backgroundColor: Brand.white,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  scrollInner: {
    padding: H_PAD,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardGap: { marginTop: 12 },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  restaurantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  restaurantTextCol: { flex: 1, minWidth: 0 },
  restaurantName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  restaurantAddr: { fontSize: 12, color: '#6B7280', marginTop: 4, lineHeight: 17 },
  distRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  distText: { fontSize: 12, color: '#6B7280' },
  restLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F3F4F6',
    marginVertical: 16,
  },
  orderMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  metaMuted: { fontSize: 11, color: '#9CA3AF', flex: 1 },
  itemsBlock: { marginTop: 16, gap: 12 },
  itemRow: {},
  itemMain: { gap: 4 },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  itemQty: { fontSize: 11, color: '#9CA3AF' },
  qtySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  qtyBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.white,
  },
  qtyBtnDisabled: {
    backgroundColor: '#F3F4F6',
  },
  qtyNum: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    paddingHorizontal: 8,
  },
  qtyLimit: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'right',
  },
  fallbackBanner: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 12,
  },
  fallbackBannerText: { fontSize: 12, color: '#EA580C', lineHeight: 17 },
  breakdown: { gap: 10 },
  breakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakLabel: { fontSize: 12, color: '#6B7280' },
  breakVal: { fontSize: 12, fontWeight: '700', color: '#111827' },
  breakDiscount: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  finalPayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  finalPayHint: { fontSize: 11, color: '#6B7280' },
  finalPayAmt: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 4 },
  savingPct: { fontSize: 12, fontWeight: '700', color: Brand.orangePromo },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  paymentTextCol: { flex: 1, minWidth: 0 },
  paymentIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  paymentIconBgOn: {
    backgroundColor: '#FBCFE8',
  },
  paymentLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  paymentSub: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.white,
  },
  radioOuterOn: {
    borderColor: Brand.orangePromo,
    backgroundColor: Brand.orangePromo,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    backgroundColor: PAGE_BG,
  },
  completeBtn: {
    backgroundColor: Brand.yellow,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnDisabled: { opacity: 0.75 },
  completeBtnText: { fontSize: 16, fontWeight: '700', color: Brand.black },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
    backgroundColor: PAGE_BG,
  },
  hint: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center' },
  errorSub: { fontSize: 12, color: '#6B7280', textAlign: 'center', paddingHorizontal: 24 },
  backBtn: {
    backgroundColor: Brand.yellow,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 12,
  },
  backBtnText: { fontWeight: '800', color: Brand.black },
  gatewayOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  gatewaySheet: { flex: 1, backgroundColor: Brand.white },
  gatewayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  gatewayTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  gatewaySub: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  gatewayCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatewayWebView: { flex: 1, backgroundColor: Brand.white },
  gatewayLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gatewayLoadingText: { fontSize: 12, color: '#6B7280', marginTop: 8 },
});
