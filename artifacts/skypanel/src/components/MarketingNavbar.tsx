import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Menu, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/Logo";
import { BRAND_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";

interface NavLinkConfig {
  label: string;
  href: string;
  isAnchor?: boolean;
}

interface NavDropdownConfig {
  label: string;
  items: NavLinkConfig[];
}

const navDropdowns: NavDropdownConfig[] = [
  {
    label: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
    ],
  },
];

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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
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

  const renderDropdown = (dropdown: NavDropdownConfig) => {
    const isOpen = openDropdown === dropdown.label;

    return (
      <div
        key={dropdown.label}
        ref={(el) => { dropdownRefs.current[dropdown.label] = el; }}
        className="relative px-3 py-1.5"
      >
        <button
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setOpenDropdown(isOpen ? null : dropdown.label)}
          onMouseEnter={() => openDropdown && setOpenDropdown(dropdown.label)}
        >
          {dropdown.label}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full mt-1 min-w-[140px] rounded-lg border border-border/50 bg-background/95 p-1.5 shadow-lg shadow-black/[0.05] backdrop-blur-xl"
            >
              {dropdown.items.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={() => {
                    setOpenDropdown(null);
                    closeMobileMenu();
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdownKeys = Object.keys(dropdownRefs.current);
      const clickedOutside = dropdownKeys.every(
        (key) => !dropdownRefs.current[key]?.contains(event.target as Node)
      );
      if (clickedOutside && openDropdown) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdown]);

  return (
    <div className={`${sticky ? "fixed left-0 right-0 z-40" : ""} pointer-events-none mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-8`} style={sticky ? { top: 'var(--announcement-banner-height, 0px)' } : undefined}>
      <div className="pointer-events-auto flex items-center justify-between rounded-2xl border border-border/50 bg-background/80 px-4 py-3 shadow-lg shadow-black/[0.03] backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
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
          {navDropdowns.map(renderDropdown)}
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

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="pointer-events-auto overflow-hidden pt-2 lg:hidden"
          >
            <div className="rounded-2xl border border-border/50 bg-background/95 px-4 pb-5 pt-3 backdrop-blur-xl">
              <div className="flex flex-col gap-3 text-sm font-medium">
                {navDropdowns.map((dropdown) =>
                  dropdown.items.map((item) => (
                    <Link
                      key={item.label}
                      to={item.href}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      onClick={closeMobileMenu}
                    >
                      {item.label}
                    </Link>
                  ))
                )}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MarketingNavbar;
