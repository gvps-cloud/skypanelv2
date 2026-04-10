import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Activity,
  CreditCard,
  FileText,
  HelpCircle,
  Home,
  Key,
  LifeBuoy,
  Loader2,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Server,
  Settings,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import { generateBreadcrumbs } from "@/lib/breadcrumbs";
import { cn } from "@/lib/utils";
import { formatCurrency as formatCurrencyDisplay } from "@/lib/formatters";
import NotificationDropdown from "@/components/NotificationDropdown";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import {
  BreadcrumbProvider,
  useBreadcrumb,
} from "@/contexts/BreadcrumbContext";
import type { VPSInstance } from "@/types/vps";
import { Badge } from "@/components/ui/badge";

interface TicketCommandItem {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface AdminUserCommandItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface InvoiceCommandItem {
  id: string;
  invoiceNumber: string | null;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

interface QuickCreateItem {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const formatRelativeTime = (input: string | null | undefined): string => {
  if (!input) {
    return "—";
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

const formatCurrencyValue = (value: number, currency = "USD"): string => {
  try {
    return formatCurrencyDisplay(value, { currency });
  } catch (error) {
    console.warn("Currency formatting failed", error);
    return Number.isFinite(value) ? value.toFixed(2) : "—";
  }
};

const toTitleCase = (value: string): string =>
  value
    .split(/[_\s]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const TICKET_STATUS_CLASSES: Record<string, string> = {
  open: "border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  in_progress:
    "border border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  resolved:
    "border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  closed: "border border-muted-foreground/20 bg-muted text-muted-foreground",
};

const TICKET_PRIORITY_CLASSES: Record<string, string> = {
  low: "border border-muted-foreground/20 bg-muted text-muted-foreground",
  medium:
    "border border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  high: "border border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  urgent:
    "border border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
};

const getTicketStatusClass = (status: string): string =>
  TICKET_STATUS_CLASSES[status] ||
  "border border-muted-foreground/20 bg-muted text-muted-foreground";

const getTicketPriorityClass = (priority: string): string =>
  TICKET_PRIORITY_CLASSES[priority] ||
  "border border-muted-foreground/20 bg-muted text-muted-foreground";

const formatTicketStatusLabel = (status: string): string =>
  toTitleCase(status || "Pending");

const formatTicketPriorityLabel = (priority: string): string =>
  toTitleCase(priority || "Normal");

const formatRoleLabel = (role: string): string => toTitleCase(role || "User");

interface AppLayoutProps {
  children: React.ReactNode;
}

interface CommandNavigationItem {
  icon: LucideIcon;
  label: string;
  href: string;
  shortcut?: string;
  shortcutKey?: string;
  requiresShift?: boolean;
  requiresAlt?: boolean;
}

// Separate component for breadcrumb navigation that uses the context
const BreadcrumbNavigation: React.FC = () => {
  const location = useLocation();
  const { dynamicOverrides } = useBreadcrumb();

  // Generate breadcrumbs from current route with dynamic overrides
  const breadcrumbs = useMemo(
    () => generateBreadcrumbs(location.pathname, dynamicOverrides),
    [location.pathname, dynamicOverrides],
  );

  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <div className="hidden md:block">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.isActive || !crumb.href ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={isAdminRoute && index === 0 ? "/admin" : crumb.href}
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user, isImpersonating } = useAuth();
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const isAdmin = useMemo(
    () => (user?.role || "").toLowerCase() === "admin" && !isImpersonating,
    [isImpersonating, user?.role],
  );
  const isAdminRoute = useMemo(
    () => location.pathname.startsWith("/admin"),
    [location.pathname],
  );

  // State for VPS and related search data
  const [vpsInstances, setVpsInstances] = useState<VPSInstance[]>([]);
  const [vpsLoading, setVpsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [supportTickets, setSupportTickets] = useState<TicketCommandItem[]>([]);
  const [supportTicketsLoading, setSupportTicketsLoading] = useState(false);
  const [adminCommandUsers, setAdminCommandUsers] = useState<
    AdminUserCommandItem[]
  >([]);
  const [regularCommandUsers, setRegularCommandUsers] = useState<
    AdminUserCommandItem[]
  >([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceCommandItem[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }
    return /Mac|iPhone|iPod|iPad/.test(navigator.platform);
  }, []);

  // Read sidebar state from cookie on initialization
  const getSidebarPreference = useCallback(() => {
    if (typeof window === "undefined") {
      return true;
    }

    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("sidebar_state="));

    return cookie ? cookie.split("=")[1] !== "false" : true;
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() =>
    getSidebarPreference(),
  );

  useEffect(() => {
    setIsSidebarOpen(getSidebarPreference());
  }, [getSidebarPreference]);

  // This will be moved to a separate component that uses the breadcrumb context

  // Use the proper theme hook for persistence
  const { isDark, toggleTheme } = useTheme();

  // Fetch VPS instances
  const fetchVPSInstances = useCallback(async () => {
    if (!token) return;

    setVpsLoading(true);
    try {
      const res = await fetch("/api/vps", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok)
        throw new Error(payload.error || "Failed to load VPS instances");

      const mapped: VPSInstance[] = (payload.instances || []).map((i: any) => ({
        id: i.id,
        label: i.label,
        status:
          ((i.status as any) || "provisioning") === "offline"
            ? "stopped"
            : (i.status as any) || "provisioning",
        type: i.configuration?.type || "",
        region: i.configuration?.region || "",
        regionLabel: i.region_label || undefined,
        image: i.configuration?.image || "",
        ipv4: i.ip_address ? [i.ip_address] : [],
        ipv6: "",
        created: i.created_at,
        specs: {
          vcpus: Number(i.plan_specs?.vcpus || 0),
          memory: Number(i.plan_specs?.memory || 0),
          disk: Number(i.plan_specs?.disk || 0),
          transfer: Number(i.plan_specs?.transfer || 0),
        },
        stats: {
          cpu: 0,
          memory: 0,
          disk: 0,
          network: { in: 0, out: 0 },
          uptime: "",
        },
        pricing: {
          hourly: Number(i.plan_pricing?.hourly || 0),
          monthly: Number(i.plan_pricing?.monthly || 0),
        },
      }));

      setVpsInstances(mapped);
    } catch (error: any) {
      console.error("Failed to load VPS instances:", error);
    } finally {
      setVpsLoading(false);
    }
  }, [token]);

  const fetchSupportTickets = useCallback(async () => {
    if (!token || !isAdmin) {
      setSupportTickets([]);
      return;
    }

    setSupportTicketsLoading(true);
    try {
      const res = await fetch("/api/admin/tickets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load support tickets");
      }

      const rows: TicketCommandItem[] = Array.isArray(payload.tickets)
        ? payload.tickets.slice(0, 12).map((ticket: any) => ({
            id: ticket.id,
            subject: ticket.subject,
            status: ticket.status,
            priority: ticket.priority,
            createdAt: ticket.updated_at ?? ticket.created_at ?? "",
          }))
        : [];

      setSupportTickets(rows);
    } catch (error) {
      console.error("Failed to load admin tickets:", error);
    } finally {
      setSupportTicketsLoading(false);
    }
  }, [token, isAdmin]);

  const fetchAdminCommandUsers = useCallback(async () => {
    if (!token || !isAdmin) {
      setAdminCommandUsers([]);
      return;
    }

    setAdminUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load admin users");
      }

      const allUsers: AdminUserCommandItem[] = Array.isArray(payload.users)
        ? payload.users.slice(0, 15).map((user: any) => ({
            id: user.id,
            name: user.name || user.email,
            email: user.email,
            role: user.role,
          }))
        : [];

      // Separate admins and regular users
      const admins = allUsers.filter(u => u.role === 'admin');
      const regularUsers = allUsers.filter(u => u.role !== 'admin');

      setAdminCommandUsers(admins);
      setRegularCommandUsers(regularUsers);
    } catch (error) {
      console.error("Failed to load admin users:", error);
    } finally {
      setAdminUsersLoading(false);
    }
  }, [token, isAdmin]);

