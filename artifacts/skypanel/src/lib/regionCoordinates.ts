/**
 * Region Geographic Coordinates
 * Real [lat, lng] coordinates for all supported regions
 * Replaces the old x/y percentage coordinate system
 */

export interface RegionCoordinate {
  lat: number;
  lng: number;
}

// Convert old x/y percentages to approximate lat/lng
// Original system: x=50, y=50 was center (0,0) in map coords
// Conversion: mapLng = (x - 50) * 3.6, mapLat = (50 - y) * 1.8
// Then approximate to real world lat/lng

export const REGION_COORDINATES: Record<string, RegionCoordinate> = {
  // Americas
  "us-east": { lat: 37.5, lng: -77.5 },       // Virginia
  "us-west": { lat: 37.5, lng: -122.5 },       // California
  "us-central": { lat: 41.5, lng: -93.5 },     // Iowa
  "us-southeast": { lat: 33.5, lng: -84.5 },   // Georgia
  "us-ord": { lat: 41.5, lng: -88.0 },         // Chicago
  "us-lax": { lat: 34.0, lng: -118.5 },        // Los Angeles
  "us-mia": { lat: 25.5, lng: -80.5 },         // Miami
  "us-sea": { lat: 47.5, lng: -122.5 },        // Seattle
  "us-iad": { lat: 38.5, lng: -77.5 },         // Washington DC
  "us-east-1": { lat: 37.5, lng: -77.5 },     // Virginia (same as us-east)
  "us-west-2": { lat: 45.5, lng: -119.0 },    // Oregon
  "us-central-1": { lat: 41.5, lng: -93.5 },   // Iowa (same as us-central)
  "ca-central": { lat: 43.5, lng: -79.5 },     // Toronto
  "ca-east": { lat: 45.5, lng: -73.5 },        // Montreal
  "br-gru": { lat: -23.5, lng: -46.5 },       // Sao Paulo
  "sa-east-1": { lat: -23.5, lng: -46.5 },    // Sao Paulo (same as br-gru)

  // Europe
  "eu-west": { lat: 51.5, lng: -0.5 },         // London
  "eu-central": { lat: 50.5, lng: 8.5 },       // Frankfurt
  "eu-west-1": { lat: 51.5, lng: -0.5 },       // London (same as eu-west)
  "eu-central-1": { lat: 50.5, lng: 8.5 },     // Frankfurt (same as eu-central)
  "nl-ams": { lat: 52.5, lng: 4.5 },           // Amsterdam
  "nl-ams-2": { lat: 52.5, lng: 4.5 },        // Amsterdam (HA)
  "de-fra": { lat: 50.5, lng: 8.5 },           // Frankfurt (same as eu-central)
  "de-fra-2": { lat: 50.5, lng: 8.5 },        // Frankfurt HA
  "gb-lon": { lat: 51.5, lng: -0.5 },          // London (same as eu-west)
  "gb-lhr": { lat: 51.5, lng: -0.5 },         // London Heathrow area
  "es-mad": { lat: 40.5, lng: -3.5 },          // Madrid
  "it-mil": { lat: 45.5, lng: 9.5 },           // Milan
  "fr-par": { lat: 49.0, lng: 2.5 },           // Paris
  "fr-par-2": { lat: 49.0, lng: 2.5 },        // Paris HA
  "se-sto": { lat: 59.5, lng: 18.5 },          // Stockholm
  "pl-waw": { lat: 52.5, lng: 21.0 },          // Warsaw

  // Asia-Pacific
  "ap-south": { lat: 19.5, lng: 73.5 },        // Mumbai
  "ap-northeast": { lat: 35.5, lng: 139.5 },   // Tokyo
  "ap-southeast": { lat: 1.5, lng: 104.0 },    // Singapore
  "ap-west": { lat: 19.5, lng: 73.5 },        // Mumbai (same as ap-south)
  "ap-south-1": { lat: 19.5, lng: 73.5 },     // Mumbai
  "ap-northeast-1": { lat: 35.5, lng: 139.5 }, // Tokyo
  "ap-southeast-1": { lat: 1.5, lng: 104.0 },  // Singapore
  "in-maa": { lat: 13.0, lng: 80.5 },          // Chennai
  "in-bom": { lat: 19.5, lng: 72.5 },          // Mumbai
  "in-bom-2": { lat: 19.5, lng: 72.5 },       // Mumbai HA
  "jp-tyo": { lat: 35.5, lng: 139.5 },        // Tokyo
  "jp-tyo-2": { lat: 35.5, lng: 139.5 },      // Tokyo HA
  "jp-tyo-3": { lat: 35.5, lng: 139.5 },      // Tokyo another HA
  "jp-osa": { lat: 34.5, lng: 135.5 },         // Osaka
  "sg-sin": { lat: 1.5, lng: 103.5 },          // Singapore
  "sg-sin-2": { lat: 1.5, lng: 103.5 },       // Singapore HA
  "id-cgk": { lat: -6.5, lng: 106.5 },        // Jakarta
  "au-mel": { lat: -37.5, lng: 145.0 },        // Melbourne
  "au-syd": { lat: -33.5, lng: 151.0 },        // Sydney
  "au-east": { lat: -33.5, lng: 151.0 },      // Sydney (same as au-syd)
  "kr-seoul": { lat: 37.5, lng: 127.5 },       // Seoul
  "hk-hkg": { lat: 22.5, lng: 114.0 },         // Hong Kong
  "tw-tpe": { lat: 25.5, lng: 121.5 },        // Taipei
};

