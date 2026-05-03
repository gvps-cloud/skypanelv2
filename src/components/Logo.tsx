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
    <span
      role="img"
      aria-label="Logo"
      className={cn("inline-block shrink-0 bg-current text-foreground", className)}
      style={{
        width: dimension,
        height: dimension,
        WebkitMaskImage: 'url("/favicon.svg")',
        maskImage: 'url("/favicon.svg")',
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