  const fetchRecentInvoices = useCallback(async () => {
    if (!token) {
      setInvoiceItems([]);
      return;
    }

    setInvoicesLoading(true);
    try {
      const res = await fetch("/api/invoices?limit=12", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.success === false) {
        throw new Error(payload.error || "Failed to load invoices");
      }

      const rows: InvoiceCommandItem[] = Array.isArray(payload.invoices)
        ? payload.invoices.slice(0, 12).map((invoice: any) => ({
            id: invoice.id,
            invoiceNumber:
              invoice.invoiceNumber ?? invoice.invoice_number ?? null,
            totalAmount: Number(
              invoice.totalAmount ?? invoice.total_amount ?? 0,
            ),
            currency: invoice.currency || "USD",
            createdAt: invoice.createdAt ?? invoice.created_at ?? "",
          }))
        : [];

      setInvoiceItems(rows);
    } catch (error) {
      console.error("Failed to load invoices:", error);
    } finally {
      setInvoicesLoading(false);
    }
  }, [token]);

  // Fetch data when command dialog opens (lazy loading)
  useEffect(() => {
    if (commandOpen && !dataLoaded && token) {
      setDataLoaded(true);
      fetchVPSInstances();
      fetchRecentInvoices();
      if (isAdmin) {
        fetchSupportTickets();
        fetchAdminCommandUsers();
      }
    }
  }, [
    commandOpen,
    dataLoaded,
    token,
    isAdmin,
    fetchVPSInstances,
    fetchRecentInvoices,
    fetchSupportTickets,
    fetchAdminCommandUsers,
  ]);

