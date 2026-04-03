import { Link } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { Logo } from "@/components/Logo";
import { BRAND_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";

const footerSections = [
  {
    title: "Product",
    links: [
      { label: "Platform", href: "/#platform" },
      { label: "Pricing", href: "/pricing" },
      { label: "Regions", href: "/regions" },
      { label: "Status", href: "/status" },
      { label: "Documentation", href: "/docs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

export default function MarketingFooter() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <Logo size="md" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">
                {BRAND_NAME}
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Purpose-built cloud infrastructure for teams who demand performance, transparency, and simplicity.
            </p>
          </div>

          {/* Link sections */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="mb-4 text-sm font-semibold tracking-wide text-foreground">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mt-12 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

        {/* Bottom bar */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={scrollToTop}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Back to top
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </footer>
  );
}
