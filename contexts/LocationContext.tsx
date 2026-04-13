import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { PickedLocation } from '@/components/location/LocationPickerScreen';

const STORAGE_KEY = 'hungry-tiger-picked-location-v1';

type LocationContextValue = {
  savedLocation: PickedLocation | null;
  locationReady: boolean;
  openLocationPicker: () => void;
  closeLocationPicker: () => void;
  savePickedLocation: (p: PickedLocation) => Promise<void>;
};

const LocationContext = createContext<LocationContextValue | null>(null);

function LocationProviderInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [savedLocation, setSavedLocation] = useState<PickedLocation | null>(null);
  const [locationReady, setLocationReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const p = JSON.parse(raw) as PickedLocation;
          if (
            typeof p.latitude === 'number' &&
            typeof p.longitude === 'number' &&
            typeof p.label === 'string'
          ) {
            setSavedLocation(p);
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => {
        if (!cancelled) setLocationReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const savePickedLocation = useCallback(async (p: PickedLocation) => {
    setSavedLocation(p);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }, []);

  const openLocationPicker = useCallback(() => {
    router.push('/location-picker');
  }, [router]);

  const closeLocationPicker = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);

  const value = useMemo<LocationContextValue>(
    () => ({
      savedLocation,
      locationReady,
      openLocationPicker,
      closeLocationPicker,
      savePickedLocation,
    }),
    [savedLocation, locationReady, openLocationPicker, closeLocationPicker, savePickedLocation]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  return <LocationProviderInner>{children}</LocationProviderInner>;
}

export function useLocationPicker() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationPicker must be used within LocationProvider');
  return ctx;
}

export type { PickedLocation };