  // Command search keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Navigation items for command search
  const userNavigationItems = useMemo<CommandNavigationItem[]>(
    () => [
      {
        icon: Home,
        label: "Dashboard",
        href: "/dashboard",
        shortcut: isMac ? "⌥D" : "Alt+D",
        shortcutKey: "d",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Server,
        label: "VPS Instances",
        href: "/vps",
        shortcut: isMac ? "⌥V" : "Alt+V",
        shortcutKey: "v",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Key,
        label: "SSH Keys",
        href: "/ssh-keys",
        shortcut: isMac ? "⌥K" : "Alt+K",
        shortcutKey: "k",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: CreditCard,
        label: "Billing",
        href: "/billing",
        shortcut: isMac ? "⌥B" : "Alt+B",
        shortcutKey: "b",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Activity,
        label: "Activity",
        href: "/activity",
        shortcut: isMac ? "⌥A" : "Alt+A",
        shortcutKey: "a",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: MessageCircle,
        label: "Support",
        href: "/support",
        shortcut: isMac ? "⌥U" : "Alt+U",
        shortcutKey: "u",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Settings,
        label: "Settings",
        href: "/settings",
        shortcut: isMac ? "⌥S" : "Alt+S",
        shortcutKey: "s",
        requiresShift: false,
        requiresAlt: true,
      },
    ],
    [isMac],
  );

