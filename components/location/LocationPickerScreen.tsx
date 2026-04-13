import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/Colors';
import { DEFAULT_MAP_CENTER, DEFAULT_REGION_DELTA } from '@/constants/mapDefaults';
import { reverseGeocodeLabel } from '@/lib/geocoding';

export type PickedLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

type Props = {
  initial: PickedLocation | null;
  onClose: () => void;
  onSave: (p: PickedLocation) => void | Promise<void>;
};

function buildRegion(lat: number, lng: number): Region {
  return {
    latitude: lat,
    longitude: lng,
    ...DEFAULT_REGION_DELTA,
  };
}

export function LocationPickerScreen({ initial, onClose, onSave }: Props) {
  const mapRef = useRef<MapView>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapKey, setMapKey] = useState(0);

  const [initialRegion, setInitialRegion] = useState<Region>(() =>
    buildRegion(initial?.latitude ?? DEFAULT_MAP_CENTER.latitude, initial?.longitude ?? DEFAULT_MAP_CENTER.longitude)
  );
  const [centerRegion, setCenterRegion] = useState<Region>(() => initialRegion);
  const [previewLabel, setPreviewLabel] = useState(initial?.label ?? '');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const schedulePreview = useCallback((latitude: number, longitude: number) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => {
      void reverseGeocodeLabel(latitude, longitude).then(setPreviewLabel);
    }, 450);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const lat = initial?.latitude ?? DEFAULT_MAP_CENTER.latitude;
      const lng = initial?.longitude ?? DEFAULT_MAP_CENTER.longitude;
      const next = buildRegion(lat, lng);
      setInitialRegion(next);
      setCenterRegion(next);
      setPreviewLabel(initial?.label ?? '');
      setMapReady(false);
      setMapKey((k) => k + 1);
      void reverseGeocodeLabel(lat, lng).then(setPreviewLabel);
    }, [initial?.latitude, initial?.longitude, initial?.label])
  );

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Allow location so we can move the map to you. You can still drag the map manually.'
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;
      const next = buildRegion(latitude, longitude);
      setInitialRegion(next);
      setCenterRegion(next);
      mapRef.current?.animateToRegion(next, 600);
      void reverseGeocodeLabel(latitude, longitude).then(setPreviewLabel);
    } catch {
      Alert.alert('Location error', 'Could not read GPS. Drag the map to your area instead.');
    } finally {
      setLocating(false);
    }
  };

  const onRegionChangeComplete = (r: Region) => {
    setCenterRegion(r);
    schedulePreview(r.latitude, r.longitude);
  };

  const onConfirm = async () => {
    setBusy(true);
    try {
      const { latitude, longitude } = centerRegion;
      const label = await reverseGeocodeLabel(latitude, longitude);
      await onSave({
        latitude,
        longitude,
        label,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.webRoot} edges={['top', 'bottom']}>
        <Text style={styles.webTitle}>Map location</Text>
        <Text style={styles.webBody}>
          Open Hungry Tiger in Expo Go on a phone to pick a location on the map.
        </Text>
        <Pressable style={styles.webBtn} onPress={onClose}>
          <Text style={styles.webBtnText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.nativeRoot}>
      <MapView
        key={mapKey}
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onMapReady={() => {
          setMapReady(true);
          mapRef.current?.animateToRegion(initialRegion, 1);
        }}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={false}
        showsMyLocationButton={false}
        rotateEnabled={false}
        pitchEnabled={false}
      />

      {!mapReady ? (
        <View style={styles.mapLoading}>
          <ActivityIndicator size="large" color={Brand.yellow} />
          <Text style={styles.mapLoadingText}>Loading map…</Text>
        </View>
      ) : null}

      <View pointerEvents="none" style={styles.centerPinWrap}>
        <MaterialCommunityIcons name="map-marker" size={44} color={Brand.redSmile} />
      </View>

      <SafeAreaView style={styles.topBar} edges={['top']}>
        <Pressable style={styles.iconCircle} onPress={onClose} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={24} color={Brand.black} />
        </Pressable>
        <Text style={styles.topTitle}>Set location</Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      <SafeAreaView style={styles.hintPill} edges={['top']}>
        <Text style={styles.hintText}>Drag the map — pin is the center</Text>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomSheet} edges={['bottom']}>
        <Text style={styles.previewLabel} numberOfLines={2}>
          {previewLabel || 'Drag the map to your area…'}
        </Text>
        <View style={styles.actions}>
          <Pressable
            style={[styles.secondaryBtn, locating && styles.btnDisabled]}
            onPress={useMyLocation}
            disabled={locating}>
            {locating ? (
              <ActivityIndicator color={Brand.black} />
            ) : (
              <Text style={styles.secondaryBtnText}>Use my location</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            onPress={onConfirm}
            disabled={busy}>
            {busy ? (
              <ActivityIndicator color={Brand.black} />
            ) : (
              <Text style={styles.primaryBtnText}>Use this location</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const PIN_OFFSET = 36;

const styles = StyleSheet.create({
  nativeRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    zIndex: 1,
  },
  mapLoadingText: {
    marginTop: 12,
    color: '#fff',
    fontWeight: '600',
  },
  centerPinWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -22,
    marginTop: -PIN_OFFSET,
    alignItems: 'center',
    zIndex: 2,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 4,
    zIndex: 3,
  },
  hintPill: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  hintText: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
    color: Brand.black,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Brand.white,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Brand.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 3,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.black,
    marginBottom: 12,
    minHeight: 40,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Brand.black,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryBtnText: {
    fontWeight: '800',
    fontSize: 14,
    color: Brand.black,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Brand.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnText: {
    fontWeight: '800',
    fontSize: 14,
    color: Brand.black,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  webRoot: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: Brand.white,
  },
  webTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  webBody: {
    fontSize: 15,
    color: Brand.grey,
    lineHeight: 22,
    marginBottom: 20,
  },
  webBtn: {
    backgroundColor: Brand.yellow,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  webBtnText: {
    fontWeight: '800',
  },
});
