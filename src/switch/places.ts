/** Where a night was played. Venue names are typed; the country comes from this list and is stamped in the passport. */
export interface Place {
  readonly name: string;
  /** ISO 3166-1 alpha-2 country code. */
  readonly country: string;
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
  return typeof item.name === "string" && typeof item.country === "string" ? { name: item.name, country: item.country } : null;
}

export function putLastPlace(extensions: Extensions, place: Place): Record<string, unknown> {
  return { ...extensions, [LAST_KEY]: { name: place.name, country: place.country } };
}

/** Cleans a typed place. A blank name means "not recorded". */
export function cleanPlace(name: string, country: string): Place | undefined {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 40);
  return clean && NAMES.has(country) ? { name: clean, country } : undefined;
}
