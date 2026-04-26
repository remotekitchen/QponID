import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/Colors';
import { type HomeCategory } from '@/constants/homeMockData';

export type HomeGridCategory = {
  id: string;
  label: string;
  image?: string | null;
  icon: HomeCategory['icon'];
};

const categoryIcon = (icon: HomeCategory['icon']) => {
  const map: Record<HomeCategory['icon'], keyof typeof MaterialCommunityIcons.glyphMap> = {
    cup: 'cup-outline',
    food: 'silverware-fork-knife',
    store: 'storefront-outline',
    gamepad: 'gamepad-variant-outline',
    gift: 'gift-outline',
  };
  return map[icon];
};

export default function CategoryGridSection({
  categories,
  selectedCategoryKey,
  onSelectCategory,
}: {
  categories: HomeGridCategory[];
  selectedCategoryKey: string;
  onSelectCategory: (key: string) => void;
}) {
  return (
    <View style={styles.catList}>
      {categories.map((item) => {
        const active = selectedCategoryKey === item.id;
        return (
          <Pressable
            key={item.id}
            style={[styles.catItem, active ? styles.catItemActive : undefined]}
            onPress={() => onSelectCategory(item.id)}>
            <View style={styles.catCircle}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.catImage} />
              ) : (
                <MaterialCommunityIcons name={categoryIcon(item.icon)} size={26} color={Brand.black} />
              )}
            </View>
            <Text style={styles.catLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  catList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  catItem: {
    width: '25%',
    alignItems: 'center',
  },
  catItemActive: {
    opacity: 0.96,
  },
  catCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F7F1F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  catImage: {
    width: '100%',
    height: '100%',
  },
  catLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.black,
    textAlign: 'center',
  },
});

