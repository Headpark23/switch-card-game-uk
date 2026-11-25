import { COUNTRIES } from '../switch/store/places';

const AUTO_KEY = 'switchGpsPassport';
const STAMPS_KEY = 'switchGpsStamps';
const MAX_GPS_STAMPS = 500;
const KNOWN_COUNTRIES = new Set(COUNTRIES.map((entry) => entry.code));

export interface GpsStampEntry {
  readonly at: string;
  readonly town: string;
  readonly country: string;
  readonly kind: 'computer' | 'online' | 'night' | 'check-in';
}

export interface DetectedPlace {
  readonly town: string;
  readonly country: string;
}

/** Whether automatic GPS passport stamping is switched on for this phone (opt-in, off by default). */
export function gpsAutoStampEnabled(): boolean {
  try { return window.localStorage.getItem(AUTO_KEY) === '1'; } catch { return false; }
}

export function setGpsAutoStamp(on: boolean): void {
  try { window.localStorage.setItem(AUTO_KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
}

export function readGpsStamps(): GpsStampEntry[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STAMPS_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is GpsStampEntry =>
      item && typeof item === 'object'
      && typeof item.at === 'string'
      && typeof item.town === 'string' && item.town.trim().length > 0
      && typeof item.country === 'string' && KNOWN_COUNTRIES.has(item.country),
    );
  } catch {
    return [];
  }
}

export function recordGpsStamp(entry: Omit<GpsStampEntry, 'at'> & { at?: string }): GpsStampEntry[] {
  const town = entry.town.trim().replace(/\s+/g, ' ').slice(0, 40);
  const country = entry.country.trim().toUpperCase();
  if (!town || !KNOWN_COUNTRIES.has(country)) return readGpsStamps();
  const next: GpsStampEntry = { at: entry.at ?? new Date().toISOString(), town, country, kind: entry.kind };
  const list = [...readGpsStamps(), next].slice(-MAX_GPS_STAMPS);
  try { window.localStorage.setItem(STAMPS_KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
  return list;
}

function readPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('GPS is not available on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      if (err.code === 1) reject(new Error('Location permission was denied. Allow location in your browser settings to auto-stamp.'));
      else if (err.code === 3) reject(new Error('GPS signal timed out. Try again in a moment.'));
      else reject(new Error('Could not get a GPS fix right now.'));
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 300_000 });
  });
}

async function reverseGeocode(lat: number, lon: number): Promise<DetectedPlace> {
  // Primary: BigDataCloud free client-side reverse geocode (no API key, CORS-friendly). Raw coordinates are never saved.
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`);
    if (res.ok) {
      const data = await res.json() as { city?: string; locality?: string; principalSubdivision?: string; countryCode?: string };
      const country = (data.countryCode ?? '').toUpperCase();
      const town = (data.city || data.locality || data.principalSubdivision || '').trim().slice(0, 40);
      if (town && KNOWN_COUNTRIES.has(country)) return { town, country };
    }
  } catch { /* fall through to backup */ }

  // Backup: OpenStreetMap Nominatim
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Could not look up town name right now (check your connection).');
  const data = await res.json() as { address?: Record<string, string> };
  const addr = data.address ?? {};
  const country = (addr.country_code ?? '').toUpperCase();
  const town = (addr.town || addr.city || addr.village || addr.municipality || addr.suburb || addr.county || '').trim().slice(0, 40);
  if (!town || !KNOWN_COUNTRIES.has(country)) throw new Error('Could not identify your town or country from GPS.');
  return { town, country };
}

/** Uses the phone's GPS signal to resolve the player's current Town and Country. Coordinates are discarded immediately. */
export async function detectGpsPlace(): Promise<DetectedPlace> {
  const pos = await readPosition();
  return reverseGeocode(pos.coords.latitude, pos.coords.longitude);
}

let inFlightAuto: Promise<void> | null = null;

/** Quietly stamps the player's current Town & Country when GPS auto-stamp is enabled. Never delays gameplay. */
export function autoStampGameIfEnabled(kind: 'computer' | 'online' | 'night'): void {
  if (!gpsAutoStampEnabled() || inFlightAuto) return;
  inFlightAuto = detectGpsPlace()
    .then((found) => { recordGpsStamp({ town: found.town, country: found.country, kind }); })
    .catch(() => { /* offline or permission not granted: silently skip */ })
    .finally(() => { inFlightAuto = null; });
}
