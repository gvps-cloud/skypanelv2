/**
 * GlobeMap Component
 * 3D interactive globe using ParticleGlobe for the Regions page
 */

'use client';

import { useCallback } from 'react';
import ParticleGlobe from '@/components/home/ParticleGlobe';

interface Region {
  id: string;
  label: string;
  site_type: string;
  status: string;
  country: string;
  speedTestUrl?: string;
}

interface LatencyState {
  [regionId: string]: {
    loading: boolean;
    latency?: number;
    error?: boolean;
    avg?: number;
    min?: number;
    max?: number;
  };
}

interface GlobeMapProps {
  regions: Region[];
  latencyState?: LatencyState;
  selectedRegion: string | null;
  testingRegionId?: string | null;
  onRegionClick: (regionId: string) => void;
  onRegionTest: (regionId: string, speedTestUrl: string) => void;
}

// Convert Region to RegionData for ParticleGlobe
function toRegionData(region: Region) {
  return {
    id: region.id,
    label: region.label,
    country: region.country,
    status: region.status,
    site_type: region.site_type,
    speedTestUrl: region.speedTestUrl,
  };
}

export function GlobeMap({ regions, latencyState, selectedRegion, testingRegionId, onRegionClick }: GlobeMapProps) {
  // Convert regions to RegionData format
  const regionData = regions.map(toRegionData);

  // Find the selected region object
  const selectedRegionData = selectedRegion
    ? regionData.find(r => r.id === selectedRegion) || null
    : null;

  // Handle region selection from the globe
  const handleRegionSelect = useCallback((region: { id: string } | null) => {
    if (region) {
      onRegionClick(region.id);
    }
  }, [onRegionClick]);

  return (
    <div className="w-full h-full min-h-[400px] md:min-h-[500px] relative">
      <ParticleGlobe
        regions={regionData}
        onRegionSelect={handleRegionSelect}
        selectedRegion={selectedRegionData}
        latencyState={latencyState}
        testingRegionId={testingRegionId}
        displayMode="flag"
      />
    </div>
  );
}

export default GlobeMap;
