/**
 * useSpiderfy Hook
 * Handles spiderfying of overlapping map markers
 */

import { useState, useCallback, useMemo, useEffect } from "react";

export interface SpiderfyState {
  activeCluster: string[] | null; // Region IDs in the active cluster
  spiderfiedRegions: Set<string>; // All regions currently spiderfied
}

interface Coordinate {
  x: number;
  y: number;
}

interface RegionWithCoords {
  id: string;
  coords: Coordinate;
}

/**
 * Calculate distance between two points
 */
function distance(a: Coordinate, b: Coordinate): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

/**
 * Find clusters of overlapping markers
 */
function findClusters(
  regions: RegionWithCoords[],
  zoom: number,
  threshold: number = 30 // pixels
): Map<string, string[]> {
  const clusters = new Map<string, string[]>();
  const visited = new Set<string>();

  // Scale threshold based on zoom
  const scaledThreshold = threshold / zoom;

  for (const region of regions) {
    if (visited.has(region.id)) continue;

    const cluster: string[] = [region.id];
    visited.add(region.id);

    // Find all regions within threshold distance
    for (const other of regions) {
      if (visited.has(other.id)) continue;
      
      const dist = distance(region.coords, other.coords);
      if (dist < scaledThreshold) {
        cluster.push(other.id);
        visited.add(other.id);
      }
    }

    // Only create cluster if more than one region
    if (cluster.length > 1) {
      for (const id of cluster) {
        clusters.set(id, cluster);
      }
    }
  }

  return clusters;
}

/**
 * Calculate spider positions for a cluster
 */
function calculateSpiderPositions(
  clusterSize: number,
  centerIndex: number,
  radius: number = 25
): { angle: number; radius: number } {
  // Spread markers in a circle
  const angleStep = (2 * Math.PI) / clusterSize;
  const angle = angleStep * centerIndex - Math.PI / 2; // Start from top
  
  return {
    angle,
    radius: clusterSize > 1 ? radius : 0,
  };
}

export function useSpiderfy(
  regions: RegionWithCoords[],
  zoom: number,
  selectedRegion: string | null
) {
  const [spiderfiedCluster, setSpiderfiedCluster] = useState<string[] | null>(null);

  // Find all clusters
  const clusters = useMemo(() => {
    return findClusters(regions, zoom);
  }, [regions, zoom]);

  // Get spiderfy data for a region
  const getSpiderfyData = useCallback(
    (regionId: string): { isSpiderfied: boolean; angle: number; radius: number } => {
      // Check if this region is in a cluster
      const cluster = clusters.get(regionId);
      
      if (!cluster) {
        return { isSpiderfied: false, angle: 0, radius: 0 };
      }

      // Check if this cluster is active (spiderfied)
      const isActive = spiderfiedCluster && 
        spiderfiedCluster.includes(regionId) &&
        spiderfiedCluster.length === cluster.length;

      if (!isActive) {
        return { isSpiderfied: false, angle: 0, radius: 0 };
      }

      // Calculate position in spider
      const index = cluster.indexOf(regionId);
      const { angle, radius } = calculateSpiderPositions(cluster.length, index);

      return { isSpiderfied: true, angle, radius };
    },
    [clusters, spiderfiedCluster]
  );

  // Toggle spiderfy for a cluster
  const toggleSpiderfy = useCallback(
    (regionId: string) => {
      const cluster = clusters.get(regionId);
      
      if (!cluster) {
        // Not in a cluster, just select normally
        setSpiderfiedCluster(null);
        return;
      }

      // Check if this cluster is already spiderfied
      const isAlreadySpiderfied = spiderfiedCluster && 
        spiderfiedCluster.includes(regionId) &&
        spiderfiedCluster.length === cluster.length;

      if (isAlreadySpiderfied) {
        // Collapse the spider
        setSpiderfiedCluster(null);
      } else {
        // Expand the spider
        setSpiderfiedCluster(cluster);
      }
    },
    [clusters, spiderfiedCluster]
  );

  // Collapse spider when clicking away
  const collapseSpider = useCallback(() => {
    setSpiderfiedCluster(null);
  }, []);

  // Collapse spider when zoom changes significantly
  useEffect(() => {
    if (spiderfiedCluster) {
      // Optionally collapse on zoom change
      // setSpiderfiedCluster(null);
    }
  }, [zoom]);

  return {
    getSpiderfyData,
    toggleSpiderfy,
    collapseSpider,
    spiderfiedCluster,
    clusters,
  };
}

export default useSpiderfy;
