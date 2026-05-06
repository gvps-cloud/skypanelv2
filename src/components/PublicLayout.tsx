import React from "react";

import { AsciiDivider } from "@/components/fx/AsciiDivider";
import MarketingPageShell from "@/components/MarketingPageShell";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <MarketingPageShell
      density="calm"
      topChrome={
        <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6">
          <AsciiDivider label="session" className="opacity-50" />
        </div>
      }
    >
      {children}
    </MarketingPageShell>
  );
}