  const adminNavigationItems = useMemo<CommandNavigationItem[]>(
    () => [
      {
        icon: Home,
        label: "Admin Dashboard",
        href: "/admin#dashboard",
        shortcut: isMac ? "⌥D" : "Alt+D",
        shortcutKey: "d",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: LifeBuoy,
        label: "Support Tickets",
        href: "/admin#support",
        shortcut: isMac ? "⌥U" : "Alt+U",
        shortcutKey: "u",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Server,
        label: "Servers",
        href: "/admin#servers",
        shortcut: isMac ? "⌥S" : "Alt+S",
        shortcutKey: "s",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Activity,
        label: "Networking",
        href: "/admin#networking",
        shortcut: isMac ? "⌥N" : "Alt+N",
        shortcutKey: "n",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Activity,
        label: "Reverse DNS",
        href: "/admin?netTab=rdns#networking",
        shortcut: isMac ? "⌥⇧N" : "Alt+Shift+N",
        shortcutKey: "n",
        requiresShift: true,
        requiresAlt: true,
      },
      {
        icon: Activity,
        label: "IP Addresses",
        href: "/admin?netTab=ips#networking",
        shortcut: isMac ? "⌥I" : "Alt+I",
        shortcutKey: "i",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Activity,
        label: "IPv6",
        href: "/admin?netTab=ipv6#networking",
        shortcut: isMac ? "⌥6" : "Alt+6",
        shortcutKey: "6",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Activity,
        label: "VLANs",
        href: "/admin?netTab=vlans#networking",
        shortcut: isMac ? "⌥W" : "Alt+W",
        shortcutKey: "w",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Activity,
        label: "Firewalls",
        href: "/admin?netTab=firewalls#networking",
        shortcut: isMac ? "⌥H" : "Alt+H",
        shortcutKey: "h",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Activity,
        label: "Assign IPs",
        href: "/admin?netTab=assign#networking",
        shortcut: isMac ? "⌥⇧I" : "Alt+Shift+I",
        shortcutKey: "i",
        requiresShift: true,
        requiresAlt: true,
      },
      {
        icon: Activity,
        label: "Share IPs",
        href: "/admin?netTab=share#networking",
        shortcut: isMac ? "⌥⇧H" : "Alt+Shift+H",
        shortcutKey: "h",
        requiresShift: true,
        requiresAlt: true,
      },
      {
        icon: FileText,
        label: "VPS Plans",
        href: "/admin#vps-plans",
        shortcut: isMac ? "⌥P" : "Alt+P",
        shortcutKey: "p",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Key,
        label: "SSH Keys",
        href: "/admin#ssh-keys",
        shortcut: isMac ? "⌥K" : "Alt+K",
        shortcutKey: "k",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: MessageCircle,
        label: "Announcements",
        href: "/admin#announcements",
        shortcut: isMac ? "⌥A" : "Alt+A",
        shortcutKey: "a",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: MessageCircle,
        label: "FAQ Management",
        href: "/admin#faq-management",
        shortcut: isMac ? "⌥F" : "Alt+F",
        shortcutKey: "f",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: FileText,
        label: "Documentation",
        href: "/admin#documentation",
        shortcut: isMac ? "⌥⇧D" : "Alt+Shift+D",
        shortcutKey: "d",
        requiresShift: true,
        requiresAlt: true,
      },
      {
        icon: MessageCircle,
        label: "Contact Management",
        href: "/admin#contact-management",
        shortcut: isMac ? "⌥C" : "Alt+C",
        shortcutKey: "c",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: FileText,
        label: "Email Templates",
        href: "/admin#email-templates",
        shortcut: isMac ? "⌥E" : "Alt+E",
        shortcutKey: "e",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Settings,
        label: "Theme",
        href: "/admin#theme",
        shortcut: isMac ? "⌥T" : "Alt+T",
        shortcutKey: "t",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Activity,
        label: "Rate Limiting",
        href: "/admin#rate-limiting",
        shortcut: isMac ? "⌥R" : "Alt+R",
        shortcutKey: "r",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Settings,
        label: "Platform Controls",
        href: "/admin#platform",
        shortcut: isMac ? "⌥⇧P" : "Alt+Shift+P",
        shortcutKey: "p",
        requiresShift: true,
        requiresAlt: true,
      },
      {
        icon: Users,
        label: "User Management",
        href: "/admin#user-management",
        shortcut: isMac ? "⌥M" : "Alt+M",
        shortcutKey: "m",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Users,
        label: "Organizations",
        href: "/admin#organizations",
        shortcut: isMac ? "⌥O" : "Alt+O",
        shortcutKey: "o",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: CreditCard,
        label: "Billing Overview",
        href: "/admin#billing",
        shortcut: isMac ? "⌥B" : "Alt+B",
        shortcutKey: "b",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: CreditCard,
        label: "Egress Credits",
        href: "/admin#egress-credits",
        shortcut: isMac ? "⌥G" : "Alt+G",
        shortcutKey: "g",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Server,
        label: "StackScripts",
        href: "/admin#stackscripts",
        shortcut: isMac ? "⌥⇧S" : "Alt+Shift+S",
        shortcutKey: "s",
        requiresShift: true,
        requiresAlt: true,
      },
      {
        icon: Server,
        label: "Providers",
        href: "/admin#providers",
        shortcut: isMac ? "⌥V" : "Alt+V",
        shortcutKey: "v",
        requiresShift: false,
        requiresAlt: true,
      },
      {
        icon: Server,
        label: "Regions",
        href: "/admin#regions",
        shortcut: isMac ? "⌥⇧R" : "Alt+Shift+R",
        shortcutKey: "r",
        requiresShift: true,
        requiresAlt: true,
      },
      {
        icon: Server,
        label: "Category Mappings",
        href: "/admin#category-mappings",
        shortcut: isMac ? "⌥Y" : "Alt+Y",
        shortcutKey: "y",
        requiresShift: false,
        requiresAlt: true,
      },
    ],
    [isMac],
  );

