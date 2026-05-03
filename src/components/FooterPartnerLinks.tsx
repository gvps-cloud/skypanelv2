import { cn } from "@/lib/utils";

const partnerLinks = [
  { label: "OpenCode.ai", href: "https://opencode.ai" },
  { label: "Zed.dev", href: "https://zed.dev" },
  { label: "z.ai", href: "https://z.ai/subscribe?ic=FWBEF3L5K4" },
];

const resourceLinks = [
  { label: "Documentation", href: "/docs" },
  { label: "API Docs", href: "/api-docs" },
];

interface FooterPartnerLinksProps {
  className?: string;
}

export default function FooterPartnerLinks({ className }: FooterPartnerLinksProps) {
  const renderLinkPill = (link: { label: string; href: string }) => {
    const isExternal = link.href.startsWith("http");

    return (
      <a
        key={link.label}
        href={link.href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noreferrer" : undefined}
        className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary"
      >
        {link.label}
      </a>
    );
  };

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      <div className="inline-flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Built with</span>
        {partnerLinks.map(renderLinkPill)}
      </div>

      <span className="text-xs text-muted-foreground/70">|</span>

      <div className="inline-flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Our</span>
        {resourceLinks.map(renderLinkPill)}
      </div>
    </div>
  );
}
