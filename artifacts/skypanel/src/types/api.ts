export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
}

export type ApiIdentifier = string;

export interface TimestampedRecord {
  created_at: string;
  updated_at: string;
}

export interface NamedEntity {
  id: ApiIdentifier;
  name: string;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiErrorResponse {
  error: string;
  details?: string;
  code?: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

export interface ListParams {
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export type ApiListResponse<T, TKey extends string = "data"> = {
  pagination?: PaginationMeta;
} & Record<TKey, T[]>;

export interface MutationSuccessResponse {
  success: boolean;
  message?: string;
}

export interface AuthenticatedUser extends TimestampedRecord {
  id: ApiIdentifier;
  email: string;
  name: string;
  role: string;
  phone?: string | null;
  timezone?: string | null;
  organizationId?: string | null;
  preferences?: Record<string, unknown> | null;
}

export interface OrganizationSummary extends TimestampedRecord {
  id: ApiIdentifier;
  name: string;
  slug: string;
  owner_id?: ApiIdentifier;
}

export interface PaymentTransactionSummary extends TimestampedRecord {
  id: ApiIdentifier;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string | null;
  payment_provider?: string | null;
  provider_transaction_id?: string | null;
  description?: string | null;
}

export interface WalletBalanceResponse {
  balance: number;
  currency: string;
}

export interface VolumeTypeRecord extends TimestampedRecord {
  id: ApiIdentifier;
  label: string;
  storage_type: string;
  size_min_gb: number;
  size_max_gb: number;
  price_per_gb_month: number;
  price_per_gb_hour: number;
  region_pricing: Record<
    string,
    {
      price_per_gb_month: number;
      price_per_gb_hour: number;
    }
  >;
  is_active: boolean;
  display_order: number;
  description: string | null;
}

export interface AdminVolumeRecord extends TimestampedRecord {
  id: ApiIdentifier;
  organization_id: ApiIdentifier;
  organization_name: string;
  vps_id: ApiIdentifier | null;
  vps_label: string | null;
  provider: string;
  provider_volume_id: string;
  label: string;
  region: string;
  size_gb: number;
  storage_type: string;
  status: string;
  hourly_price: number;
}

export interface AdminVolumeOverview {
  stats: {
    total_volumes: number;
    active_volumes: number;
    total_capacity_gb: number;
  };
  by_status: Array<{
    status: string;
    count: string;
    total_gb: string;
  }>;
  by_organization: Array<{
    id: ApiIdentifier;
    name: string;
    volume_count: string;
    total_gb: string;
  }>;
  recent_billing: Array<{
    id: ApiIdentifier;
    volume_label: string;
    provider: string;
    total_amount: number;
    size_gb: number;
    billing_period_start: string;
    organization_name: string;
  }>;
}
