import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/Colors';

const H_PAD = 16;

export type NearbyDealTab = 'Relevance' | 'Nearby';
export type NearbyRatingOption = { key: string; label: string };
type Props<T extends { key: string }> = {
  dealTab: NearbyDealTab;
  dealTabs: readonly NearbyDealTab[];
  onDealTab: (tab: NearbyDealTab) => void;
  selectedRatingLabel: string;
  onRatingPress: () => void;
  isRatingOpen: boolean;
  ratingOptions: NearbyRatingOption[];
  selectedRatingKey: string;
  onSelectRating: (key: string) => void;
  locationReady: boolean;
  dealsLoading: boolean;
  dealsFetching: boolean;
  dealsError: boolean;
  groupedDealRows: T[];
  onRetry: () => void;
  renderRow: (row: T) => React.ReactNode;
};

export default function NearbyDealsSection<T extends { key: string }>({
  dealTab,
  dealTabs,
  onDealTab,
  selectedRatingLabel,
  onRatingPress,
  isRatingOpen,
  ratingOptions,
  selectedRatingKey,
  onSelectRating,
  locationReady,
  dealsLoading,
  dealsFetching,
  dealsError,
  groupedDealRows,
  onRetry,
  renderRow,
}: Props<T>) {
  return (
    <View style={styles.nearbySection}>
      <Text style={styles.nearbyTitle}>Nearby stores</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}>
        {dealTabs.map((tab) => {
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

      {isRatingOpen ? (
        <View style={styles.categoryDropdown}>
          {ratingOptions.map((r) => {
            const active = selectedRatingKey === r.key;
            return (
              <Pressable
                key={r.key}
                style={[styles.categoryOptionRow, active && styles.categoryOptionRowActive]}
                onPress={() => onSelectRating(r.key)}>
                <Text style={[styles.categoryOptionText, active && styles.categoryOptionTextActive]}>
                  {r.label}
                </Text>
                {active ? <MaterialCommunityIcons name="check" size={16} color={Brand.magenta} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!locationReady || dealsLoading ? (
        <View style={styles.dealsState}>
          <ActivityIndicator size="small" color={Brand.magenta} />
          <Text style={styles.dealsStateText}>Loading nearby deals…</Text>
        </View>
      ) : dealsError ? (
        <View style={styles.dealsState}>
          <Text style={styles.dealsStateTitle}>Could not load deals</Text>
          <Text style={styles.dealsStateSub}>Check your connection and try again.</Text>
          <Pressable style={styles.dealsRetryBtn} onPress={onRetry}>
            <Text style={styles.dealsRetryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : groupedDealRows.length === 0 ? (
        <View style={styles.dealsState}>
          <Text style={styles.dealsStateText}>No deals found near this location.</Text>
        </View>
      ) : (
        <>
          {dealsFetching && !dealsLoading ? <Text style={styles.refreshHint}>Updating…</Text> : null}
          {groupedDealRows.map((row) => (
            <React.Fragment key={row.key}>{renderRow(row)}</React.Fragment>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  stripChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.black,
  },
  stripChipTextActive: {
    color: Brand.magenta,
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
});

