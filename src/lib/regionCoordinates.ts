/**
 * Geographic coordinates for Linode regions
 * Used for 3D globe visualization on the homepage hero
 *
 * Keys match Linode region IDs
 * Values are latitude and longitude in decimal degrees
 */

export const REGION_COORDINATES_3D: Record<string, { lat: number; lon: number }> = {
  // Americas
  'us-east': { lat: 40.7128, lon: -74.0060 },        // New York/Newark
  'us-central': { lat: 32.7767, lon: -96.7970 },     // Dallas
  'us-west': { lat: 37.4419, lon: -122.1430 },       // Fremont
  'us-southeast': { lat: 33.7490, lon: -84.3880 },   // Atlanta
  'us-ord': { lat: 41.8781, lon: -87.6298 },         // Chicago
  'us-lax': { lat: 33.9425, lon: -118.4081 },        // Los Angeles
  'us-mia': { lat: 25.7617, lon: -80.1918 },         // Miami
  'us-sea': { lat: 47.6062, lon: -122.3321 },        // Seattle
  'us-iad': { lat: 38.9072, lon: -77.0369 },         // Washington D.C.
  'ca-central': { lat: 43.6532, lon: -79.3832 },     // Toronto
  'br-gru': { lat: -23.5505, lon: -46.6333 },        // São Paulo

  // Europe
  'eu-west': { lat: 51.5074, lon: -0.1278 },          // London
  'eu-central': { lat: 50.1109, lon: 8.6821 },        // Frankfurt
  'nl-ams': { lat: 52.3676, lon: 4.9041 },           // Amsterdam
  'de-fra-2': { lat: 50.1109, lon: 8.6821 },        // Frankfurt
  'gb-lon': { lat: 51.5074, lon: -0.1278 },          // London
  'es-mad': { lat: 40.4168, lon: -3.7038 },         // Madrid
  'it-mil': { lat: 45.4642, lon: 9.1900 },           // Milan
  'fr-par': { lat: 48.8566, lon: 2.3522 },           // Paris
  'fr-par-2': { lat: 48.8566, lon: 2.3522 },        // Paris
  'se-sto': { lat: 59.3293, lon: 18.0686 },          // Stockholm

  // Asia-Pacific
  'ap-south': { lat: 1.3521, lon: 103.8198 },       // Singapore
  'ap-northeast': { lat: 35.6762, lon: 139.6503 },  // Tokyo
  'ap-southeast': { lat: -33.8688, lon: 151.2093 }, // Sydney
  'ap-west': { lat: 19.0760, lon: 72.8777 },        // Mumbai
  'in-maa': { lat: 13.0827, lon: 80.2707 },          // Chennai
  'in-bom-2': { lat: 19.0760, lon: 72.8777 },       // Mumbai
  'jp-tyo-3': { lat: 35.6762, lon: 139.6503 },      // Tokyo
  'jp-osa': { lat: 34.6937, lon: 135.5023 },         // Osaka
  'sg-sin-2': { lat: 1.3521, lon: 103.8198 },        // Singapore
  'id-cgk': { lat: -6.2088, lon: 106.8456 },        // Jakarta
  'au-mel': { lat: -37.8136, lon: 144.9631 },       // Melbourne
};

/**
 * Convert latitude/longitude to 3D vector position on a sphere
 * Uses spherical coordinates where:
 * - lat is latitude (-90 to 90)
 * - lon is longitude (-180 to 180)
 */
export function latLongToVector3(lat: number, lon: number, radius: number): { x: number; y: number; z: number } {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

/**
 * Get country flag emoji from country code
 */
export function getCountryFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
