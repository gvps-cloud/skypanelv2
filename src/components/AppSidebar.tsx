import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  Building2,
  Cog,
  CreditCard,
  BookOpen,
  FileText,
  Key,
  LayoutDashboard,
  Megaphone,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";

import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
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
  const isApiDocsActive = pathname.startsWith("/api-docs");
  const isDocsActive = pathname.startsWith("/docs");
  const isAdminRoute = pathname.startsWith("/admin") && !authIsImpersonating;

  const navMainItems = React.useMemo(
    () => {
      if (isAdminRoute) {
        const activeAnchor = currentHash || "dashboard";

        // Organized admin navigation with task-focused grouping.
        const adminGroups = [
          {
            title: "Dashboard",
            icon: LayoutDashboard,
            url: `/admin`,
            isActive: activeAnchor === "dashboard" || !currentHash,
          },
          {
            title: "Operations",
            icon: Cog,
            url: `/admin#support`,
            isActive: ["support", "servers", "networking", "stackscripts", "providers", "regions", "vps-plans", "category-mappings", "ssh-keys", "activity-log"].includes(activeAnchor),
            items: [
              { title: "Tickets", url: `/admin#support`, isActive: activeAnchor === "support" },
              { title: "Servers", url: `/admin#servers`, isActive: activeAnchor === "servers" },
              { title: "Networking", url: `/admin#networking`, isActive: activeAnchor === "networking" },
              { title: "StackScripts", url: `/admin#stackscripts`, isActive: activeAnchor === "stackscripts" },
              { title: "Regions", url: `/admin#regions`, isActive: activeAnchor === "regions" },
              { title: "Providers", url: `/admin#providers`, isActive: activeAnchor === "providers" },
              { title: "VPS Plans", url: `/admin#vps-plans`, isActive: activeAnchor === "vps-plans" },
              { title: "Category Mappings", url: `/admin#category-mappings`, isActive: activeAnchor === "category-mappings" },
              { title: "SSH Keys", url: `/admin#ssh-keys`, isActive: activeAnchor === "ssh-keys" },
              { title: "Activity Log", url: `/admin#activity-log`, isActive: activeAnchor === "activity-log" },
            ],
          },
          {
            title: "Content & Communication",
            icon: Megaphone,
            url: `/admin#announcements`,
            isActive: [
              "announcements",
              "faq-management",
              "documentation",
              "contact-management",
              "email-templates",
            ].includes(activeAnchor),
            items: [
              { title: "Announcements", url: `/admin#announcements`, isActive: activeAnchor === "announcements" },
              { title: "FAQ Management", url: `/admin#faq-management`, isActive: activeAnchor === "faq-management" },
              { title: "Documentation", url: `/admin#documentation`, isActive: activeAnchor === "documentation" },
              { title: "Contact Management", url: `/admin#contact-management`, isActive: activeAnchor === "contact-management" },
              { title: "Email Templates", url: `/admin#email-templates`, isActive: activeAnchor === "email-templates" },
            ],
          },
          {
            title: "Platform Settings",
            icon: Settings,
            url: `/admin#platform`,
            isActive: [
              "platform",
              "theme",
              "rate-limiting",
            ].includes(activeAnchor),
            items: [
              { title: "Theme", url: `/admin#theme`, isActive: activeAnchor === "theme" },
              { title: "Rate Limiting", url: `/admin#rate-limiting`, isActive: activeAnchor === "rate-limiting" },
              { title: "Platform Controls", url: `/admin#platform`, isActive: activeAnchor === "platform" },
            ],
          },
          {
            title: "Identity & Access",
            icon: ShieldCheck,
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
            title: "Finance",
            icon: CreditCard,
            url: `/admin#billing`,
            isActive: ["billing", "egress-credits"].includes(activeAnchor),
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
            ],
          },
        ];

        return adminGroups;
      }

      const userNavItems = [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
          isActive: isDashboardActive,
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
          ],
        },
        {
          title: "Organizations",
          url: "/organizations",
          icon: Building2,
          isActive: pathname.startsWith("/organizations"),
        },
        {
          title: "Personal Notes",
          url: "/notes/personal",
          icon: FileText,
          isActive: isPersonalNotesActive,
        },
        {
          title: "Organization Notes",
          url: "/notes/organizations",
          icon: Users,
          isActive: isOrganizationNotesActive,
        },
        {
          title: "SSH Keys",
          url: "/ssh-keys",
          icon: Key,
          isActive: isSshKeysActive,
        },
        {
          title: "Activity",
          url: "/activity",
          icon: Activity,
          isActive: isActivityActive,
        },
        {
          title: "Billing",
          url: "/billing",
          icon: CreditCard,
          isActive: isBillingActive,
        },
        {
          title: "API Docs",
          url: "/api-docs",
          icon: BookOpen,
          isActive: isApiDocsActive,
        },
        {
          title: "Documentation",
          url: "/docs",
          icon: FileText,
          isActive: isDocsActive,
        },
      ];

      return userNavItems;
    },
    [
      pathname,
      currentHash,
      isActivityActive,
      isAdminRoute,
      isBillingActive,
      isApiDocsActive,
      isDashboardActive,
      isDocsActive,
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
      <SidebarHeader className="gap-4 border-b border-white/10 bg-sidebar-background/80 p-4 pointer-events-none">
        <SidebarMenu className="pointer-events-auto">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="group-data-[collapsible=icon]:-ml-1.5"
              asChild
            >
              <Link to="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Logo size="sm" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{BRAND_NAME}</span>
                  <span className="truncate text-xs">Cloud Platform</span>
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
      <SidebarFooter>
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
      </SidebarFooter>
    </Sidebar>
  );
}
