'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { Globe, MapPin } from 'lucide-react';
import { latLongToVector3, REGION_COORDINATES_3D } from '@/lib/regionCoordinates';

interface RegionData {
  id: string;
  label: string;
  country: string;
  status: string;
  site_type: string;
  displayLabel?: string;
  displayCountry?: string;
  speedTestUrl?: string;
  capabilities?: string[];
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

interface ParticleGlobeProps {
  regions: RegionData[];
  onRegionSelect: (region: RegionData | null) => void;
  selectedRegion: RegionData | null;
  latencyState?: LatencyState;
  testingRegionId?: string | null;
  /** Display mode: 'flag' shows country flag icons with latency badges (for Regions page),
   *  'pixel' shows simple glowing dots (for homepage) */
  displayMode?: 'pixel' | 'flag';
  /** Disables click-to-select behavior on markers */
  disableClick?: boolean;
}

interface GlobeThemeColors {
  markerHex: string;
  selectedMarkerHex: string;
  continent: THREE.Color;
  atmosphere: THREE.Color;
  glow: THREE.Color;
  continentRGB: [number, number, number];
  atmosphereRGB: [number, number, number];
}

type MarkerDisplayState = 'default' | 'hovered' | 'selected' | 'testing';

const PARTICLE_COUNT = 4000;
const ATMOSPHERE_RADIUS = 1.65;
const GLOBE_RADIUS = 1.5;
const CONTINENT_RADIUS = 1.48;
const BASE_ROTATION_SPEED = 0.001;
const HOVER_ROTATION_SPEED = 0.00035;

// Flag image cache for 3D globe markers
const flagImageCache = new Map<string, HTMLImageElement>();
const flagLoadingPromises = new Map<string, Promise<HTMLImageElement | null>>();

/**
 * Load a flag image from hatscripts.github.io/circle-flags
 */
function loadFlagImage(countryCode: string): Promise<HTMLImageElement | null> {
  if (flagImageCache.has(countryCode)) {
    return Promise.resolve(flagImageCache.get(countryCode)!);
  }

  if (flagLoadingPromises.has(countryCode)) {
    return flagLoadingPromises.get(countryCode)!;
  }

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      flagImageCache.set(countryCode, img);
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = `https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg`;
  });

  flagLoadingPromises.set(countryCode, promise);
  return promise;
}

/**
 * Preload all flag images for regions
 * Uses region.country (ISO code) for flag lookups
 */
function preloadFlagImages(regions: RegionData[]): void {
  regions.forEach((region) => {
    // region.country is the ISO country code from the API (e.g., "US", "GB", "NL")
    const countryCode = region.country?.toLowerCase() || 'us';
    loadFlagImage(countryCode);
  });
}

const parseHslCssVar = (
  style: CSSStyleDeclaration,
  variableName: string,
  fallback: [number, number, number]
): [number, number, number] => {
  const raw = style.getPropertyValue(variableName).trim();
  if (!raw) {
    return fallback;
  }
  const parts = raw
    .split(/[,\s]+/)
    .map((part) => Number.parseFloat(part.replace('%', '')))
    .filter((part) => Number.isFinite(part));

  if (parts.length < 3) {
    return fallback;
  }
  return [parts[0], parts[1], parts[2]];
};

const colorFromHslTuple = (tuple: [number, number, number]) =>
  new THREE.Color().setHSL(tuple[0] / 360, tuple[1] / 100, tuple[2] / 100);

// eslint-disable-next-line react-refresh/only-export-components
export const resolveThemeColors = (): GlobeThemeColors => {
  const style = getComputedStyle(document.documentElement);
  const primary = parseHslCssVar(style, '--primary', [188, 82, 46]);
  const accent = parseHslCssVar(style, '--accent', [188, 53, 88]);

  const primaryColor = colorFromHslTuple(primary);
  const accentColor = colorFromHslTuple(accent);

  const continent = primaryColor.clone();
  const atmosphere = primaryColor.clone().lerp(accentColor, 0.25).offsetHSL(0, 0.02, 0.12);
  const glow = atmosphere.clone().multiplyScalar(0.85);

  return {
    markerHex: `#${primaryColor.getHexString()}`,
    selectedMarkerHex: `#${accentColor.getHexString()}`,
    continent,
    atmosphere,
    glow,
    continentRGB: [continent.r, continent.g, continent.b],
    atmosphereRGB: [atmosphere.r, atmosphere.g, atmosphere.b],
  };
};

