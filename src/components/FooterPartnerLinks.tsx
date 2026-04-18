import { cn } from "@/lib/utils";

const partnerLinks = [
  { label: "OpenCode.ai", href: "https://opencode.ai" },
  { label: "Zed.dev", href: "https://zed.dev" },
  { label: "z.ai", href: "https://z.ai/subscribe?ic=FWBEF3L5K4" },
];

interface FooterPartnerLinksProps {
  className?: string;
}

export default function FooterPartnerLinks({ className }: FooterPartnerLinksProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground">Built with</span>
      {partnerLinks.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
