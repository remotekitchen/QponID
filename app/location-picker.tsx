import { useRouter } from 'expo-router';
import React from 'react';

import { LocationPickerScreen } from '@/components/location/LocationPickerScreen';
import { useLocationPicker } from '@/contexts/LocationContext';

export const options = {
  headerShown: false,
  presentation: 'fullScreenModal' as const,
  animation: 'slide_from_bottom' as const,
};

export default function LocationPickerRoute() {
  const router = useRouter();
  const { savedLocation, savePickedLocation } = useLocationPicker();

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <LocationPickerScreen
      initial={savedLocation}
      onClose={close}
      onSave={savePickedLocation}
    />
  );
}
