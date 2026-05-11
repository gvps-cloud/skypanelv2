import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface AdminHeroCardProps {
  badge: string;
  badgeIcon?: LucideIcon;
  title: string;
  description: string;
  decorativeIcon?: LucideIcon;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export function AdminHeroCard({
  badge,
  badgeIcon: BadgeIcon,
  title,
  description,
  decorativeIcon: DecorativeIcon,
  children,
  actions,
}: AdminHeroCardProps) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--primary-rgb,0,255,128),0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--primary-rgb,0,255,128),0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="relative z-10">
        <Badge variant="secondary" className="mb-3 font-mono text-xs uppercase tracking-widest">
          {BadgeIcon && <BadgeIcon className="mr-1.5 h-3 w-3" />}
          {badge}
        </Badge>
        <h2 className="font-mono text-3xl font-bold tracking-tight md:text-4xl">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl font-mono text-sm text-muted-foreground">
          <span className="text-primary">$</span> {description}
        </p>
        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
        {children}
      </div>
      {DecorativeIcon && (
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <DecorativeIcon className="absolute right-10 top-10 h-32 w-32 rotate-12" />
        </div>
      )}
    </div>
  );
}
