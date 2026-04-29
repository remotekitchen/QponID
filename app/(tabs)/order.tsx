import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { Brand } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useGetMyOrdersQuery, type GrouponOrderHistoryItem } from '@/store/grouponApi';

type FilterType = 'all' | 'usable' | 'to_be_paid';

export default function OrderScreen() {
  const { user, openLogin } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedOrder, setSelectedOrder] = useState<GrouponOrderHistoryItem | null>(null);
  const {
    data: orders = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetMyOrdersQuery(undefined, {
    skip: !user?.token,
  });

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'usable') {
      return orders.filter((o) => o.status === 'completed' && o.is_paid);
    }
    if (activeFilter === 'to_be_paid') {
      return orders.filter((o) => !o.is_paid);
    }
    return orders;
  }, [orders, activeFilter]);

  if (!user?.token) {
    return (
      <View style={styles.container}>
        <Text style={styles.screenTitle}>Order</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Login Required</Text>
          <Text style={styles.emptySubtitle}>Please log in to view your order history.</Text>
          <Pressable style={styles.primaryBtn} onPress={openLogin}>
            <Text style={styles.primaryBtnText}>Login</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Order</Text>
      <View style={styles.chips}>
        <Pressable
          style={[styles.chip, activeFilter === 'all' && styles.chipActive]}
          onPress={() => setActiveFilter('all')}>
          <Text style={activeFilter === 'all' ? styles.chipTextActive : styles.chipText}>All</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, activeFilter === 'usable' && styles.chipActive]}
          onPress={() => setActiveFilter('usable')}>
          <Text style={activeFilter === 'usable' ? styles.chipTextActive : styles.chipText}>Usable</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, activeFilter === 'to_be_paid' && styles.chipActive]}
          onPress={() => setActiveFilter('to_be_paid')}>
          <Text style={activeFilter === 'to_be_paid' ? styles.chipTextActive : styles.chipText}>To Be Paid</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={Brand.yellow} />
          <Text style={styles.emptySubtitle}>Loading your order history...</Text>
        </View>
      ) : isError ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Could not load orders</Text>
          <Text style={styles.emptySubtitle}>Please try again.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => refetch()}>
            <Text style={styles.primaryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Orders Yet</Text>
          <Text style={styles.emptySubtitle}>There are currently no orders available.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {isFetching ? <Text style={styles.syncText}>Refreshing...</Text> : null}
          {filteredOrders.map((order) => (
            <OrderCard key={order.order_id} order={order} onPress={() => setSelectedOrder(order)} />
          ))}
        </ScrollView>
      )}
      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </View>
  );
}

function OrderCard({
  order,
  onPress,
}: {
  order: GrouponOrderHistoryItem;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.orderCard} onPress={onPress}>
      <View style={styles.orderHead}>
        <Text style={styles.orderTitle} numberOfLines={1}>
          {order.deal?.title || 'Deal'}
        </Text>
        <Text style={styles.orderStatus}>{order.status_display || order.status}</Text>
      </View>
      <Text style={styles.orderMeta}>Order ID: {order.order_id}</Text>
      <Text style={styles.orderMeta}>Date: {formatDate(order.created_at)}</Text>
      <Text style={styles.orderMeta}>Payment: {order.is_paid ? 'Paid' : 'To Be Paid'}</Text>
      <Text style={styles.orderPrice}>Total: {formatCurrency(order.pricing?.sale_price ?? '0')}</Text>
    </Pressable>
  );
}

function OrderDetailModal({
  order,
  onClose,
}: {
  order: GrouponOrderHistoryItem | null;
  onClose: () => void;
}) {
  const restaurantName = getRestaurantName(order);

  return (
    <Modal visible={Boolean(order)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Order Details</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.modalClose}>Close</Text>
            </Pressable>
          </View>

          {order ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalMeta}>Restaurant: {restaurantName}</Text>
              <Text style={styles.modalMeta}>Deal: {order.deal?.title || 'Deal'}</Text>
              <Text style={styles.modalMeta}>Order ID: {order.order_id}</Text>
              <Text style={styles.modalMeta}>Date: {formatDate(order.created_at)}</Text>

              <Text style={styles.modalSectionTitle}>Items</Text>
              {order.items?.length ? (
                order.items
                  .filter((item) => !item.is_canceled)
                  .map((item) => (
                    <View key={item.id} style={styles.modalItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalItemName}>{item.name}</Text>
                        <Text style={styles.modalItemSub}>Qty: {item.quantity}</Text>
                      </View>
                      <Text style={styles.modalItemPrice}>{formatCurrency(item.unit_price)}</Text>
                    </View>
                  ))
              ) : (
                <Text style={styles.modalItemSub}>No items found.</Text>
              )}

              <Text style={styles.modalSectionTitle}>Pricing</Text>
              <Text style={styles.modalMeta}>Original: {formatCurrency(order.pricing.original_price)}</Text>
              <Text style={styles.modalMeta}>
                Discount: {formatCurrency(order.pricing.total_discount_amount)}
              </Text>
              <Text style={styles.modalTotal}>Total: {formatCurrency(order.pricing.sale_price)}</Text>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function getRestaurantName(order: GrouponOrderHistoryItem | null): string {
  if (!order) return '-';
  const fromOrder = order as unknown as { restaurant_name?: string; restaurant?: { name?: string } };
  if (typeof fromOrder.restaurant_name === 'string' && fromOrder.restaurant_name.trim()) {
    return fromOrder.restaurant_name.trim();
  }
  if (typeof fromOrder.restaurant?.name === 'string' && fromOrder.restaurant.name.trim()) {
    return fromOrder.restaurant.name.trim();
  }
  return 'Restaurant name unavailable';
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatCurrency(value: string | number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return `Tk ${value}`;
  return `Tk ${n.toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 14,
  },
  chips: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chipActive: {
    backgroundColor: Brand.greyLight,
    borderColor: Brand.greyLight,
  },
  chipText: {
    fontSize: 14,
    color: Brand.black,
  },
  chipTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.black,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Brand.grey,
    marginTop: 6,
    marginBottom: 18,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 22,
    gap: 10,
  },
  syncText: {
    fontSize: 12,
    color: Brand.grey,
    marginBottom: 6,
  },
  orderCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  orderHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  orderTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: Brand.black,
  },
  orderStatus: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  orderMeta: {
    fontSize: 12,
    color: '#616161',
    marginBottom: 4,
  },
  orderPrice: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '800',
    color: Brand.black,
  },
  primaryBtn: {
    backgroundColor: Brand.yellow,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontWeight: '700',
    fontSize: 16,
    color: Brand.black,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Brand.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: '78%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.black,
  },
  modalClose: {
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
  },
  modalMeta: {
    fontSize: 13,
    color: '#3F3F3F',
    marginBottom: 5,
  },
  modalSectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '800',
    color: Brand.black,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAEAEA',
  },
  modalItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.black,
  },
  modalItemSub: {
    marginTop: 2,
    fontSize: 12,
    color: '#666',
  },
  modalItemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.black,
  },
  modalTotal: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '800',
    color: Brand.black,
  },
});
