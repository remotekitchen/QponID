import { StyleSheet, Pressable } from 'react-native';

import { Text, View } from '@/components/Themed';
import { Brand } from '@/constants/Colors';

export default function OrderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Order</Text>
      <View style={styles.chips}>
        <View style={[styles.chip, styles.chipActive]}>
          <Text style={styles.chipTextActive}>All</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>Usable</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>To Be Paid</Text>
        </View>
      </View>
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No Orders Yet</Text>
        <Text style={styles.emptySubtitle}>There are currently no orders available</Text>
        <Pressable style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Order now</Text>
        </Pressable>
      </View>
    </View>
  );
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
    marginBottom: 24,
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
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Brand.grey,
    marginBottom: 28,
    textAlign: 'center',
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
});
