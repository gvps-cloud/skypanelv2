import type { HostingPlan } from "@/hooks/useHosting";

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
  const rows: string[] = [];
  const resources = plan.features?.resources ?? {};

  for (const key of canonicalResourceOrder) {
    const resource = resources[key];

    if (key in capacityLabels) {
      rows.push(`${formatCapacity(resource?.total)} ${capacityLabels[key]}`);
      continue;
    }

    const label = countLabels[key] ?? titleizeResourceKey(key);
    const total = resource?.total;
    // Keep cards compact and reseller-focused: hide 0-customer rows.
    if (key === "customers" && (total === undefined || total === null || total === 0)) {
      continue;
    }

    const displayValue = total !== undefined && total !== null ? total : 0;
    rows.push(`${formatCount(displayValue)} ${label}`);
  }

  return rows.slice(0, limit);
};
