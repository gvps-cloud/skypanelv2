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

export interface HostingFeatureDisplayOptions {
  zeroMeansUnlimited?: boolean;
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

const hasResourceKey = (resources: Record<string, { total?: number | null }>, key: string) =>
  Object.prototype.hasOwnProperty.call(resources, key);

const titleizeResourceKey = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatCount = (
  value: number | null | undefined,
  options?: HostingFeatureDisplayOptions,
) => {
  if (
    value === null ||
    value === undefined ||
    value === -1 ||
    (options?.zeroMeansUnlimited === true && value === 0)
  ) {
    return "Unlimited";
  }
  return new Intl.NumberFormat("en-US").format(value);
};

const formatCapacity = (
  value: number | null | undefined,
  options?: HostingFeatureDisplayOptions,
) => {
  if (
    value === null ||
    value === undefined ||
    value === -1 ||
    (options?.zeroMeansUnlimited === true && value === 0)
  ) {
    return "Unlimited";
  }
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

export const getHostingFeatureRows = (
  plan: HostingPlan,
  limit = 9,
  options?: HostingFeatureDisplayOptions,
): string[] => {
  return getHostingFeatureSpecRows(plan, limit, options).map((row) => row.label);
};

export const getHostingFeatureSpecRows = (
  plan: HostingPlan,
  limit = 9,
  options?: HostingFeatureDisplayOptions,
): HostingFeatureSpecRow[] => {
  const rows: HostingFeatureSpecRow[] = [];
  const resources = plan.features?.resources ?? {};

  for (const key of canonicalResourceOrder) {
    const resource = resources[key];
    const icon = RESOURCE_ICONS[key] ?? Server;
    const hasResource = hasResourceKey(resources, key);
    const total = resource?.total;
    const displayValue = hasResource ? total : 0;

    if (key in capacityLabels) {
      rows.push({
        key,
        label: `${formatCapacity(displayValue, options)} ${capacityLabels[key]}`,
        icon,
      });
      continue;
    }

    const label = countLabels[key] ?? titleizeResourceKey(key);
    if (key === "customers" && (total === undefined || total === null || total === 0)) {
      continue;
    }

    rows.push({
      key,
      label: `${formatCount(displayValue, options)} ${label}`,
      icon,
    });
  }

  return rows.slice(0, limit);
};
