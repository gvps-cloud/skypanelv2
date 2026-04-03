import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/Logo";
import { BRAND_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";

interface NavLinkConfig {
  label: string;
  href: string;
  isAnchor?: boolean;
}

const navLinks: NavLinkConfig[] = [
  { label: "Platform", href: "#platform", isAnchor: true },
  { label: "Capabilities", href: "#capabilities", isAnchor: true },
  { label: "Solutions", href: "#solutions", isAnchor: true },
  { label: "Pricing", href: "/pricing" },
  { label: "Regions", href: "/regions" },
  { label: "Status", href: "/status" },
  { label: "Docs", href: "/docs" },
];

export function MarketingNavbar({ sticky = true }: { sticky?: boolean }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  const scrollToAnchor = (href: string) => {
    if (!href.startsWith("#")) return;
    const el = document.getElementById(href.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const resolveHref = (link: NavLinkConfig) =>
    link.isAnchor && !isHome ? `/${link.href}` : link.href;

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleLogoClick = () => {
    closeMobileMenu();
    if (isHome) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderNavLink = (link: NavLinkConfig) => {
    const resolvedHref = resolveHref(link);
    const baseClass =
      "text-sm text-muted-foreground transition-colors hover:text-foreground";

    if (link.isAnchor && isHome) {
      return (
        <a
          key={link.label}
          href={resolvedHref}
          className={baseClass}
          onClick={(e) => {
            e.preventDefault();
            scrollToAnchor(link.href);
            closeMobileMenu();
          }}
        >
          {link.label}
        </a>
      );
    }

    return (
      <Link
        key={link.label}
        to={resolvedHref}
        className={baseClass}
        onClick={closeMobileMenu}
      >
        {link.label}
      </Link>
    );
  };

  return (
    <header
      className={`${sticky ? "sticky top-0 z-40" : ""} w-full`}
    >
      <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/80 px-4 py-3 shadow-lg shadow-black/[0.03] backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-lg font-semibold transition-transform hover:scale-[1.02]"
            onClick={handleLogoClick}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <Logo size="sm" />
            </div>
            <span className="tracking-tight">{BRAND_NAME}</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <div key={link.label} className="px-3 py-1.5">
                {renderNavLink(link)}
              </div>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login" onClick={closeMobileMenu}>
                Log in
              </Link>
            </Button>
            <Button size="sm" className="home-btn-glow" asChild>
              <Link to="/register" onClick={closeMobileMenu}>
                Launch console
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsMobileMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden lg:hidden"
          >
            <div className="mx-auto max-w-7xl px-4 pb-4 pt-2 sm:px-6 lg:px-8">
              <div className="rounded-2xl border border-border/50 bg-background/95 px-4 pb-5 pt-3 backdrop-blur-xl">
                <div className="flex flex-col gap-3 text-sm font-medium">
                  {navLinks.map(renderNavLink)}
                </div>
                <div className="mt-5 flex flex-col gap-2 border-t border-border/40 pt-4">
                  <Button variant="ghost" asChild className="justify-start">
                    <Link to="/login" onClick={closeMobileMenu}>
                      Log in
                    </Link>
                  </Button>
                  <Button asChild onClick={closeMobileMenu}>
                    <Link to="/register">Launch console</Link>
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default MarketingNavbar;
