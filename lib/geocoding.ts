import * as Location from 'expo-location';

export async function reverseGeocodeLabel(latitude: number, longitude: number): Promise<string> {
  try {
    const rows = await Location.reverseGeocodeAsync({ latitude, longitude });
    const r = rows[0];
    if (!r) return formatCoords(latitude, longitude);
    const line = [r.streetNumber, r.street].filter(Boolean).join(' ').trim();
    const area = [r.district, r.city, r.subregion, r.region].filter(Boolean)[0];
    if (line && area) return `${line}, ${area}`;
    if (area) return area;
    if (r.name) return r.name;
    if (r.postalCode && r.city) return `${r.city} ${r.postalCode}`;
    return formatCoords(latitude, longitude);
  } catch {
    return formatCoords(latitude, longitude);
  }
}

function formatCoords(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}
