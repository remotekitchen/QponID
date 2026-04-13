export type NearbyRestaurant = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  cuisine: string | null;
};

type OverpassElement = {
  id: number;
  type: 'node' | 'way' | 'relation';
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export async function fetchNearbyRestaurants(
  latitude: number,
  longitude: number,
  radiusMeters = 2500,
  limit = 20
): Promise<NearbyRestaurant[]> {
  const query = `
[out:json][timeout:25];
(
  node["amenity"="restaurant"](around:${radiusMeters},${latitude},${longitude});
  way["amenity"="restaurant"](around:${radiusMeters},${latitude},${longitude});
  relation["amenity"="restaurant"](around:${radiusMeters},${latitude},${longitude});
);
out center tags;
`;

  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: query,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return normalizeElements(json.elements ?? [], latitude, longitude, limit);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Overpass request failed');
}

function normalizeElements(
  elements: OverpassElement[],
  originLat: number,
  originLon: number,
  limit: number
): NearbyRestaurant[] {
  const mapped: NearbyRestaurant[] = [];
  for (const el of elements) {
    const c = getCoords(el);
    if (!c) continue;
    const tags = el.tags ?? {};
    const name = tags.name?.trim();
    if (!name) continue;
    const address = buildAddress(tags);
    const cuisine = tags.cuisine?.split(';')[0]?.trim() ?? null;
    const distanceKm = haversineKm(originLat, originLon, c.lat, c.lon);
    mapped.push({
      id: `${el.type}-${el.id}`,
      name,
      address,
      latitude: c.lat,
      longitude: c.lon,
      distanceKm,
      cuisine,
    });
  }

  const deduped = new Map<string, NearbyRestaurant>();
  for (const r of mapped.sort((a, b) => a.distanceKm - b.distanceKm)) {
    const key = `${r.name.toLowerCase()}|${r.address.toLowerCase()}`;
    if (!deduped.has(key)) deduped.set(key, r);
  }
  return [...deduped.values()].slice(0, limit);
}

function getCoords(el: OverpassElement): { lat: number; lon: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lon: el.lon };
  if (el.center && typeof el.center.lat === 'number' && typeof el.center.lon === 'number') {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

function buildAddress(tags: Record<string, string>): string {
  const road = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ').trim();
  const area = [tags['addr:suburb'], tags['addr:city'], tags['addr:district']].find(Boolean);
  if (road && area) return `${road}, ${area}`;
  if (area) return area;
  return 'Address not available';
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
