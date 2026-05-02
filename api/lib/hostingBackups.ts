export type BackupStorageKind = "enhance" | "s3";
export type BackupDownloadKind = "website" | "email";
export type BackupOperationStatus = "started" | "successful" | "failed";
export type BackupDisplayStatus =
  | "running"
  | "successful"
  | "partial"
  | "failed"
  | "unknown";

export interface HostingBackupComponentSummary {
  status?: BackupOperationStatus;
  size?: number;
  count?: number;
}

export interface HostingBackupComponents {
  files: HostingBackupComponentSummary;
  databases: HostingBackupComponentSummary;
  emails: HostingBackupComponentSummary;
}

export interface EnhanceBackupRecord {
  id: string | number;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string | null;
  status?: string | null;
  size?: number | null;
  filesSize?: number | null;
  mysqlDbsSize?: number | null;
  emailsSize?: number | null;
  mysqlDbsCount?: number | null;
  emailsCount?: number | null;
  homeDirStatus?: BackupOperationStatus | null;
  mysqlDbsStatus?: BackupOperationStatus | null;
  emailsStatus?: BackupOperationStatus | null;
  kind?: string | null;
  storageKind?: BackupStorageKind | string | null;
  components?: unknown;
  [key: string]: unknown;
}

export interface NormalizedHostingBackup extends EnhanceBackupRecord {
  id: string;
  displayDate: string | null;
  displayStatus: BackupDisplayStatus;
  components: HostingBackupComponents;
  canRestore: boolean;
}

export interface EnhanceBackupStatusRecord {
  id?: string | number;
  websiteId?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  action?: "backup" | "restore" | string;
  homeDirStatus?: BackupOperationStatus | null;
  mysqlDbsStatus?: BackupOperationStatus | null;
  emailsStatus?: BackupOperationStatus | null;
  [key: string]: unknown;
}

export interface NormalizedBackupStatusRecord extends EnhanceBackupStatusRecord {
  id?: string;
  displayDate: string | null;
  displayStatus: BackupDisplayStatus;
  components: HostingBackupComponents;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  }
  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const numberValue = toOptionalNumber(value);
    if (numberValue !== undefined) return numberValue;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hasFinished(value: { finishedAt?: string | null }): boolean {
  return typeof value.finishedAt === "string" && value.finishedAt.trim().length > 0;
}

function collectStatuses(value: {
  homeDirStatus?: BackupOperationStatus | null;
  mysqlDbsStatus?: BackupOperationStatus | null;
  emailsStatus?: BackupOperationStatus | null;
}): BackupOperationStatus[] {
  return [value.homeDirStatus, value.mysqlDbsStatus, value.emailsStatus].filter(
    (status): status is BackupOperationStatus =>
      status === "started" || status === "successful" || status === "failed",
  );
}

export function deriveBackupDisplayStatus(value: {
  status?: string | null;
  finishedAt?: string | null;
  homeDirStatus?: BackupOperationStatus | null;
  mysqlDbsStatus?: BackupOperationStatus | null;
  emailsStatus?: BackupOperationStatus | null;
}): BackupDisplayStatus {
  const statuses = collectStatuses(value);

  if (statuses.includes("started")) {
    return "running";
  }

  if (statuses.includes("failed") && statuses.includes("successful")) {
    return "partial";
  }

  if (statuses.includes("failed")) {
    return "failed";
  }

  if (statuses.length > 0 && statuses.every((status) => status === "successful")) {
    return "successful";
  }

  if (hasFinished(value)) {
    return "successful";
  }

  switch (value.status) {
    case "completed":
    case "success":
    case "successful":
      return "successful";
    case "in_progress":
    case "running":
    case "started":
      return "running";
    case "failed":
      return "failed";
    default:
      return "unknown";
  }
}

export function normalizeBackupComponents(value: {
  homeDirStatus?: BackupOperationStatus | null;
  mysqlDbsStatus?: BackupOperationStatus | null;
  emailsStatus?: BackupOperationStatus | null;
  filesSize?: number | null;
  mysqlDbsSize?: number | null;
  emailsSize?: number | null;
  mysqlDbsCount?: number | null;
  emailsCount?: number | null;
  components?: unknown;
}): HostingBackupComponents {
  const components = asRecord(value.components);
  const files = asRecord(components.files ?? components.homeDir ?? components.home);
  const databases = asRecord(components.databases ?? components.mysqlDbs ?? components.mysql);
  const emails = asRecord(components.emails ?? components.email);

  return {
    files: {
      status: value.homeDirStatus ?? (files.status as BackupOperationStatus | undefined),
      size: firstNumber(value.filesSize, files.size, files.bytes, files.totalBytes),
    },
    databases: {
      status: value.mysqlDbsStatus ?? (databases.status as BackupOperationStatus | undefined),
      size: firstNumber(value.mysqlDbsSize, databases.size, databases.bytes, databases.totalBytes),
      count: firstNumber(value.mysqlDbsCount, databases.count),
    },
    emails: {
      status: value.emailsStatus ?? (emails.status as BackupOperationStatus | undefined),
      size: firstNumber(value.emailsSize, emails.size, emails.bytes, emails.totalBytes),
      count: firstNumber(value.emailsCount, emails.count),
    },
  };
}

export function normalizeHostingBackup(backup: EnhanceBackupRecord): NormalizedHostingBackup {
  const displayStatus = deriveBackupDisplayStatus(backup);

  return {
    ...backup,
    id: String(backup.id),
    displayDate: backup.startedAt ?? backup.finishedAt ?? backup.createdAt ?? null,
    displayStatus,
    components: normalizeBackupComponents(backup),
    canRestore: displayStatus === "successful" || displayStatus === "partial",
  };
}

export function normalizeBackupStatus(
  status: EnhanceBackupStatusRecord | null | undefined,
): NormalizedBackupStatusRecord | null {
  if (!status) {
    return null;
  }

  return {
    ...status,
    id: status.id === undefined ? undefined : String(status.id),
    displayDate: status.startedAt ?? status.finishedAt ?? null,
    displayStatus: deriveBackupDisplayStatus(status),
    components: normalizeBackupComponents(status),
  };
}

export function parseBackupStorageKind(value: unknown): BackupStorageKind | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (value === "enhance" || value === "s3") {
    return value;
  }
  throw new Error("Invalid storageKind");
}

export function parseBackupDownloadKind(value: unknown): BackupDownloadKind {
  if (value === undefined || value === null || value === "") {
    return "website";
  }
  if (value === "website" || value === "email") {
    return value;
  }
  throw new Error("Invalid backupDownloadKind");
}
