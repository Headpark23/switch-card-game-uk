/** Where a night was played. Venue and town can be typed or filled by phone GPS; both country and town are stamped in the passport. */
export interface Place {
  readonly name: string;
  /** ISO 3166-1 alpha-2 country code. */
  readonly country: string;
  /** Town or city where the game was played (typed or from GPS). */
  readonly town?: string;
  /** True when stamped via the phone's GPS signal. */
  readonly viaGps?: boolean;
}

export const COUNTRIES: readonly { readonly code: string; readonly name: string }[] = [
  ["GB", "United Kingdom"], ["IE", "Ireland"], ["US", "United States"], ["CA", "Canada"], ["AU", "Australia"], ["NZ", "New Zealand"],
  ["FR", "France"], ["DE", "Germany"], ["ES", "Spain"], ["PT", "Portugal"], ["IT", "Italy"], ["NL", "Netherlands"], ["BE", "Belgium"],
  ["CH", "Switzerland"], ["AT", "Austria"], ["SE", "Sweden"], ["NO", "Norway"], ["DK", "Denmark"], ["FI", "Finland"], ["IS", "Iceland"],
  ["PL", "Poland"], ["CZ", "Czechia"], ["HU", "Hungary"], ["RO", "Romania"], ["BG", "Bulgaria"], ["GR", "Greece"], ["HR", "Croatia"],
  ["SI", "Slovenia"], ["SK", "Slovakia"], ["EE", "Estonia"], ["LV", "Latvia"], ["LT", "Lithuania"], ["MT", "Malta"], ["CY", "Cyprus"],
  ["LU", "Luxembourg"], ["TR", "Turkey"], ["UA", "Ukraine"], ["RS", "Serbia"], ["ME", "Montenegro"], ["AL", "Albania"],
  ["MX", "Mexico"], ["BR", "Brazil"], ["AR", "Argentina"], ["CL", "Chile"], ["CO", "Colombia"], ["PE", "Peru"], ["CR", "Costa Rica"],
  ["JM", "Jamaica"], ["BB", "Barbados"], ["BS", "Bahamas"], ["DO", "Dominican Republic"], ["CU", "Cuba"],
  ["ZA", "South Africa"], ["EG", "Egypt"], ["MA", "Morocco"], ["KE", "Kenya"], ["TZ", "Tanzania"], ["NG", "Nigeria"], ["GH", "Ghana"], ["MU", "Mauritius"],
  ["AE", "United Arab Emirates"], ["QA", "Qatar"], ["SA", "Saudi Arabia"], ["IL", "Israel"], ["JO", "Jordan"], ["IN", "India"], ["LK", "Sri Lanka"],
  ["TH", "Thailand"], ["VN", "Vietnam"], ["MY", "Malaysia"], ["SG", "Singapore"], ["ID", "Indonesia"], ["PH", "Philippines"],
  ["JP", "Japan"], ["KR", "South Korea"], ["CN", "China"], ["HK", "Hong Kong"], ["TW", "Taiwan"], ["MV", "Maldives"],
].map(([code, name]) => ({ code, name }));

const NAMES = new Map(COUNTRIES.map((country) => [country.code, country.name]));

export function countryName(code: string): string {
  return NAMES.get(code) ?? code;
}

/** A best guess at the country from the phone's language setting, such as en-GB. */
export function guessCountry(language = typeof navigator === "undefined" ? "" : navigator.language): string {
  const region = language.split("-")[1]?.toUpperCase();
  return region && NAMES.has(region) ? region : "GB";
}

const LAST_KEY = "switchLastPlace";

type Extensions = Readonly<Record<string, unknown>>;

export function getLastPlace(extensions: Extensions): Place | null {
  const value = extensions[LAST_KEY];
  if (value === null || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.name !== "string" || typeof item.country !== "string") return null;
  const town = typeof item.town === "string" && item.town.trim() ? item.town.trim() : undefined;
  return { name: item.name, country: item.country, ...(town ? { town } : {}) };
}

export function putLastPlace(extensions: Extensions, place: Place): Record<string, unknown> {
  return {
    ...extensions,
    [LAST_KEY]: {
      name: place.name,
      country: place.country,
      ...(place.town ? { town: place.town } : {}),
      ...(place.viaGps ? { viaGps: true } : {}),
    },
  };
}

/** Cleans a typed or GPS-filled place. Blank venue AND blank town means "not recorded". */
export function cleanPlace(name: string, country: string, town = "", viaGps = false): Place | undefined {
  const cleanName = name.trim().replace(/\s+/g, " ").slice(0, 40);
  const cleanTown = town.trim().replace(/\s+/g, " ").slice(0, 40);
  const finalName = cleanName || cleanTown;
  if (!finalName || !NAMES.has(country)) return undefined;
  return {
    name: finalName,
    country,
    ...(cleanTown ? { town: cleanTown } : {}),
    ...(viaGps ? { viaGps: true } : {}),
  };
}
