import React from 'react';
import '@/styles/home.css';
import { AsciiDivider } from '@/components/fx/AsciiDivider';
import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNavbar />

      {/* Main Content */}
      <main className="relative">
        <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6">
          <AsciiDivider label="session" className="opacity-50" />
        </div>
        {children}
      </main>

      <MarketingFooter />
    </div>
  );
}