  const navigationItems = useMemo<CommandNavigationItem[]>(
    () => (isAdminRoute ? adminNavigationItems : userNavigationItems),
    [isAdminRoute, adminNavigationItems, userNavigationItems],
  );

  const actionItems = useMemo(
    () => [
      {
        label: "Toggle theme",
        shortcut: isMac ? "⌥L" : "Alt+L",
        shortcutKey: "l",
        onSelect: () => toggleTheme(),
        icon: isDark ? Sun : Moon,
        requiresShift: false,
        requiresAlt: true,
      },
    ],
    [isMac, toggleTheme, isDark],
  );

  const quickCreateItems = useMemo<QuickCreateItem[]>(() => {
    const items: QuickCreateItem[] = [
      {
        label: "Launch VPS",
        description: "Deploy a new virtual server",
        href: "/vps?create=1",
        icon: Server,
      },
      {
        label: "Create support ticket",
        description: "Open a new support conversation",
        href: "/support",
        icon: LifeBuoy,
      },
      {
        label: "Top up wallet",
        description: "Add funds with secure checkout",
        href: "/billing",
        icon: CreditCard,
      },
    ];

    return items;
  }, []);

  const handleNavigate = useCallback(
    (href: string) => {
      navigate(href);
      setCommandOpen(false);
    },
    [navigate, setCommandOpen],
  );

  const handleSupportTicketSelect = useCallback(
    (ticketId: string) => {
      navigate(`/admin?ticketId=${encodeURIComponent(ticketId)}#support`);
      setCommandOpen(false);
    },
    [navigate],
  );

  const handleAdminUserSelect = useCallback(
    (userId: string) => {
      navigate(`/admin/user/${userId}`);
      setCommandOpen(false);
    },
    [navigate],
  );

  const handleInvoiceSelect = useCallback(
    (invoiceId: string) => {
      navigate(`/billing/invoice/${invoiceId}`);
      setCommandOpen(false);
    },
    [navigate],
  );

  useEffect(() => {
    if (!commandOpen) {
      return;
    }

    const handleShortcut = (event: KeyboardEvent) => {
      const pressedKey = event.key.toLowerCase();
      const matchesModifiers = (item: {
        requiresShift?: boolean;
        requiresAlt?: boolean;
      }) => {
        const needsShift = item.requiresShift === true;
        const needsAlt = item.requiresAlt === true;

        // Check if correct modifier is pressed
        // For Alt shortcuts: Alt must be pressed, Ctrl/Cmd should NOT be pressed
        // For Ctrl shortcuts: Ctrl/Cmd must be pressed, Alt should NOT be pressed
        const modifierActive = needsAlt
          ? event.altKey && !event.ctrlKey && !event.metaKey
          : (isMac ? event.metaKey : event.ctrlKey) && !event.altKey;

        if (!modifierActive) {
          return false;
        }

        if (needsShift !== event.shiftKey) {
          return false;
        }

        return true;
      };

      const match = navigationItems.find(
        (item) =>
          item.shortcutKey &&
          item.shortcutKey === pressedKey &&
          matchesModifiers(item),
      );
      if (match) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        handleNavigate(match.href);
        return;
      }

      const actionMatch = actionItems.find(
        (item) => item.shortcutKey === pressedKey && matchesModifiers(item),
      );
      if (actionMatch) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        actionMatch.onSelect();
        setCommandOpen(false);
      }
    };

