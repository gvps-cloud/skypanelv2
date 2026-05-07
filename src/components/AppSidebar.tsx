import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  BookOpen,
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Palette,
  Search,
  Server,
  ShieldCheck,
  Tags,
  Users,
  Globe,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { MatrixRain } from "@/components/fx/MatrixRain";

import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useHostingStatus } from "@/hooks/useHosting";
import { BRAND_NAME } from "@/lib/brand";
import { ImpersonationSidebarPanel } from "@/components/ImpersonationSidebarPanel";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar-context";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onOpenCommand?: () => void;
}

export function AppSidebar({ onOpenCommand, ...props }: AppSidebarProps) {
  const location = useLocation();
  const { user, isImpersonating: authIsImpersonating } = useAuth();
  const { state, isMobile } = useSidebar();
  const { isImpersonating, impersonatedUser, exitImpersonation, isExiting } = useImpersonation();
  const { data: hostingStatus } = useHostingStatus();

  // Main navigation items
  const pathname = location.pathname;
  const currentHash = location.hash?.slice(1) ?? "";
  const isDashboardActive = pathname === "/dashboard";
  const isVpsActive = pathname.startsWith("/vps");
  const isActivityActive = pathname.startsWith("/activity");
  const isBillingActive = pathname.startsWith("/billing");
  const isSshKeysActive = pathname.startsWith("/ssh-keys");
  const isPersonalNotesActive = pathname.startsWith("/notes/personal");
  const isOrganizationNotesActive = pathname.startsWith("/notes/organizations");
  const isNotesActive = pathname.startsWith("/notes");
  const isHostingActive = pathname.startsWith("/hosting");
  const isAdminRoute = pathname.startsWith("/admin") && !authIsImpersonating;

  const navMainItems = React.useMemo(
    () => {
      if (isAdminRoute) {
        const activeAnchor = currentHash || "dashboard";

        // Dashboard first; remaining sections by label length (long → short), like the customer nav taper.
        const adminDashboard = {
          title: "Dashboard",
          icon: LayoutDashboard,
          url: `/admin`,
          isActive: activeAnchor === "dashboard" || !currentHash,
        };

        const adminOtherGroups = [
          {
            title: "Support & Intake",
            icon: LifeBuoy,
            url: `/admin#support`,
            isActive: ["support", "contact-management"].includes(activeAnchor),
            items: [
              { title: "Tickets", url: `/admin#support`, isActive: activeAnchor === "support" },
              {
                title: "Contact Management",
                url: `/admin#contact-management`,
                isActive: activeAnchor === "contact-management",
              },
            ],
          },
          {
            title: "Infrastructure",
            icon: Server,
            url: `/admin#servers`,
            isActive: ["servers", "providers", "regions", "networking", "stackscripts", "ssh-keys"].includes(activeAnchor),
            items: [
              { title: "Servers", url: `/admin#servers`, isActive: activeAnchor === "servers" },
              { title: "Providers", url: `/admin#providers`, isActive: activeAnchor === "providers" },
              { title: "Regions", url: `/admin#regions`, isActive: activeAnchor === "regions" },
              { title: "Networking", url: `/admin#networking`, isActive: activeAnchor === "networking" },
              { title: "StackScripts", url: `/admin#stackscripts`, isActive: activeAnchor === "stackscripts" },
              { title: "SSH Keys", url: `/admin#ssh-keys`, isActive: activeAnchor === "ssh-keys" },
            ],
          },
          {
            title: "Products & Pricing",
            icon: Tags,
            url: `/admin#vps-plans`,
            isActive: ["vps-plans", "volume-pricing", "category-mappings"].includes(activeAnchor),
            items: [
              { title: "VPS Plans", url: `/admin#vps-plans`, isActive: activeAnchor === "vps-plans" },
              { title: "Volume Pricing", url: `/admin#volume-pricing`, isActive: activeAnchor === "volume-pricing" },
              { title: "Category Mappings", url: `/admin#category-mappings`, isActive: activeAnchor === "category-mappings" },
            ],
          },
          {
            title: "Billing",
            icon: CreditCard,
            url: `/admin#billing`,
            isActive: ["billing", "egress-credits", "refunds"].includes(activeAnchor),
            items: [
              {
                title: "Billing Overview",
                url: `/admin#billing`,
                isActive: activeAnchor === "billing",
              },
              {
                title: "Egress Credits",
                url: `/admin#egress-credits`,
                isActive: activeAnchor === "egress-credits",
              },
              {
                title: "Refunds",
                url: `/admin#refunds`,
                isActive: activeAnchor === "refunds",
              },
            ],
          },
          {
            title: "Users & Organizations",
            icon: Users,
            url: `/admin#user-management`,
            isActive: ["user-management", "organizations"].includes(activeAnchor),
            items: [
              {
                title: "Users",
                url: `/admin#user-management`,
                isActive: activeAnchor === "user-management",
              },
              {
                title: "Organizations",
                url: `/admin#organizations`,
                isActive: activeAnchor === "organizations",
              },
            ],
          },
          {
            title: "Brand & Communications",
            icon: Palette,
            url: `/admin#theme`,
            isActive: [
              "theme",
              "announcements",
              "documentation",
              "faq-management",
              "email-templates",
            ].includes(activeAnchor),
            items: [
              { title: "Theme", url: `/admin#theme`, isActive: activeAnchor === "theme" },
              { title: "Announcements", url: `/admin#announcements`, isActive: activeAnchor === "announcements" },
              { title: "Documentation", url: `/admin#documentation`, isActive: activeAnchor === "documentation" },
              { title: "FAQ Management", url: `/admin#faq-management`, isActive: activeAnchor === "faq-management" },
              { title: "Email Templates", url: `/admin#email-templates`, isActive: activeAnchor === "email-templates" },
            ],
          },
          {
            title: "Content",
            icon: BookOpen,
            url: `/admin#blog-management`,
            isActive: ["blog-management", "blog-categories"].includes(activeAnchor),
            items: [
              { title: "Blog Categories", url: `/admin#blog-categories`, isActive: activeAnchor === "blog-categories" },
              { title: "Blog Posts", url: `/admin#blog-management`, isActive: activeAnchor === "blog-management" },
            ],
          },
          {
            title: "Platform & Audit",
            icon: ShieldCheck,
            url: `/admin#platform`,
            isActive: ["platform", "rate-limiting", "activity-log", "fraud-protection", "maintenance"].includes(activeAnchor),
            items: [
              { title: "Platform Controls", url: `/admin#platform`, isActive: activeAnchor === "platform" },
              { title: "Rate Limiting", url: `/admin#rate-limiting`, isActive: activeAnchor === "rate-limiting" },
              { title: "Activity Log", url: `/admin#activity-log`, isActive: activeAnchor === "activity-log" },
              { title: "Fraud Protection", url: `/admin#fraud-protection`, isActive: activeAnchor === "fraud-protection" },
              { title: "Maintenance", url: `/admin#maintenance`, isActive: activeAnchor === "maintenance" },
            ],
          },
          {
            title: "Web Hosting",
            icon: Globe,
            url: `/admin#enhance-hosting`,
            isActive: ["enhance-hosting", "enhance-plans", "enhance-subscriptions"].includes(activeAnchor),
            items: [
              { title: "Integration", url: `/admin#enhance-hosting`, isActive: activeAnchor === "enhance-hosting" },
              { title: "Plans", url: `/admin#enhance-plans`, isActive: activeAnchor === "enhance-plans" },
              { title: "Subscriptions", url: `/admin#enhance-subscriptions`, isActive: activeAnchor === "enhance-subscriptions" },
            ],
          },
        ].sort((a, b) => {
          const byLen = b.title.length - a.title.length;
          return byLen !== 0 ? byLen : a.title.localeCompare(b.title);
        });

        return [adminDashboard, ...adminOtherGroups];
      }

      // Dashboard stays first; remaining items follow label length (long → short) for a cleaner visual taper.
      const userNavItems = [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
          isActive: isDashboardActive,
        },
        {
          title: "Organizations",
          url: "/organizations",
          icon: Building2,
          isActive: pathname.startsWith("/organizations"),
        },
        ...(hostingStatus?.enabled
          ? [
              {
                title: "Web Hosting",
                url: "/hosting",
                icon: Globe,
                isActive: isHostingActive,
              },
            ]
          : []),
        {
          title: "Activity",
          url: "/activity",
          icon: Activity,
          isActive: isActivityActive,
        },
        {
          title: "Compute",
          url: "/vps",
          icon: Server,
          isActive: isVpsActive,
          items: [
            {
              title: "VPS",
              url: "/vps",
              isActive: isVpsActive,
            },
            {
              title: "SSH Keys",
              url: "/ssh-keys",
              isActive: isSshKeysActive,
            },
          ],
        },
        {
          title: "Billing",
          url: "/billing",
          icon: CreditCard,
          isActive: isBillingActive,
        },
        {
          title: "Notes",
          url: "/notes/personal",
          icon: FileText,
          isActive: isNotesActive,
          items: [
            {
              title: "Personal Notes",
              url: "/notes/personal",
              isActive: isPersonalNotesActive,
            },
            {
              title: "Organization Notes",
              url: "/notes/organizations",
              isActive: isOrganizationNotesActive,
            },
          ],
        },
        {
          title: "Blog",
          url: "/blog",
          icon: BookOpen,
          isActive: pathname.startsWith("/blog"),
        },
      ];

      return userNavItems;
    },
    [
      pathname,
      currentHash,
      hostingStatus?.enabled,
      isActivityActive,
      isAdminRoute,
      isBillingActive,
      isDashboardActive,
      isHostingActive,
      isNotesActive,
      isOrganizationNotesActive,
      isPersonalNotesActive,
      isSshKeysActive,
      isVpsActive,
    ]
  );

  // Secondary navigation items
  const navSecondaryItems: Array<{
    title: string;
    url: string;
    icon: LucideIcon;
  }> = React.useMemo(() => {
    if (isAdminRoute) {
      return [];
    }

    return [];
  }, [isAdminRoute]);

  // User data for the footer
  const displayName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
    : "User";

  const userData = {
    name: displayName,
    email: user?.email || "",
    avatar: "/avatars/user.jpg", // You can add user avatar support later
    role: user?.role,
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="cyber-glass pointer-events-none gap-2 border-b border-sidebar-border p-3 font-mono group-data-[state=collapsed]:px-2">
        <SidebarMenu className="pointer-events-auto">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={BRAND_NAME}
              className="group-data-[state=collapsed]:justify-center"
              asChild
            >
              <Link to="/dashboard">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-primary/25 bg-primary/10">
                  <Logo size="sm" />
                </div>
                <div className="grid flex-1 text-left text-xs leading-tight group-data-[state=collapsed]:hidden">
                  <span className="truncate font-semibold tracking-tight">{BRAND_NAME}</span>
                  <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                    panel
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {onOpenCommand ? (
          <div className="px-2 pt-2 pb-1 md:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={onOpenCommand}
            >
              <Search className="mr-2 h-4 w-4" />
              Search...
              <Kbd className="ml-auto">⌘K</Kbd>
            </Button>
          </div>
        ) : null}
        <NavMain items={navMainItems} label={isAdminRoute ? "Admin" : undefined} />
        {navSecondaryItems.length > 0 ? (
          <NavSecondary items={navSecondaryItems} className="mt-auto" />
        ) : null}
      </SidebarContent>
      <SidebarFooter className="relative overflow-hidden border-t border-sidebar-border">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 opacity-[0.12]">
          <MatrixRain density="subdued" />
        </div>
        <div className="relative z-[1] space-y-2">
          {isImpersonating && impersonatedUser ? (
            <ImpersonationSidebarPanel
              impersonatedUser={impersonatedUser}
              onExitImpersonation={exitImpersonation}
              isExiting={isExiting}
              collapsed={!isMobile && state === "collapsed"}
              mobile={isMobile}
            />
          ) : null}
          <NavUser user={userData} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