// Get latency color
function getLatencyColor(latency: number | undefined): string {
  if (latency === undefined) return '#6366f1'; // default indigo
  if (latency < 100) return '#22c55e'; // green
  if (latency < 200) return '#eab308'; // yellow
  if (latency < 300) return '#f97316'; // orange
  return '#ef4444'; // red
}

// Create flag icon texture with optional latency badge
// If flagImage is provided, it will be drawn inside a circular clip
// mode 'pixel' draws simple glowing dots for homepage
// mode 'flag' draws country flags with latency badges for Regions page
function createFlagIconTexture(
  countryCode: string,
  state: MarkerDisplayState,
  latency: number | undefined,
  isTesting: boolean,
  markerColor: string,
  selectedColor: string,
  animationPhase: number = 0,
  flagImage: HTMLImageElement | null = null,
  mode: 'pixel' | 'flag' = 'flag'
): THREE.CanvasTexture {
  const size = state === 'hovered' || state === 'selected' || isTesting ? 128 : 80;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const center = size / 2;
  const iconRadius = size * 0.35;

  // Determine base color based on state
  let baseColor = markerColor;
  if (state === 'selected' || isTesting) {
    baseColor = selectedColor;
  }

  if (mode === 'pixel') {
    // PIXEL MODE: Simple glowing dot for homepage
    // Draw outer glow
    const glowGradient = ctx.createRadialGradient(center, center, iconRadius * 0.3, center, center, iconRadius * 1.5);
    glowGradient.addColorStop(0, baseColor);
    glowGradient.addColorStop(1, `${baseColor}00`);
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(center, center, iconRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Draw solid dot
    ctx.beginPath();
    ctx.arc(center, center, iconRadius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();

    // Add pulsing ring for testing state
    if (isTesting) {
      const pulseRadius = iconRadius * (0.6 + Math.sin(animationPhase) * 0.15);
      ctx.beginPath();
      ctx.arc(center, center, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(animationPhase) * 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  } else {
    // FLAG MODE: Country flag icons with latency badges (Regions page)
    // Draw outer glow for selected/testing states
    if (state === 'selected' || isTesting) {
      const glowGradient = ctx.createRadialGradient(center, center, iconRadius * 0.8, center, center, iconRadius * 1.5);
      const glowColor = isTesting ? '#3b82f6' : baseColor;
      glowGradient.addColorStop(0, `${glowColor}88`);
      glowGradient.addColorStop(1, `${glowColor}00`);
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, size, size);
    }

    // Draw white circle background
    ctx.beginPath();
    ctx.arc(center, center, iconRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Draw border
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = isTesting ? 4 : 3;
    ctx.stroke();

    // Clip to circle for flag image
    ctx.beginPath();
    ctx.arc(center, center, iconRadius - 4, 0, Math.PI * 2);
    ctx.clip();

    if (flagImage) {
      // Draw actual flag image scaled to fit
      const flagSize = (iconRadius - 4) * 2;
      const flagX = center - (iconRadius - 4);
      const flagY = center - (iconRadius - 4);
      ctx.drawImage(flagImage, flagX, flagY, flagSize, flagSize);
    } else {
      // Fallback: draw simplified colored flag representation
      const flagColor = getCountryFlagColor(countryCode);

      // Draw flag background color
      ctx.fillStyle = flagColor;
      ctx.fillRect(center - iconRadius + 4, center - iconRadius + 4, (iconRadius - 4) * 2, (iconRadius - 4) * 2);

      // Draw simplified flag pattern
      ctx.fillStyle = getSecondaryFlagColor(countryCode);
      ctx.fillRect(center - iconRadius + 4, center - iconRadius + 4, (iconRadius - 4) * 2, (iconRadius - 4) * 0.4);
    }

    ctx.restore();

    // Draw latency badge or testing indicator
    if (isTesting) {
      // Draw pulsing ring for testing state
      const pulseRadius = iconRadius * (1.3 + Math.sin(animationPhase) * 0.15);
      ctx.beginPath();
      ctx.arc(center, center, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(animationPhase) * 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw "..." indicator below
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('...', center, center + iconRadius + 14);
    } else if (latency !== undefined) {
      // Draw latency badge
      const latencyColor = getLatencyColor(latency);
      const badgeWidth = 36;
      const badgeHeight = 16;
      const badgeY = center + iconRadius - 4;

      // Badge background
      ctx.fillStyle = latencyColor;
      ctx.beginPath();
      ctx.roundRect(center - badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, 8);
      ctx.fill();

      // Badge text
      ctx.fillStyle = latencyColor === '#eab308' ? '#000' : '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${latency}`, center, badgeY);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Get primary color for a country's flag
function getCountryFlagColor(countryCode: string): string {
  const colors: Record<string, string> = {
    us: '#B22234', ca: '#FF0000', br: '#009B3A', gb: '#012169', nl: '#21468B',
    de: '#000000', es: '#AA151B', it: '#009246', fr: '#ED2939', se: '#006AA7',
    pl: '#FFFFFF', in: '#FF9933', jp: '#BC002D', sg: '#ED2939', id: '#FF0000',
    au: '#00008B', kr: '#CD2E3A', hk: '#DE2910', tw: '#FE0000',
  };
  return colors[countryCode] || '#6366f1';
}

// Get secondary color for a country's flag
function getSecondaryFlagColor(countryCode: string): string {
  const colors: Record<string, string> = {
    us: '#FFFFFF', ca: '#FFFFFF', br: '#FEDF00', gb: '#C8102E', nl: '#FFFFFF',
    de: '#DD0000', es: '#F1BF00', it: '#FFFFFF', fr: '#FFFFFF', se: '#FECC00',
    pl: '#DC143C', in: '#FFFFFF', jp: '#FFFFFF', sg: '#FFFFFF', id: '#FFFFFF',
    au: '#FFFFFF', kr: '#0047A0', hk: '#FFFFFF', tw: '#FFFFFF',
  };
  return colors[countryCode] || '#818cf8';
}

const rotateVectorY = (vector: THREE.Vector3, rotation: number): THREE.Vector3 => {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return new THREE.Vector3(
    vector.x * cos - vector.z * sin,
    vector.y,
    vector.x * sin + vector.z * cos
  );
};

const toThreeVector = (point: { x: number; y: number; z: number }) =>
  new THREE.Vector3(point.x, point.y, point.z);

// eslint-disable-next-line react-refresh/only-export-components
export const getSpriteDisplayState = (
  regionId: string,
  hoveredRegionId: string | null,
  selectedRegionId: string | null,
  testingRegionId: string | null,
  _latencyState: LatencyState | undefined
): MarkerDisplayState => {
  if (testingRegionId === regionId) {
    return 'testing';
  }
  if (selectedRegionId === regionId) {
    return 'selected';
  }
  if (hoveredRegionId === regionId) {
    return 'hovered';
  }
  return 'default';
};

export default function ParticleGlobe({
  regions,
  onRegionSelect,
  selectedRegion,
  latencyState,
  testingRegionId,
  displayMode,
  disableClick,
}: ParticleGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeRef = useRef<THREE.Mesh | null>(null);
  const globeTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const glowMeshRef = useRef<THREE.Mesh | null>(null);
  const atmosphereRef = useRef<THREE.Points | null>(null);
  const continentPointsRef = useRef<THREE.Points | null>(null);

  const frameIdRef = useRef<number>(0);
  const rotationRef = useRef(0);
  const currentRotationSpeedRef = useRef(BASE_ROTATION_SPEED);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const hoveredRegionRef = useRef<string | null>(null);
  const selectedRegionRef = useRef<string | null>(null);
  const themeColorsRef = useRef<GlobeThemeColors>(resolveThemeColors());
  const animationPhaseRef = useRef(0);
  const testingRegionIdRef = useRef<string | null>(null);
  // Target rotation for focusing on testing/selected region
  const targetRotationRef = useRef<number | null>(null);
  const isAutoRotatingToTargetRef = useRef(false);

  const markerSpritesRef = useRef<Map<string, THREE.Sprite>>(new Map());
  const markerLocalPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const markerStateRef = useRef<Map<string, MarkerDisplayState>>(new Map());
  // Store country code for each region ID for flag lookups
  const markerCountryCodeRef = useRef<Map<string, string>>(new Map());
  // Store displayMode in ref for access inside animate loop
  const displayModeRef = useRef<'pixel' | 'flag'>(displayMode || 'flag');

  const [isLoaded, setIsLoaded] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const applySpriteDisplayState = useCallback(
    async (regionId: string, nextState: MarkerDisplayState, forceTextureRefresh = false) => {
      const sprite = markerSpritesRef.current.get(regionId);
      if (!sprite) {
        return;
      }

      const previousState = markerStateRef.current.get(regionId);
      if (!forceTextureRefresh && previousState === nextState) {
        return;
      }

      // Get country code from stored mapping (set during rebuildMarkers)
      const countryCode = markerCountryCodeRef.current.get(regionId) || 'us';

      // Get latency info
      const state = latencyState?.[regionId];
      const isTesting = nextState === 'testing';
      const latency = state?.latency;

      const markerColor = themeColorsRef.current.markerHex;
      const selectedColor = themeColorsRef.current.selectedMarkerHex;

      const material = sprite.material as THREE.SpriteMaterial;
      const previousMap = material.map;

      // Only use flag image in flag mode
      const flagImg = displayModeRef.current === 'flag' ? (flagImageCache.get(countryCode) || null) : null;

      // Create new flag texture
      const nextTexture = createFlagIconTexture(
        countryCode,
        nextState,
        latency,
        isTesting,
        markerColor,
        selectedColor,
        animationPhaseRef.current,
        flagImg,
        displayModeRef.current
      );

      material.map = nextTexture;
      material.needsUpdate = true;
      previousMap?.dispose();

      // Set scale based on state
      if (nextState === 'selected') {
        sprite.scale.setScalar(0.22);
      } else if (nextState === 'testing') {
        sprite.scale.setScalar(0.25);
      } else if (nextState === 'hovered') {
        sprite.scale.setScalar(0.18);
      } else {
        sprite.scale.setScalar(0.12);
      }

      markerStateRef.current.set(regionId, nextState);
    },
    [latencyState]
  );

  const rebuildAtmosphere = useCallback((scene: THREE.Scene, atmosphereColor: THREE.Color) => {
    if (atmosphereRef.current) {
      scene.remove(atmosphereRef.current);
      atmosphereRef.current.geometry.dispose();
      (atmosphereRef.current.material as THREE.PointsMaterial).dispose();
    }

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const white = new THREE.Color(0xffffff);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = ATMOSPHERE_RADIUS + (Math.random() - 0.5) * 0.15;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const particleColor = Math.random() < 0.7 ? atmosphereColor : white;
      colors[i * 3] = particleColor.r;
      colors[i * 3 + 1] = particleColor.g;
      colors[i * 3 + 2] = particleColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });

    atmosphereRef.current = new THREE.Points(geometry, material);
    scene.add(atmosphereRef.current);
  }, []);

  const rebuildContinents = useCallback((scene: THREE.Scene, continentRGB: [number, number, number]) => {
    if (continentPointsRef.current) {
      scene.remove(continentPointsRef.current);
      continentPointsRef.current.geometry.dispose();
      (continentPointsRef.current.material as THREE.PointsMaterial).dispose();
    }

    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const continentShades: Array<[number, number, number]> = [
      [0, 0.65, 0.85], [0, 0.60, 0.80], [0, 0.68, 0.82],
      [0, 0.62, 0.78], [0, 0.70, 0.85], [0, 0.58, 0.75],
    ];

    const continents = [
      { points: [[25, -120], [35, -115], [45, -95], [50, -80], [45, -70], [35, -80], [25, -95]], shadeIdx: 0 },
      { points: [[10, -75], [0, -80], [-15, -70], [-30, -50], [-40, -65], [-50, -70], [-55, -40], [0, -45]], shadeIdx: 1 },
      { points: [[45, -10], [55, 0], [60, 25], [55, 45], [45, 55], [40, 40], [42, 20], [45, 10]], shadeIdx: 2 },
      { points: [[35, -10], [35, 20], [25, 35], [10, 40], [-10, 40], [-25, 35], [-35, 20], [-20, 15], [10, 15], [25, 5]], shadeIdx: 3 },
      { points: [[70, 30], [60, 55], [50, 85], [40, 110], [30, 130], [20, 140], [5, 115], [15, 95], [30, 80], [45, 70], [55, 50]], shadeIdx: 4 },
      { points: [[-15, 130], [-25, 118], [-35, 140], [-30, 150], [-18, 148]], shadeIdx: 5 },
    ];

    for (const continent of continents) {
      const lats = continent.points.map((point) => point[0]);
      const lons = continent.points.map((point) => point[1]);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);

      for (let i = 0; i < 1500; i++) {
        const lat = minLat + Math.random() * (maxLat - minLat);
        const lon = minLon + Math.random() * (maxLon - minLon);
        const point = latLongToVector3(lat, lon, CONTINENT_RADIUS);
        const shade = continentShades[continent.shadeIdx];

        positions.push(point.x, point.y, point.z);
        colors.push(
          continentRGB[0] * shade[0] || continentRGB[0],
          continentRGB[1] * shade[1] || continentRGB[1],
          continentRGB[2] * shade[2] || continentRGB[2]
        );
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.018,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });

    continentPointsRef.current = new THREE.Points(geometry, material);
    scene.add(continentPointsRef.current);
  }, []);

  const rebuildEarthTexture = useCallback((continentRGB: [number, number, number], atmosphereRGB: [number, number, number]) => {
    globeTextureRef.current?.dispose();

    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      const fallbackTexture = new THREE.CanvasTexture(canvas);
      globeTextureRef.current = fallbackTexture;
      return fallbackTexture;
    }

    const bgR = Math.round(continentRGB[0] * 0.063);
    const bgG = Math.round(continentRGB[1] * 0.059);
    const bgB = Math.round(continentRGB[2] * 0.11);
    ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
    ctx.fillRect(0, 0, 2048, 1024);

    const drawContinent = (
      points: number[][],
      colorR: number,
      colorG: number,
      colorB: number,
      alpha: number,
      glowR: number,
      glowG: number,
      glowB: number,
      glowAlpha: number
    ) => {
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const x = ((points[i][1] + 180) / 360) * 2048;
        const y = ((90 - points[i][0]) / 180) * 1024;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.shadowColor = `rgba(${glowR}, ${glowG}, ${glowB}, ${glowAlpha})`;
      ctx.shadowBlur = 25;
      ctx.fillStyle = `rgba(${colorR}, ${colorG}, ${colorB}, ${alpha})`;
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const continents = [
      { points: [[25, -120], [35, -115], [45, -95], [50, -80], [45, -70], [35, -80], [25, -95]], alpha: 0.5, glowAlpha: 0.6 },
      { points: [[10, -75], [0, -80], [-15, -70], [-30, -50], [-40, -65], [-50, -70], [-55, -40], [0, -45]], alpha: 0.45, glowAlpha: 0.6 },
      { points: [[45, -10], [55, 0], [60, 25], [55, 45], [45, 55], [40, 40], [42, 20], [45, 10]], alpha: 0.5, glowAlpha: 0.6 },
      { points: [[35, -10], [35, 20], [25, 35], [10, 40], [-10, 40], [-25, 35], [-35, 20], [-20, 15], [10, 15], [25, 5]], alpha: 0.45, glowAlpha: 0.6 },
      { points: [[70, 30], [60, 55], [50, 85], [40, 110], [30, 130], [20, 140], [5, 115], [15, 95], [30, 80], [45, 70], [55, 50]], alpha: 0.55, glowAlpha: 0.6 },
      { points: [[-15, 130], [-25, 118], [-35, 140], [-30, 150], [-18, 148]], alpha: 0.45, glowAlpha: 0.6 },
    ];
    const shadeMultipliers: Array<[number, number]> = [
      [0.8, 0.88], [0.75, 0.83], [0.82, 0.85], [0.77, 0.81], [0.85, 0.88], [0.72, 0.79],
    ];

    for (let i = 0; i < continents.length; i++) {
      const [satMul, litMul] = shadeMultipliers[i];
      const continent = continents[i];
      const cr = Math.round(continentRGB[0] * satMul);
      const cg = Math.round(continentRGB[1] * satMul);
      const cb = Math.round(continentRGB[2] * litMul);
      const gr = Math.round(atmosphereRGB[0] * 0.94);
      const gg = Math.round(atmosphereRGB[1] * 0.96);
      const gb = Math.round(atmosphereRGB[2] * 0.96);
      drawContinent(continent.points, cr, cg, cb, continent.alpha, gr, gg, gb, continent.glowAlpha);
    }

    ctx.strokeStyle = `rgba(${Math.round(atmosphereRGB[0] * 0.7)}, ${Math.round(atmosphereRGB[1] * 0.7)}, ${Math.round(atmosphereRGB[2] * 0.6)}, 0.12)`;
    ctx.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = ((90 - lat) / 180) * 1024;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(2048, y);
      ctx.stroke();
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const x = ((lon + 180) / 360) * 2048;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    globeTextureRef.current = texture;
    return texture;
  }, []);

  const rebuildMarkers = useCallback(
    (rotation: number, mode: 'pixel' | 'flag' = 'flag') => {
      const scene = sceneRef.current;
      if (!scene) {
        return;
      }

      markerSpritesRef.current.forEach((sprite) => {
        scene.remove(sprite);
        (sprite.material as THREE.SpriteMaterial).map?.dispose();
        sprite.material.dispose();
      });
      markerSpritesRef.current.clear();
      markerLocalPositionsRef.current.clear();
      markerStateRef.current.clear();
      markerCountryCodeRef.current.clear();

      for (const region of regions) {
        const coords = REGION_COORDINATES_3D[region.id];
        if (!coords) {
          continue;
        }
        const localPosition = toThreeVector(
          latLongToVector3(coords.lat, coords.lon, GLOBE_RADIUS + 0.01)
        );
        markerLocalPositionsRef.current.set(region.id, localPosition);

        // Store country code for this region (from region.country ISO code)
        const countryCode = region.country?.toLowerCase() || 'us';
        markerCountryCodeRef.current.set(region.id, countryCode);

        const worldPosition = rotateVectorY(localPosition, rotation);
        const state = getSpriteDisplayState(
          region.id,
          hoveredRegionRef.current,
          selectedRegionRef.current,
          testingRegionIdRef.current,
          latencyState
        );
        const latState = latencyState?.[region.id];
        const markerColor = themeColorsRef.current.markerHex;
        const selectedColor = themeColorsRef.current.selectedMarkerHex;
        const flagImg = mode === 'flag' ? (flagImageCache.get(countryCode) || null) : null;

        const material = new THREE.SpriteMaterial({
          map: createFlagIconTexture(
            countryCode,
            state,
            latState?.latency,
            state === 'testing',
            markerColor,
            selectedColor,
            animationPhaseRef.current,
            flagImg,
            mode
          ),
          transparent: true,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        });
        const sprite = new THREE.Sprite(material);

        sprite.position.copy(worldPosition);
        sprite.visible = worldPosition.z >= -0.5;
        sprite.userData = { regionId: region.id };
        markerSpritesRef.current.set(region.id, sprite);
        markerStateRef.current.set(region.id, state);

        if (state === 'selected' || state === 'testing') {
          sprite.scale.setScalar(0.22);
        } else if (state === 'hovered') {
          sprite.scale.setScalar(0.18);
        } else {
          sprite.scale.setScalar(0.12);
        }
        scene.add(sprite);
      }
    },
    [regions, latencyState]
  );

  const refreshThemeVisuals = useCallback(() => {
    const scene = sceneRef.current;
    const globe = globeRef.current;
    if (!scene || !globe) {
      return;
    }

    const colors = resolveThemeColors();
    themeColorsRef.current = colors;

    const globeMaterial = globe.material as THREE.MeshBasicMaterial;
    globeMaterial.map = rebuildEarthTexture(colors.continentRGB, colors.atmosphereRGB);
    globeMaterial.needsUpdate = true;

    if (glowMeshRef.current) {
      const glowMaterial = glowMeshRef.current.material as THREE.MeshBasicMaterial;
      glowMaterial.color = colors.glow;
      glowMaterial.needsUpdate = true;
    }

    rebuildAtmosphere(scene, colors.atmosphere);
    rebuildContinents(scene, colors.continentRGB);

    markerSpritesRef.current.forEach((_sprite, regionId) => {
      const state = getSpriteDisplayState(
        regionId,
        hoveredRegionRef.current,
        selectedRegionRef.current,
        testingRegionIdRef.current,
        latencyState
      );
      applySpriteDisplayState(regionId, state, true);
    });
  }, [applySpriteDisplayState, rebuildAtmosphere, rebuildContinents, rebuildEarthTexture, latencyState]);

  // Preload flag images when regions change
  useEffect(() => {
    preloadFlagImages(regions);
  }, [regions]);

  useEffect(() => {
    selectedRegionRef.current = selectedRegion?.id ?? null;
  }, [selectedRegion]);

  useEffect(() => {
    hoveredRegionRef.current = hoveredRegion;
  }, [hoveredRegion]);

  useEffect(() => {
    testingRegionIdRef.current = testingRegionId ?? null;
  }, [testingRegionId]);

  useEffect(() => {
    displayModeRef.current = displayMode || 'flag';
  }, [displayMode]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 5.5;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const colors = resolveThemeColors();
    themeColorsRef.current = colors;

    const earthTexture = rebuildEarthTexture(colors.continentRGB, colors.atmosphereRGB);
    const globeGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const globeMaterial = new THREE.MeshBasicMaterial({ map: earthTexture, transparent: true, opacity: 0.9 });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);
    globeRef.current = globe;

    const glowGeometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.04, 64, 64);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: colors.glow,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
    });
    glowMeshRef.current = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowMeshRef.current);

    rebuildAtmosphere(scene, colors.atmosphere);
    rebuildContinents(scene, colors.continentRGB);
    rebuildMarkers(rotationRef.current, displayModeRef.current);
    setIsLoaded(true);

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);

      // Update animation phase for testing pulse
      animationPhaseRef.current += 0.08;

      // Update testing marker textures if needed
      if (testingRegionIdRef.current && markerSpritesRef.current.has(testingRegionIdRef.current)) {
        const sprite = markerSpritesRef.current.get(testingRegionIdRef.current);
        const material = sprite?.material as THREE.SpriteMaterial;
        if (sprite && material) {
          const regionId = testingRegionIdRef.current;
          const countryCode = markerCountryCodeRef.current.get(regionId) || 'us';
          const latState = latencyState?.[regionId];
          const markerColor = themeColorsRef.current.markerHex;
          const selectedColor = themeColorsRef.current.selectedMarkerHex;
          const flagImg = displayModeRef.current === 'flag' ? (flagImageCache.get(countryCode) || null) : null;

          const nextTexture = createFlagIconTexture(
            countryCode,
            'testing',
            latState?.latency,
            true,
            markerColor,
            selectedColor,
            animationPhaseRef.current,
            flagImg,
            displayModeRef.current
          );
          material.map?.dispose();
          material.map = nextTexture;
          material.needsUpdate = true;
        }
      }

      // Handle target rotation (when testing/selected a region)
      if (targetRotationRef.current !== null) {
        const targetRot = targetRotationRef.current;
        const currentRot = rotationRef.current;
        const diff = targetRot - currentRot;
        // Normalize diff to [-PI, PI]
        const normalizedDiff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
        const rotationStep = 0.03; // Smooth rotation speed

        if (Math.abs(normalizedDiff) < 0.01) {
          // Close enough, snap to target
          rotationRef.current = targetRot;
          targetRotationRef.current = null;
          isAutoRotatingToTargetRef.current = false;
          currentRotationSpeedRef.current = BASE_ROTATION_SPEED;
        } else {
          // Smoothly rotate toward target
          const step = Math.sign(normalizedDiff) * Math.min(Math.abs(normalizedDiff), rotationStep);
          rotationRef.current += step;
        }
      } else if (!isAutoRotatingToTargetRef.current) {
        // Normal auto-rotation when not focusing on a target
        const targetSpeed = hoveredRegionRef.current ? HOVER_ROTATION_SPEED : BASE_ROTATION_SPEED;
        currentRotationSpeedRef.current += (targetSpeed - currentRotationSpeedRef.current) * 0.1;
        rotationRef.current += currentRotationSpeedRef.current;
      }

      const rotation = rotationRef.current;

      globe.rotation.y = rotation;
      if (glowMeshRef.current) {
        glowMeshRef.current.rotation.y = rotation;
      }
      if (atmosphereRef.current) {
        atmosphereRef.current.rotation.y = rotation * 0.5;
      }
      if (continentPointsRef.current) {
        continentPointsRef.current.rotation.y = rotation;
      }

      markerSpritesRef.current.forEach((sprite, regionId) => {
        const localPosition = markerLocalPositionsRef.current.get(regionId);
        if (!localPosition) {
          return;
        }
        const worldPosition = rotateVectorY(localPosition, rotation);
        sprite.position.copy(worldPosition);
        sprite.visible = worldPosition.z >= -0.5;
      });

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) {
        return;
      }
      const nextWidth = containerRef.current.clientWidth;
      const nextHeight = containerRef.current.clientHeight;
      cameraRef.current.aspect = nextWidth / nextHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(nextWidth, nextHeight);
    };

    const refreshQueuedRef = { current: false };
    const queueThemeRefresh = () => {
      if (refreshQueuedRef.current) {
        return;
      }
      refreshQueuedRef.current = true;
      requestAnimationFrame(() => {
        refreshQueuedRef.current = false;
        refreshThemeVisuals();
      });
    };

    const rootObserver = new MutationObserver(queueThemeRefresh);
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    const managedStyleElement = document.getElementById('skypanelv2-theme-style');
    const styleObserver = managedStyleElement
      ? new MutationObserver(queueThemeRefresh)
      : null;
    styleObserver?.observe(managedStyleElement, {
      characterData: true,
      subtree: true,
      childList: true,
    });

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      window.removeEventListener('resize', handleResize);
      rootObserver.disconnect();
      styleObserver?.disconnect();

      const sprites = markerSpritesRef.current;
      const localPositions = markerLocalPositionsRef.current;
      const markerSt = markerStateRef.current;
      sprites.forEach((sprite) => {
        (sprite.material as THREE.SpriteMaterial).map?.dispose();
        sprite.material.dispose();
      });
      sprites.clear();
      localPositions.clear();
      markerSt.clear();

      renderer.dispose();
      globeGeometry.dispose();
      globeMaterial.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      globeTextureRef.current?.dispose();
      atmosphereRef.current?.geometry.dispose();
      (atmosphereRef.current?.material as THREE.PointsMaterial)?.dispose();
      continentPointsRef.current?.geometry.dispose();
      (continentPointsRef.current?.material as THREE.PointsMaterial)?.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [rebuildAtmosphere, rebuildContinents, rebuildEarthTexture, rebuildMarkers, refreshThemeVisuals, regions, latencyState]);

  useEffect(() => {
    rebuildMarkers(rotationRef.current, displayModeRef.current);
  }, [regions, rebuildMarkers, latencyState, displayModeRef.current]);

  useEffect(() => {
    const previousSelected = selectedRegionRef.current;
    const nextSelected = selectedRegion?.id ?? null;
    selectedRegionRef.current = nextSelected;

    if (previousSelected && previousSelected !== nextSelected) {
      const fallbackState =
        hoveredRegionRef.current === previousSelected ? 'hovered' : 'default';
      applySpriteDisplayState(previousSelected, fallbackState);
    }
    if (nextSelected) {
      applySpriteDisplayState(nextSelected, 'selected');

      // Calculate target rotation to face the selected region
      const coords = REGION_COORDINATES_3D[nextSelected];
      if (coords) {
        // Point faces camera when alpha = theta + PI/2 where theta = (lon + 180) * PI/180
        const targetRot = (coords.lon + 270) * (Math.PI / 180);
        targetRotationRef.current = targetRot;
        isAutoRotatingToTargetRef.current = true;
      }
    }
  }, [applySpriteDisplayState, selectedRegion]);

  useEffect(() => {
    const previousHovered = hoveredRegionRef.current;
    const nextHovered = hoveredRegion;
    hoveredRegionRef.current = nextHovered;

    if (previousHovered && previousHovered !== selectedRegionRef.current) {
      applySpriteDisplayState(previousHovered, 'default');
    }
    if (nextHovered && nextHovered !== selectedRegionRef.current) {
      applySpriteDisplayState(nextHovered, 'hovered');
    }
  }, [applySpriteDisplayState, hoveredRegion]);

  useEffect(() => {
    const previousTesting = testingRegionIdRef.current;
    const nextTesting = testingRegionId ?? null;

    if (previousTesting && previousTesting !== nextTesting && previousTesting !== selectedRegionRef.current) {
      applySpriteDisplayState(previousTesting, 'default');
    }
    if (nextTesting && nextTesting !== selectedRegionRef.current) {
      applySpriteDisplayState(nextTesting, 'testing');

      // Calculate target rotation to face the testing region
      const coords = REGION_COORDINATES_3D[nextTesting];
      if (coords) {
        // Calculate the longitude rotation needed to face this region
        // In latLongToVector3: theta = (lon + 180) * PI/180
        // After Y rotation by alpha: z' = r*sin(phi)*sin(alpha - theta)
        // Point faces camera (max z') when sin(alpha - theta) = 1
        // So alpha - theta = PI/2, therefore: alpha = theta + PI/2
        // = (lon + 180) * PI/180 + PI/2 = (lon + 270) * PI/180
        const targetRot = (coords.lon + 270) * (Math.PI / 180);
        targetRotationRef.current = targetRot;
        isAutoRotatingToTargetRef.current = true;
      }
    }
  }, [applySpriteDisplayState, testingRegionId]);

  const getIntersectedRegionId = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const camera = cameraRef.current;
    const container = containerRef.current;
    if (!camera || !container) {
      return null;
    }

    const rect = container.getBoundingClientRect();
    pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(pointerRef.current, camera);
    raycasterRef.current.params.Sprite = { threshold: 0.15 };

    const sprites = Array.from(markerSpritesRef.current.values());
    const intersections = raycasterRef.current.intersectObjects(sprites);
    if (intersections.length === 0) {
      return null;
    }

    return (intersections[0].object.userData.regionId as string | undefined) ?? null;
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const regionId = getIntersectedRegionId(event);
      if (regionId !== hoveredRegionRef.current) {
        setHoveredRegion(regionId);
      }
      if (containerRef.current) {
        containerRef.current.style.cursor = regionId ? 'pointer' : 'default';
      }
    },
    [getIntersectedRegionId]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredRegion(null);
    if (containerRef.current) {
      containerRef.current.style.cursor = 'default';
    }
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (disableClick) return;
      const regionId = getIntersectedRegionId(event);
      if (!regionId) {
        onRegionSelect(null);
        return;
      }
      const region = regions.find((item) => item.id === regionId) ?? null;
      onRegionSelect(region);
    },
    [disableClick, getIntersectedRegionId, onRegionSelect, regions]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[280px] md:min-h-[400px] lg:min-h-[600px]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isLoaded ? 1 : 0, y: 0 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-4 py-2 backdrop-blur-sm"
      >
        <Globe className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{regions.length} Regions</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 1 : 0 }}
        transition={{ delay: 1 }}
        className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-4 py-2 backdrop-blur-sm"
      >
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Click a region</span>
      </motion.div>
    </div>
  );
}