/**
 * Get coordinates for a region
 */
export function getRegionCoords(regionId: string): RegionCoordinate | undefined {
  return REGION_COORDINATES[regionId];
}

/**
 * Get [lat, lng] array for Leaflet
 */
export function getRegionLatLng(regionId: string): [number, number] | undefined {
  const coords = REGION_COORDINATES[regionId];
  if (!coords) return undefined;
  return [coords.lat, coords.lng];
}

// ============================================
// ParticleGlobe / 3D Globe exports
// ============================================

/**
 * Convert lat/lng to 3D Vector3 position on a sphere
 * Used by ParticleGlobe for 3D globe rendering
 */
export function latLongToVector3(lat: number, lon: number, radius: number): { x: number; y: number; z: number } {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return { x, y, z };
}

/**
 * 3D coordinates for ParticleGlobe
 * Contains lat/lon for sphere projection
 */
export const REGION_COORDINATES_3D: Record<string, { lat: number; lon: number }> = {
  // Americas
  "us-east": { lat: 37.5, lon: -77.5 },
  "us-west": { lat: 37.5, lon: -122.5 },
  "us-central": { lat: 41.5, lon: -93.5 },
  "us-southeast": { lat: 33.5, lon: -84.5 },
  "us-ord": { lat: 41.5, lon: -88.0 },
  "us-lax": { lat: 34.0, lon: -118.5 },
  "us-mia": { lat: 25.5, lon: -80.5 },
  "us-sea": { lat: 47.5, lon: -122.5 },
  "us-iad": { lat: 38.5, lon: -77.5 },
  "us-east-1": { lat: 37.5, lon: -77.5 },
  "us-west-2": { lat: 45.5, lon: -119.0 },
  "us-central-1": { lat: 41.5, lon: -93.5 },
  "ca-central": { lat: 43.5, lon: -79.5 },
  "ca-east": { lat: 45.5, lon: -73.5 },
  "br-gru": { lat: -23.5, lon: -46.5 },
  "sa-east-1": { lat: -23.5, lon: -46.5 },
  // Europe
  "eu-west": { lat: 51.5, lon: -0.5 },
  "eu-central": { lat: 50.5, lon: 8.5 },
  "eu-west-1": { lat: 51.5, lon: -0.5 },
  "eu-central-1": { lat: 50.5, lon: 8.5 },
  "nl-ams": { lat: 52.5, lon: 4.5 },
  "nl-ams-2": { lat: 52.5, lon: 4.5 },
  "de-fra": { lat: 50.5, lon: 8.5 },
  "de-fra-2": { lat: 50.5, lon: 8.5 },
  "gb-lon": { lat: 51.5, lon: -0.5 },
  "gb-lhr": { lat: 51.5, lon: -0.5 },
  "es-mad": { lat: 40.5, lon: -3.5 },
  "it-mil": { lat: 45.5, lon: 9.5 },
  "fr-par": { lat: 49.0, lon: 2.5 },
  "fr-par-2": { lat: 49.0, lon: 2.5 },
  "se-sto": { lat: 59.5, lon: 18.5 },
  "pl-waw": { lat: 52.5, lon: 21.0 },
  // Asia-Pacific
  "ap-south": { lat: 19.5, lon: 73.5 },
  "ap-northeast": { lat: 35.5, lon: 139.5 },
  "ap-southeast": { lat: 1.5, lon: 104.0 },
  "ap-west": { lat: 19.5, lon: 73.5 },
  "ap-south-1": { lat: 19.5, lon: 73.5 },
  "ap-northeast-1": { lat: 35.5, lon: 139.5 },
  "ap-southeast-1": { lat: 1.5, lon: 104.0 },
  "in-maa": { lat: 13.0, lon: 80.5 },
  "in-bom": { lat: 19.5, lon: 72.5 },
  "in-bom-2": { lat: 19.5, lon: 72.5 },
  "jp-tyo": { lat: 35.5, lon: 139.5 },
  "jp-tyo-2": { lat: 35.5, lon: 139.5 },
  "jp-tyo-3": { lat: 35.5, lon: 139.5 },
  "jp-osa": { lat: 34.5, lon: 135.5 },
  "sg-sin": { lat: 1.5, lon: 103.5 },
  "sg-sin-2": { lat: 1.5, lon: 103.5 },
  "id-cgk": { lat: -6.5, lon: 106.5 },
  "au-mel": { lat: -37.5, lon: 145.0 },
  "au-syd": { lat: -33.5, lon: 151.0 },
  "au-east": { lat: -33.5, lon: 151.0 },
  "kr-seoul": { lat: 37.5, lon: 127.5 },
  "hk-hkg": { lat: 22.5, lon: 114.0 },
  "tw-tpe": { lat: 25.5, lon: 121.5 },
};