    document.addEventListener("keydown", handleShortcut, true);
    return () => {
      document.removeEventListener("keydown", handleShortcut, true);
    };
  }, [commandOpen, navigationItems, handleNavigate, isMac, actionItems]);

  // Helper function to get status color for VPS
  const getVPSStatusColor = (status: string): string => {
    switch (status) {
      case "running":
        return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20";
      case "stopped":
        return "text-muted-foreground bg-gray-100 dark:bg-gray-800";
      case "provisioning":
        return "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20";
      case "rebooting":
        return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20";
      case "error":
        return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20";
      default:
        return "text-muted-foreground bg-gray-100 dark:bg-gray-800";
    }
  };

  return (
    <SidebarProvider
      defaultOpen={isSidebarOpen}
      open={isSidebarOpen}
      onOpenChange={setIsSidebarOpen}
    >
      <AppSidebar onOpenCommand={() => setCommandOpen(true)} />
      <SidebarInset>
        {/* Two-Tier Navigation Header */}
        <header className="sticky z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b transition-[width,height] ease-linear" style={{ top: 'var(--announcement-banner-height, 0px)' }}>
          <div className="flex h-14 sm:h-16 shrink-0 items-center justify-between gap-2 px-2 sm:px-4 py-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger
                className={cn(isSidebarOpen ? "-ml-1" : "ml-2", "text-muted-foreground")}
              />

              <Separator
                orientation="vertical"
                className="mr-2 h-4 hidden md:block"
              />
              <BreadcrumbNavigation />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {/* Search Bar - Desktop-only command palette trigger */}
              <div className="hidden md:block max-w-md">
                <Button
                  variant="outline"
                  className="w-full justify-start text-muted-foreground min-w-[200px]"
                  onClick={() => setCommandOpen(true)}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Search...
                  <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Create new service</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Quick create</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {quickCreateItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.label}
                        className="flex cursor-pointer items-start gap-3 py-2"
                        onSelect={() => navigate(item.href)}
                      >
                        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium leading-tight">
                            {item.label}
                          </span>
                          <span className="text-xs text-muted-foreground leading-tight">
                            {item.description}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <NotificationDropdown />

              {/* Keyboard Help Menu */}
              <Popover open={helpOpen} onOpenChange={setHelpOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                    <HelpCircle className="h-4 w-4" />
                    <span className="sr-only">Keyboard shortcuts</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">
                        Keyboard Shortcuts
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Quick access to common actions
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Toggle sidebar</span>
                        <Kbd>Ctrl+B</Kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Open command palette</span>
                        <Kbd>Ctrl+K</Kbd>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9 text-muted-foreground"
              >
                {isDark ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle theme</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto">
          <Card className="h-full">
            <CardContent className="flex flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6 pt-4 sm:pt-6 md:pt-6">
              <main className="flex-1 min-h-0">{children}</main>
            </CardContent>
          </Card>
        </div>

        {/* Command Dialog */}
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder="Type a command or search for a server..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    onSelect={() => handleNavigate(item.href)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                    {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {/* VPS Instances Group */}
            {(vpsInstances.length > 0 || vpsLoading) && (
              <>
                <CommandSeparator />
                <CommandGroup heading="VPS Instances">
                  {vpsLoading ? (
                    <CommandItem disabled>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Loading VPS instances...</span>
                    </CommandItem>
                  ) : (
                    vpsInstances.map((vps) => (
                      <CommandItem
                        key={vps.id}
                        onSelect={() => handleNavigate(`/vps/${vps.id}`)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center">
                          <Server className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span className="font-medium">{vps.label}</span>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span
                                className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getVPSStatusColor(vps.status)}`}
                              >
                                {vps.status}
                              </span>
                              {vps.ipv4.length > 0 && (
                                <span>{vps.ipv4[0]}</span>
                              )}
                              {vps.regionLabel && (
                                <span>{vps.regionLabel}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </>
            )}

            {/* Invoice Group */}
            {(invoiceItems.length > 0 || invoicesLoading) && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Recent Invoices">
                  {invoicesLoading ? (
                    <CommandItem disabled>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Loading invoices...</span>
                    </CommandItem>
                  ) : (
                    invoiceItems.map((invoice) => (
                      <CommandItem
                        key={invoice.id}
                        onSelect={() => handleInvoiceSelect(invoice.id)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center">
                          <FileText className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {invoice.invoiceNumber
                                ? `Invoice ${invoice.invoiceNumber}`
                                : `Invoice ${invoice.id}`}
                            </span>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                {formatCurrencyValue(
                                  invoice.totalAmount,
                                  invoice.currency,
                                )}
                              </span>
                              <span>
                                {formatRelativeTime(invoice.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </>
            )}

            {/* Support Tickets Group (Admin) */}
            {isAdmin &&
              (supportTickets.length > 0 || supportTicketsLoading) && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Support Tickets">
                    {supportTicketsLoading ? (
                      <CommandItem disabled>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span>Loading support tickets...</span>
                      </CommandItem>
                    ) : (
                      supportTickets.map((ticket) => (
                        <CommandItem
                          key={ticket.id}
                          onSelect={() => handleSupportTicketSelect(ticket.id)}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <LifeBuoy className="mr-2 h-4 w-4" />
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {ticket.subject || `Ticket ${ticket.id}`}
                              </span>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "border px-1.5 py-0.5 font-medium",
                                    getTicketStatusClass(ticket.status),
                                  )}
                                >
                                  {formatTicketStatusLabel(ticket.status)}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "border px-1.5 py-0.5 font-medium",
                                    getTicketPriorityClass(ticket.priority),
                                  )}
                                >
                                  {formatTicketPriorityLabel(ticket.priority)}
                                </Badge>
                                <span>
                                  {formatRelativeTime(ticket.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CommandItem>
                      ))
                    )}
                  </CommandGroup>
                </>
              )}

            {/* Admin Users Group (Admin) */}
            {isAdmin && (adminCommandUsers.length > 0 || adminUsersLoading) && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Admins">
                  {adminUsersLoading ? (
                    <CommandItem disabled>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Loading team members...</span>
                    </CommandItem>
                  ) : (
                    adminCommandUsers.map((adminUser) => (
                      <CommandItem
                        key={adminUser.id}
                        onSelect={() => handleAdminUserSelect(adminUser.id)}
                        className="flex items-center justify-between"
                        value={`${adminUser.name} ${adminUser.email} ${adminUser.id}`}
                      >
                        <div className="flex items-center">
                          <Users className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {adminUser.name || adminUser.email}
                            </span>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="truncate max-w-[220px]">
                                {adminUser.email}
                              </span>
                              <Badge
                                variant="outline"
                                className="border px-1.5 py-0.5 font-medium border-muted-foreground/25 text-muted-foreground"
                              >
                                {formatRoleLabel(adminUser.role)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </>
            )}

            {/* Regular Users Group (Admin) */}
            {isAdmin && regularCommandUsers.length > 0 && !adminUsersLoading && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Users">
                  {regularCommandUsers.map((regularUser) => (
                    <CommandItem
                      key={regularUser.id}
                      onSelect={() => handleAdminUserSelect(regularUser.id)}
                      className="flex items-center justify-between"
                      value={`${regularUser.name} ${regularUser.email} ${regularUser.id}`}
                    >
                      <div className="flex items-center">
                        <Users className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {regularUser.name || regularUser.email}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate max-w-[220px]">
                              {regularUser.email}
                            </span>
                            <Badge
                              variant="outline"
                              className="border px-1.5 py-0.5 font-medium border-muted-foreground/25 text-muted-foreground"
                            >
                              {formatRoleLabel(regularUser.role)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />
            <CommandGroup heading="Actions">
              {actionItems.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.shortcutKey}
                    onSelect={() => {
                      item.onSelect();
                      setCommandOpen(false);
                    }}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                    {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </SidebarInset>
    </SidebarProvider>
  );
};

// Wrapper component that provides the breadcrumb context
const AppLayoutWithProvider: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <BreadcrumbProvider>
      <AppLayout>{children}</AppLayout>
    </BreadcrumbProvider>
  );
};

export default AppLayoutWithProvider;
