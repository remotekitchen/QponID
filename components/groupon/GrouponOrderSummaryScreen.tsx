import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { Brand } from '@/constants/Colors';
import { useSubmitGrouponStoreReviewMutation } from '@/store/grouponApi';
import type { RootState } from '@/store';

function readStr(obj: Record<string, unknown> | null, key: string, fallback = '—'): string {
  if (!obj) return fallback;
  const v = obj[key];
  return typeof v === 'string' && v.trim() ? v : fallback;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function extractApiErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const errObj = error as Record<string, unknown>;
  const data = errObj.data;
  if (!data || typeof data !== 'object') return null;
  const dataObj = data as Record<string, unknown>;
  if (typeof dataObj.detail === 'string' && dataObj.detail.trim()) return dataObj.detail.trim();
  if (typeof dataObj.message === 'string' && dataObj.message.trim()) return dataObj.message.trim();
  const firstKey = Object.keys(dataObj)[0];
  const firstVal = firstKey ? dataObj[firstKey] : null;
  if (typeof firstVal === 'string' && firstVal.trim()) return firstVal.trim();
  if (Array.isArray(firstVal) && typeof firstVal[0] === 'string') return String(firstVal[0]).trim();
  return null;
}

export default function GrouponOrderSummaryScreen() {
  const router = useRouter();
  const purchaseData = useSelector((s: RootState) => s.grouponPurchase.purchase) as Record<string, unknown> | null;
  const dealInfo = useSelector((s: RootState) => s.grouponPurchase.deal);
  const [submitReview, { isLoading: isSubmittingReview }] = useSubmitGrouponStoreReviewMutation();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  const voucher = useMemo(
    () => (purchaseData && typeof purchaseData.voucher === 'object' ? (purchaseData.voucher as Record<string, unknown>) : null),
    [purchaseData]
  );
  const redemption = useMemo(
    () =>
      purchaseData && typeof purchaseData.redemption === 'object'
        ? (purchaseData.redemption as Record<string, unknown>)
        : null,
    [purchaseData]
  );

  const isRedeemed = Boolean(purchaseData && purchaseData.is_redeemed === true);
  const orderIdRaw = purchaseData?.order_id;
  const orderId =
    typeof orderIdRaw === 'number'
      ? orderIdRaw
      : typeof orderIdRaw === 'string' && orderIdRaw.trim()
        ? orderIdRaw.trim()
        : null;

  const handleSubmitReview = async () => {
    setReviewError(null);
    setReviewSuccess(null);
    if (!orderId) {
      setReviewError('Order ID is unavailable for this voucher. Review submit is disabled.');
      return;
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      setReviewError('Please select a rating between 1 and 5.');
      return;
    }
    try {
      await submitReview({
        order_id: orderId,
        rating,
        comment: comment.trim() || undefined,
      }).unwrap();
      setReviewSuccess('Thank you! Your review was submitted.');
      setComment('');
    } catch (e) {
      console.log('[Groupon Order Summary] submit review error:', e);
      const message = extractApiErrorMessage(e);
      setReviewError(message || 'Could not submit review. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/groupon-voucher')}>
          <MaterialCommunityIcons name="chevron-left" size={22} color="#1F2933" />
        </Pressable>
        <Text style={styles.headerTitle}>Order Summary</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <MaterialCommunityIcons
            name={isRedeemed ? 'check-circle' : 'clock-outline'}
            size={36}
            color={isRedeemed ? '#16A34A' : '#F59E0B'}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>
              {isRedeemed ? 'Deal redeemed successfully' : 'Waiting for redemption'}
            </Text>
            <Text style={styles.statusSub}>
              {isRedeemed ? 'Your voucher has been used at the store.' : 'Show QR code at the store to redeem.'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Information</Text>
          <Row label="Order ID" value={String(purchaseData?.order_id ?? '—')} />
          <Row label="Order Method" value={String(purchaseData?.order_method ?? 'groupon')} />
          <Row label="Restaurant" value={dealInfo?.restaurant_name || '—'} />
          <Row label="Deal" value={readStr(voucher, 'title', dealInfo?.name || '—')} />
          <Row label="Voucher Code" value={readStr(voucher, 'code')} />
          <Row label="Status" value={readStr(voucher, 'status', isRedeemed ? 'redeemed' : 'pending')} />
          <Row label="Redeemed At" value={readStr(redemption, 'redeemed_at') !== '—' ? formatDate(readStr(redemption, 'redeemed_at')) : '—'} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Summary</Text>
          <Row label="Original Price" value={readStr(voucher, 'original_price')} />
          <Row label="Deal Discount" value={readStr(voucher, 'deal_discount')} />
          <Row label="Sale Price" value={readStr(voucher, 'sale_price')} />
          <Row label="Payment Method" value={readStr(voucher, 'payment_method')} />
          <Row label="Bill Total" value={readStr(redemption, 'bill_total')} />
          <Row label="Covered Amount" value={readStr(redemption, 'covered_amount')} />
          <Row label="Customer Due" value={readStr(redemption, 'customer_due')} />
          <Row label="Total" value={String(purchaseData?.total ?? '—')} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rate your experience</Text>
          <Text style={styles.helperText}>Share your feedback to help improve deal quality.</Text>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable key={value} onPress={() => setRating(value)} style={styles.starBtn} hitSlop={8}>
                <MaterialCommunityIcons
                  name={value <= rating ? 'star' : 'star-outline'}
                  size={24}
                  color={value <= rating ? '#F59E0B' : '#9CA3AF'}
                />
              </Pressable>
            ))}
            <Text style={styles.ratingValue}>{rating}.0</Text>
          </View>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Write a short comment (optional)"
            placeholderTextColor="#9CA3AF"
            multiline
            style={styles.commentInput}
          />
          {!orderId ? <Text style={styles.warnText}>Order ID unavailable for review submit.</Text> : null}
          {reviewError ? <Text style={styles.errorText}>{reviewError}</Text> : null}
          {reviewSuccess ? <Text style={styles.successText}>{reviewSuccess}</Text> : null}
          <Pressable
            onPress={handleSubmitReview}
            disabled={isSubmittingReview || !isRedeemed}
            style={[
              styles.submitBtn,
              (isSubmittingReview || !isRedeemed) && styles.submitBtnDisabled,
            ]}>
            {isSubmittingReview ? (
              <ActivityIndicator color={Brand.black} />
            ) : (
              <Text style={styles.submitBtnText}>{isRedeemed ? 'Submit Review' : 'Redeem first to review'}</Text>
            )}
          </Pressable>
        </View>

        <Pressable style={styles.homeBtn} onPress={() => router.replace('/')}>
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F6F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Brand.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  statusCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  statusTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  statusSub: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  card: { backgroundColor: Brand.white, borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 10 },
  helperText: { fontSize: 12, color: '#4B5563', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECECEC',
  },
  rowLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  rowVal: { fontSize: 12, color: '#111827', fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  starBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  ratingValue: { marginLeft: 8, fontSize: 13, fontWeight: '700', color: '#374151' },
  commentInput: {
    marginTop: 12,
    minHeight: 86,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    color: '#111827',
    fontSize: 13,
  },
  warnText: { marginTop: 8, fontSize: 12, color: '#92400E' },
  errorText: { marginTop: 8, fontSize: 12, color: '#B91C1C' },
  successText: { marginTop: 8, fontSize: 12, color: '#047857' },
  submitBtn: {
    marginTop: 12,
    backgroundColor: Brand.yellow,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.75 },
  submitBtnText: { fontWeight: '800', color: Brand.black },
  homeBtn: {
    marginTop: 4,
    backgroundColor: Brand.yellow,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  homeBtnText: { fontWeight: '800', color: Brand.black, fontSize: 14 },
});

