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
 * Logo component that renders the favicon.svg used across the site.
 */
export function Logo({ size = "md", className }: LogoProps) {
  const dimension = sizeMap[size];

  return (
    <img
      src="/favicon.svg"
      alt="Logo"
      width={dimension}
      height={dimension}
      className={cn("shrink-0", className)}
    />
  );
}
