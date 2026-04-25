/**
 * Reverse geocoding using OpenStreetMap Nominatim.
 * Converts GPS coordinates to a human-readable location name.
 *
 * Nominatim usage policy: max 1 request/second, must include User-Agent.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "PaceScope/1.0";

interface NominatimAddress {
  road?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
}

/**
 * Reverse-geocode coordinates to a short location string (e.g. "Paris, France").
 * Returns null on failure (network error, rate limit, no result).
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const url = `${NOMINATIM_URL}?lat=${latitude}&lon=${longitude}&format=json&zoom=12&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { address?: NominatimAddress };
    if (!data.address) return null;

    return formatLocation(data.address);
  } catch {
    return null;
  }
}

/**
 * Build a short location string from Nominatim address components.
 * Prefers: "City, Country" or "Town, Country" or "Village, Country".
 * Falls back to suburb, county, or state if city-level is unavailable.
 */
function formatLocation(addr: NominatimAddress): string | null {
  const city =
    addr.city || addr.town || addr.village || addr.hamlet || addr.municipality;
  const region = addr.state || addr.county;
  const country = addr.country;

  if (!city && !region && !country) return null;

  // Prefer "City, Country"
  if (city && country) return `${city}, ${country}`;
  // Fallback: "Region, Country"
  if (region && country) return `${region}, ${country}`;
  // Just country
  if (country) return country;
  // Just city or region
  return city || region || null;
}
