import type { LucideIcon } from "lucide-react";
import {
  ArrowDownUp,
  Globe2,
  HardDrive,
  Mail,
  Database,
  Users,
  Key,
  Server,
} from "lucide-react";
import type { HostingPlan } from "@/hooks/useHosting";

export interface HostingFeatureSpecRow {
  key: string;
  label: string;
  icon: LucideIcon;
}

const countLabels: Record<string, string> = {
  ftpUsers: "FTP users",
  mysqlDbs: "MySQL databases",
  websites: "Websites",
  mailboxes: "Mailboxes",
  customers: "Customers",
  domainAliases: "Domain aliases",
  subdomains: "Subdomains",
};

const capacityLabels: Record<string, string> = {
  diskspace: "Disk space",
  transfer: "Transfer",
};

const canonicalResourceOrder: string[] = [
  "websites",
  "ftpUsers",
  "mysqlDbs",
  "mailboxes",
  "customers",
  "domainAliases",
  "subdomains",
  "diskspace",
  "transfer",
];

const RESOURCE_ICONS: Record<string, LucideIcon> = {
  websites: Globe2,
  ftpUsers: Key,
  mysqlDbs: Database,
  mailboxes: Mail,
  customers: Users,
  domainAliases: Globe2,
  subdomains: Server,
  diskspace: HardDrive,
  transfer: ArrowDownUp,
};

const titleizeResourceKey = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatCount = (value: number | null | undefined) => {
  if (value === null || value === undefined || value === -1) return "Unlimited";
  return new Intl.NumberFormat("en-US").format(value);
};

const formatCapacity = (value: number | null | undefined) => {
  if (value === null || value === undefined || value === -1) return "Unlimited";
  if (!Number.isFinite(value) || value <= 0) return "0 MB";

  const normalizedMb = value >= 1_000_000 ? value / 1_000_000 : value;

  if (normalizedMb >= 1_000_000) {
    return `${(normalizedMb / 1_000_000).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })} TB`;
  }

  if (normalizedMb >= 1_000) {
    return `${(normalizedMb / 1_000).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })} GB`;
  }

  return `${normalizedMb.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })} MB`;
};

export const getHostingFeatureRows = (plan: HostingPlan, limit = 9): string[] => {
  return getHostingFeatureSpecRows(plan, limit).map((row) => row.label);
};

export const getHostingFeatureSpecRows = (
  plan: HostingPlan,
  limit = 9,
): HostingFeatureSpecRow[] => {
  const rows: HostingFeatureSpecRow[] = [];
  const resources = plan.features?.resources ?? {};

  for (const key of canonicalResourceOrder) {
    const resource = resources[key];
    const icon = RESOURCE_ICONS[key] ?? Server;

    if (key in capacityLabels) {
      rows.push({
        key,
        label: `${formatCapacity(resource?.total)} ${capacityLabels[key]}`,
        icon,
      });
      continue;
    }

    const label = countLabels[key] ?? titleizeResourceKey(key);
    const total = resource?.total;
    if (key === "customers" && (total === undefined || total === null || total === 0)) {
      continue;
    }

    const displayValue = total !== undefined && total !== null ? total : 0;
    rows.push({
      key,
      label: `${formatCount(displayValue)} ${label}`,
      icon,
    });
  }

  return rows.slice(0, limit);
};
