import * as React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  /**
   * Size of the logo icon
   * @default 'md'
   */
  size?: "sm" | "md" | "lg" | "xl";
  /** Additional CSS classes */
  className?: string;
}

const sizeMap = {
  sm: 16,
  md: 20,
  lg: 32,
  xl: 48,
} as const;

/**
 * SkyPanelV2 logo component with adaptive styling via currentColor.
 * Renders the stacked servers design with orbit ring.
 */
export function Logo({ size = "md", className }: LogoProps) {
  const dimension = sizeMap[size];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={dimension}
      height={dimension}
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Orbit ring */}
      <circle
        cx="64"
        cy="64"
        r="50"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="4"
        fill="none"
      />
      {/* Stacked servers */}
      <g fill="currentColor">
        <rect x="32" y="38" width="64" height="14" rx="4" />
        <rect x="32" y="58" width="64" height="14" rx="4" />
        <rect x="32" y="78" width="64" height="14" rx="4" />
      </g>
      {/* Indicator dots */}
      <circle cx="42" cy="45" r="2" fill="currentColor" fillOpacity="0.3" />
      <circle cx="42" cy="65" r="2" fill="currentColor" fillOpacity="0.3" />
      <circle cx="42" cy="85" r="2" fill="currentColor" fillOpacity="0.3" />
      {/* Orbit accent */}
      <path
        d="M110 64a46 46 0 0 1-84 26"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
